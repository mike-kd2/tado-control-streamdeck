import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
}));

import { Power } from "./power";
import {
  createMockManager,
  createMockPolling,
  createMockKeyEvent,
  createMockDialEvent,
  MOCK_ZONE_STATE,
} from "./__test-helpers";

describe("Power", () => {
  let action: Power;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    manager = createMockManager();
    polling = createMockPolling();
    action = new Power(manager, polling);
  });

  describe("onWillAppear / onWillDisappear", () => {
    it("registers and unregisters zone", async () => {
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 20 });
      await action.onWillAppear(ev);
      expect(polling.registerZone).toHaveBeenCalledWith(1, 2);

      action.onWillDisappear(ev as any);
      expect(polling.unregisterZone).toHaveBeenCalledWith(1, 2);
    });
  });

  describe("onKeyDown - toggle", () => {
    it("clears overlay when overlay exists (resume schedule)", async () => {
      manager.api.getZoneOverlay.mockResolvedValue({ setting: { power: "ON" } });
      manager.api.clearZoneOverlays.mockResolvedValue(undefined);

      const settings = { homeId: "10", zoneId: "3", unit: "celsius" as const, temperature: 22 };
      const ev = createMockKeyEvent(settings);
      await action.onKeyDown(ev);

      expect(manager.api.clearZoneOverlays).toHaveBeenCalledWith(10, [3]);
      expect(polling.refreshZone).toHaveBeenCalledWith(10, 3);
    });

    it("creates overlay when no overlay exists (start manual)", async () => {
      manager.api.getZoneOverlay.mockRejectedValue(new Error("404"));
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const settings = { homeId: "10", zoneId: "3", unit: "celsius" as const, temperature: 22 };
      const ev = createMockKeyEvent(settings);
      await action.onKeyDown(ev);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        10,
        [{ power: "ON", zone_id: 3, temperature: { celsius: 22, fahrenheit: expect.any(Number) } }],
        "MANUAL",
      );
      expect(polling.refreshZone).toHaveBeenCalledWith(10, 3);
    });

    it("does nothing if homeId/zoneId not set", async () => {
      const ev = createMockKeyEvent({ homeId: "", zoneId: "", unit: "celsius", temperature: 20 });
      await action.onKeyDown(ev);

      expect(manager.api.getZoneOverlay).not.toHaveBeenCalled();
    });
  });

  describe("onDialDown - toggle via dial press", () => {
    it("delegates to same toggle logic as keyDown", async () => {
      manager.api.getZoneOverlay.mockRejectedValue(new Error("404"));
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const settings = { homeId: "1", zoneId: "2", unit: "celsius" as const, temperature: 21 };
      const ev = createMockDialEvent(settings);
      await action.onDialDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalled();
    });
  });

  describe("onDialRotate", () => {
    it("adjusts temperature by 0.5°C per tick (celsius)", async () => {
      const settings = { homeId: "1", zoneId: "2", unit: "celsius" as const, temperature: 20 };
      const ev = createMockDialEvent(settings, { ticks: 2 });
      await action.onDialRotate(ev as any);

      expect(ev.action.setSettings).toHaveBeenCalledWith({ ...settings, temperature: 21 });
    });

    it("adjusts temperature by 1°F per tick (fahrenheit)", async () => {
      const settings = { homeId: "1", zoneId: "2", unit: "fahrenheit" as const, temperature: 68 };
      const ev = createMockDialEvent(settings, { ticks: 3 });
      await action.onDialRotate(ev as any);

      expect(ev.action.setSettings).toHaveBeenCalledWith({ ...settings, temperature: 71 });
    });

    it("clamps temperature to max 25°C", async () => {
      const settings = { homeId: "1", zoneId: "2", unit: "celsius" as const, temperature: 24.5 };
      const ev = createMockDialEvent(settings, { ticks: 5 });
      await action.onDialRotate(ev as any);

      expect(ev.action.setSettings).toHaveBeenCalledWith({ ...settings, temperature: 25 });
    });
  });

  describe("display update", () => {
    it("shows temperature and ON state on key", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 20 });
      await action.onWillAppear(ev);
      capturedCallback!(1, 2, MOCK_ZONE_STATE);

      expect(ev.action.setTitle).toHaveBeenCalledWith("21.5°C");
      expect(ev.action.setState).toHaveBeenCalledWith(0); // ON = state 0
    });

    it("shows status on dial feedback", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 20 });
      await action.onWillAppear(ev);
      capturedCallback!(1, 2, MOCK_ZONE_STATE);

      expect(ev.action.setFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ value: "21.5°C", status: "ON" }),
      );
    });
  });
});
