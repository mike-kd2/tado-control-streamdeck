import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
}));

import { ZoneControl } from "./zone-control";
import {
  createMockManager,
  createMockPolling,
  createMockDialEvent,
  MOCK_ZONE_STATE,
} from "./__test-helpers";

describe("ZoneControl", () => {
  let action: ZoneControl;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = createMockManager();
    polling = createMockPolling();
    action = new ZoneControl(manager, polling);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("onWillAppear / onWillDisappear", () => {
    it("registers and unregisters zone", async () => {
      const ev = createMockDialEvent({ homeId: "1", zoneId: "5", unit: "celsius" });
      await action.onWillAppear(ev);
      expect(polling.registerZone).toHaveBeenCalledWith(1, 5);

      action.onWillDisappear(ev as any);
      expect(polling.unregisterZone).toHaveBeenCalledWith(1, 5);
    });
  });

  describe("onDialRotate", () => {
    it("adjusts temperature in 0.5°C steps", async () => {
      polling.getCached.mockReturnValue(MOCK_ZONE_STATE);
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, { ticks: 1 });
      await action.onDialRotate(ev as any);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        target: expect.stringContaining("°C"),
      });
    });

    it("debounces API call by 300ms", async () => {
      polling.getCached.mockReturnValue(MOCK_ZONE_STATE);
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, { ticks: 1 });
      await action.onDialRotate(ev as any);

      expect(manager.api.setZoneOverlays).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledTimes(1);
    });

    it("adjusts temperature in 1°F steps for fahrenheit", async () => {
      polling.getCached.mockReturnValue(MOCK_ZONE_STATE);
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "fahrenheit" }, { ticks: 2 });
      await action.onDialRotate(ev as any);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        target: expect.stringContaining("°F"),
      });
    });
  });

  describe("onDialDown - toggle manual/schedule", () => {
    it("clears overlay when overlay exists (resume schedule)", async () => {
      manager.api.getZoneOverlay.mockResolvedValue({ setting: { power: "ON" } });
      manager.api.clearZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onDialDown(ev as any);

      expect(manager.api.clearZoneOverlays).toHaveBeenCalledWith(1, [2]);
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("creates overlay when no overlay exists (switch to manual)", async () => {
      polling.getCached.mockReturnValue({ sensorDataPoints: { insideTemperature: { celsius: 21 } } });
      manager.api.getZoneOverlay.mockRejectedValue(new Error("404"));
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onDialDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [expect.objectContaining({ power: "ON", zone_id: 2 })],
        "MANUAL",
      );
    });

    it("shows alert on error", async () => {
      manager.api.getZoneOverlay.mockRejectedValue(new Error("404"));
      manager.api.setZoneOverlays.mockRejectedValue(new Error("API down"));

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onDialDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });
  });

  describe("onTouchTap", () => {
    it("decreases temp by 0.5°C when tapping left side", async () => {
      polling.getCached.mockReturnValue(MOCK_ZONE_STATE);
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = {
        payload: {
          settings: { homeId: "1", zoneId: "2", unit: "celsius" },
          tapPos: [50, 50],
        },
        action: { isDial: vi.fn().mockReturnValue(true) },
      } as any;

      await action.onTouchTap(ev);

      expect(manager.api.setZoneOverlays).toHaveBeenCalled();
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("increases temp by 0.5°C when tapping right side", async () => {
      polling.getCached.mockReturnValue(MOCK_ZONE_STATE);
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = {
        payload: {
          settings: { homeId: "1", zoneId: "2", unit: "celsius" },
          tapPos: [150, 50],
        },
        action: { isDial: vi.fn().mockReturnValue(true) },
      } as any;

      await action.onTouchTap(ev);

      expect(manager.api.setZoneOverlays).toHaveBeenCalled();
    });
  });

  describe("display update", () => {
    it("shows current and target temperature on dial (manual mode)", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 2, MOCK_ZONE_STATE);

      expect(ev.action.setFeedbackLayout).toHaveBeenCalled();
      expect(ev.action.setFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "21.5°C",
          target: "22.0°C",
        }),
      );
    });

    it("shows 'Auto' status when no overlay (schedule mode)", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 2, { sensorDataPoints: { insideTemperature: { celsius: 19 } } });

      expect(ev.action.setFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ status: "Auto" }),
      );
    });
  });
});
