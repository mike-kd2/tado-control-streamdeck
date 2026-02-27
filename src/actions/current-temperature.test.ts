import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockManager, createMockPolling, createMockEvent, createMockZoneState } from "../test-utils";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, ui: { sendToPropertyInspector: vi.fn().mockResolvedValue(undefined) } },
}));

vi.mock("node-tado-client", () => ({}));

import streamDeck from "@elgato/streamdeck";

import { CurrentTemperature } from "./current-temperature";

describe("CurrentTemperature", () => {
  let action: CurrentTemperature;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = createMockManager();
    polling = createMockPolling();
    action = new CurrentTemperature(manager as any, polling as any);
  });

  describe("onWillAppear", () => {
    it("registers zone and subscribes to updates", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev as any);

      expect(polling.registerZone).toHaveBeenCalledWith(1, 2);
      expect(polling.onUpdate).toHaveBeenCalled();
    });

    it("does nothing when homeId is missing", async () => {
      const ev = createMockEvent({ zoneId: "2" });
      await action.onWillAppear(ev as any);
      expect(polling.registerZone).not.toHaveBeenCalled();
    });

    it("does nothing when zoneId is missing", async () => {
      const ev = createMockEvent({ homeId: "1" });
      await action.onWillAppear(ev as any);
      expect(polling.registerZone).not.toHaveBeenCalled();
    });

    it("shows cached data immediately when available", async () => {
      const cached = createMockZoneState();
      polling.getCached.mockReturnValue(cached);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;base64,/));
    });

    it("shows temperature without humidity when not available", async () => {
      const cached = createMockZoneState({ sensorDataPoints: { insideTemperature: { celsius: 20, fahrenheit: 68 } } });
      polling.getCached.mockReturnValue(cached);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;base64,/));
    });
  });

  describe("onWillDisappear", () => {
    it("unsubscribes and unregisters zone", async () => {
      const unsubscribe = vi.fn();
      polling.onUpdate.mockReturnValue(unsubscribe);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);

      expect(unsubscribe).toHaveBeenCalled();
      expect(polling.unregisterZone).toHaveBeenCalledWith(1, 2);
    });

    it("handles missing settings gracefully", () => {
      const ev = createMockEvent({});
      action.onWillDisappear(ev as any);
      expect(polling.unregisterZone).not.toHaveBeenCalled();
    });
  });

  describe("update callback", () => {
    it("updates display on key with celsius", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneState());

      expect(ev.action.setImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;base64,/));
    });

    it("updates display on key with fahrenheit", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "fahrenheit" }, "Keypad");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneState());

      expect(ev.action.setImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;base64,/));
    });

    it("updates display on dial with feedback", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneState());

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        value: "21.5°C",
        title: "55%",
        indicator: expect.any(Number),
      });
    });

    it("ignores updates for other zones", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      ev.action.setImage.mockClear();
      callback(1, 99, createMockZoneState());

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });
  });

  describe("onSendToPlugin", () => {
    it("sends homes list on getHomes event", async () => {
      const ev = createMockEvent({});
      ev.payload.event = "getHomes";
      await action.onSendToPlugin(ev as any);

      expect(manager.api.getMe).toHaveBeenCalled();
      expect((streamDeck as any).ui.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "getHomes",
        items: [{ label: "Home", value: 1 }],
      });
    });

    it("sends zones list on getZones event", async () => {
      const ev = createMockEvent({ homeId: "1" });
      ev.payload.event = "getZones";
      await action.onSendToPlugin(ev as any);

      expect(manager.api.getZones).toHaveBeenCalledWith(1);
      expect((streamDeck as any).ui.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "getZones",
        items: [
          { label: "Living Room", value: 1 },
          { label: "Bedroom", value: 2 },
        ],
      });
    });
  });
});
