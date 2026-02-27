import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockManager, createMockPolling, createMockEvent, createMockZoneState, createMockZoneStateWithOverlay, createMockBoostState } from "../test-utils";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, ui: { sendToPropertyInspector: vi.fn().mockResolvedValue(undefined) } },
}));

vi.mock("node-tado-client", () => ({}));

import streamDeck from "@elgato/streamdeck";

import { ZoneControl } from "./zone-control";

describe("ZoneControl", () => {
  let action: ZoneControl;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    manager = createMockManager();
    polling = createMockPolling();
    action = new ZoneControl(manager as any, polling as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("onWillAppear", () => {
    it("registers zone and subscribes", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      await action.onWillAppear(ev as any);

      expect(polling.registerZone).toHaveBeenCalledWith(1, 2);
      expect(polling.onUpdate).toHaveBeenCalled();
    });

    it("skips when settings missing", async () => {
      await action.onWillAppear(createMockEvent({}) as any);
      expect(polling.registerZone).not.toHaveBeenCalled();
    });

    it("shows cached data immediately", async () => {
      polling.getCached.mockReturnValue(createMockZoneState());
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      await action.onWillAppear(ev as any);

      expect(ev.action.setFeedback).toHaveBeenCalled();
    });
  });

  describe("onWillDisappear", () => {
    it("unsubscribes and unregisters", async () => {
      const unsub = vi.fn();
      polling.onUpdate.mockReturnValue(unsub);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);

      expect(unsub).toHaveBeenCalled();
      expect(polling.unregisterZone).toHaveBeenCalledWith(1, 2);
    });

    it("clears debounce timer", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      polling.getCached.mockReturnValue(createMockZoneStateWithOverlay("ON", { celsius: 20, fahrenheit: 68 }));
      await action.onWillAppear(ev as any);

      // Start a dial rotation (starts debounce timer)
      ev.payload.ticks = 1;
      await action.onDialRotate(ev as any);

      // Disappear before debounce fires
      action.onWillDisappear(ev as any);

      // Advance past debounce — should NOT trigger API call
      vi.advanceTimersByTime(500);
      expect(manager.api.setZoneOverlays).not.toHaveBeenCalled();
    });
  });

  describe("onDialRotate", () => {
    it("adjusts temperature by 0.5C steps", async () => {
      polling.getCached.mockReturnValue(createMockZoneStateWithOverlay("ON", { celsius: 20, fahrenheit: 68 }));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      ev.payload.ticks = 1;

      await action.onDialRotate(ev as any);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({ target: "20.5°C" });
    });

    it("adjusts temperature by 1F steps for fahrenheit", async () => {
      polling.getCached.mockReturnValue(createMockZoneStateWithOverlay("ON", { celsius: 20, fahrenheit: 68 }));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "fahrenheit" }, "Encoder");
      ev.payload.ticks = 1;

      await action.onDialRotate(ev as any);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({ target: "69.0°F" });
    });

    it("debounces API call for 300ms", async () => {
      polling.getCached.mockReturnValue(createMockZoneStateWithOverlay("ON", { celsius: 20, fahrenheit: 68 }));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      ev.payload.ticks = 1;

      await action.onDialRotate(ev as any);
      expect(manager.api.setZoneOverlays).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      await vi.advanceTimersByTimeAsync(0);

      expect(manager.api.setZoneOverlays).toHaveBeenCalled();
    });

    it("accumulates pending temp across multiple rotations", async () => {
      polling.getCached.mockReturnValue(createMockZoneStateWithOverlay("ON", { celsius: 20, fahrenheit: 68 }));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");

      ev.payload.ticks = 1;
      await action.onDialRotate(ev as any);
      ev.payload.ticks = 1;
      await action.onDialRotate(ev as any);

      // Should have accumulated: 20 + 0.5 + 0.5 = 21
      expect(ev.action.setFeedback).toHaveBeenLastCalledWith({ target: "21.0°C" });
    });

    it("clamps to min/max temperature", async () => {
      polling.getCached.mockReturnValue(createMockZoneStateWithOverlay("ON", { celsius: 25, fahrenheit: 77 }));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      ev.payload.ticks = 10;

      await action.onDialRotate(ev as any);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({ target: "25.0°C" });
    });

    it("skips when settings missing", async () => {
      const ev = createMockEvent({}, "Encoder");
      ev.payload.ticks = 1;
      await action.onDialRotate(ev as any);
      expect(ev.action.setFeedback).not.toHaveBeenCalled();
    });
  });

  describe("onDialDown", () => {
    it("clears overlay when overlay exists (resume schedule)", async () => {
      manager.api.getZoneOverlay.mockResolvedValue({ setting: { power: "ON" } });
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");

      await action.onDialDown(ev as any);

      expect(manager.api.clearZoneOverlays).toHaveBeenCalledWith(1, [2]);
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("creates manual overlay when no overlay exists", async () => {
      manager.api.getZoneOverlay.mockRejectedValue(new Error("no overlay"));
      polling.getCached.mockReturnValue(createMockZoneState());
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");

      await action.onDialDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [expect.objectContaining({ power: "ON", zone_id: 2 })],
        "MANUAL",
      );
    });

    it("shows alert on error", async () => {
      manager.api.getZoneOverlay.mockRejectedValue(new Error("no overlay"));
      manager.api.setZoneOverlays.mockRejectedValue(new Error("API error"));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");

      await action.onDialDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("skips when settings missing", async () => {
      const ev = createMockEvent({}, "Encoder");
      await action.onDialDown(ev as any);
      expect(manager.api.getZoneOverlay).not.toHaveBeenCalled();
    });
  });

  describe("onTouchTap", () => {
    it("decreases temp when tapping left half (<100px)", async () => {
      polling.getCached.mockReturnValue(createMockZoneStateWithOverlay("ON", { celsius: 20, fahrenheit: 68 }));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      ev.payload.tapPos = [50, 50]; // Left half

      await action.onTouchTap(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [expect.objectContaining({ temperature: expect.objectContaining({ celsius: 19.5 }) })],
        "MANUAL",
      );
    });

    it("increases temp when tapping right half (>=100px)", async () => {
      polling.getCached.mockReturnValue(createMockZoneStateWithOverlay("ON", { celsius: 20, fahrenheit: 68 }));
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      ev.payload.tapPos = [150, 50]; // Right half

      await action.onTouchTap(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [expect.objectContaining({ temperature: expect.objectContaining({ celsius: 20.5 }) })],
        "MANUAL",
      );
    });

    it("skips when settings missing", async () => {
      const ev = createMockEvent({}, "Encoder");
      await action.onTouchTap(ev as any);
      expect(manager.api.setZoneOverlays).not.toHaveBeenCalled();
    });
  });

  describe("dynamic layout switching", () => {
    it("uses schedule layout when no overlay", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneState());

      expect(ev.action.setFeedbackLayout).toHaveBeenCalledWith("layouts/zone-schedule-layout.json");
      expect(ev.action.setFeedback).toHaveBeenCalledWith(expect.objectContaining({ status: "Auto" }));
    });

    it("uses manual layout when overlay exists", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneStateWithOverlay("ON"));

      expect(ev.action.setFeedbackLayout).toHaveBeenCalledWith("layouts/zone-control-layout.json");
      expect(ev.action.setFeedback).toHaveBeenCalledWith(expect.objectContaining({ target: expect.any(String) }));
    });

    it("uses boost layout when boost overlay exists", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockBoostState());

      expect(ev.action.setFeedbackLayout).toHaveBeenCalledWith("layouts/zone-boost-layout.json");
      expect(ev.action.setFeedback).toHaveBeenCalledWith(expect.objectContaining({ status: "BOOST" }));
    });

    it("does not switch layout when mode unchanged", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneState());
      ev.action.setFeedbackLayout.mockClear();

      callback(1, 2, createMockZoneState());
      expect(ev.action.setFeedbackLayout).not.toHaveBeenCalled();
    });
  });

  describe("onSendToPlugin", () => {
    it("sends homes list", async () => {
      const ev = createMockEvent({});
      ev.payload.event = "getHomes";
      await action.onSendToPlugin(ev as any);

      expect((streamDeck as any).ui.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "getHomes",
        items: [{ label: "Home", value: 1 }],
      });
    });

    it("sends zones list", async () => {
      const ev = createMockEvent({ homeId: "1" });
      ev.payload.event = "getZones";
      await action.onSendToPlugin(ev as any);

      expect((streamDeck as any).ui.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "getZones",
        items: expect.any(Array),
      });
    });
  });
});
