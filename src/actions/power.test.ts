import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockManager, createMockPolling, createMockEvent, createMockZoneState, createMockZoneStateWithOverlay } from "../test-utils";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
}));

vi.mock("node-tado-client", () => ({}));

import { Power } from "./power";

describe("Power", () => {
  let action: Power;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = createMockManager();
    polling = createMockPolling();
    action = new Power(manager as any, polling as any);
  });

  describe("onWillAppear", () => {
    it("registers zone and subscribes", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 22 });
      await action.onWillAppear(ev as any);

      expect(polling.registerZone).toHaveBeenCalledWith(1, 2);
      expect(polling.onUpdate).toHaveBeenCalled();
    });

    it("skips when homeId/zoneId missing", async () => {
      await action.onWillAppear(createMockEvent({}) as any);
      expect(polling.registerZone).not.toHaveBeenCalled();
    });
  });

  describe("onWillDisappear", () => {
    it("unsubscribes and unregisters zone", async () => {
      const unsub = vi.fn();
      polling.onUpdate.mockReturnValue(unsub);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 22 });
      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);

      expect(unsub).toHaveBeenCalled();
      expect(polling.unregisterZone).toHaveBeenCalledWith(1, 2);
    });
  });

  describe("onKeyDown (toggle)", () => {
    it("clears overlay when overlay exists (turn off)", async () => {
      manager.api.getZoneOverlay.mockResolvedValue({ setting: { power: "ON" } });
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 22 });

      await action.onKeyDown(ev as any);

      expect(manager.api.clearZoneOverlays).toHaveBeenCalledWith(1, [2]);
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("creates overlay when no overlay exists (turn on)", async () => {
      manager.api.getZoneOverlay.mockRejectedValue(new Error("no overlay"));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 22 });

      await action.onKeyDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [{ power: "ON", zone_id: 2, temperature: { celsius: 22, fahrenheit: expect.any(Number) } }],
        "MANUAL",
      );
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("uses default temperature 20 when not set", async () => {
      manager.api.getZoneOverlay.mockRejectedValue(new Error("no overlay"));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 0 });

      await action.onKeyDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [expect.objectContaining({ temperature: expect.objectContaining({ celsius: 20 }) })],
        "MANUAL",
      );
    });

    it("skips when homeId missing", async () => {
      const ev = createMockEvent({ zoneId: "2" });
      await action.onKeyDown(ev as any);
      expect(manager.api.getZoneOverlay).not.toHaveBeenCalled();
    });
  });

  describe("onDialRotate", () => {
    it("adjusts temperature by 0.5C steps", async () => {
      const settings = { homeId: "1", zoneId: "2", unit: "celsius", temperature: 20 };
      const ev = createMockEvent(settings, "Encoder");
      ev.payload.ticks = 1;

      await action.onDialRotate(ev as any);

      expect(ev.action.setSettings).toHaveBeenCalledWith(expect.objectContaining({ temperature: 20.5 }));
    });

    it("adjusts temperature by 1F steps for fahrenheit", async () => {
      const settings = { homeId: "1", zoneId: "2", unit: "fahrenheit", temperature: 68 };
      const ev = createMockEvent(settings, "Encoder");
      ev.payload.ticks = 1;

      await action.onDialRotate(ev as any);

      expect(ev.action.setSettings).toHaveBeenCalledWith(expect.objectContaining({ temperature: 69 }));
    });

    it("clamps to max temperature", async () => {
      const settings = { homeId: "1", zoneId: "2", unit: "celsius", temperature: 25 };
      const ev = createMockEvent(settings, "Encoder");
      ev.payload.ticks = 5;

      await action.onDialRotate(ev as any);

      expect(ev.action.setSettings).toHaveBeenCalledWith(expect.objectContaining({ temperature: 25 }));
    });
  });

  describe("onDialDown (toggle)", () => {
    it("clears overlay when overlay exists", async () => {
      manager.api.getZoneOverlay.mockResolvedValue({ setting: { power: "ON" } });
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 22 });

      await action.onDialDown(ev as any);

      expect(manager.api.clearZoneOverlays).toHaveBeenCalledWith(1, [2]);
    });
  });

  describe("updateDisplay", () => {
    it("shows temperature and power state on key", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 22 }, "Keypad");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneStateWithOverlay("ON"));

      expect(ev.action.setTitle).toHaveBeenCalledWith("21.5°C");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("shows OFF state when no overlay", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 22 }, "Keypad");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneState());

      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("shows feedback on dial", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius", temperature: 22 }, "Encoder");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneStateWithOverlay("ON"));

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        value: "21.5°C",
        status: "ON",
        indicator: expect.any(Number),
      });
    });
  });
});
