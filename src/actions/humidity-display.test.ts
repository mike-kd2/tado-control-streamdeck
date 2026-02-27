import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockManager, createMockPolling, createMockEvent, createMockZoneState } from "../test-utils";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, ui: { sendToPropertyInspector: vi.fn().mockResolvedValue(undefined) } },
}));

vi.mock("node-tado-client", () => ({}));

import streamDeck from "@elgato/streamdeck";

import { HumidityDisplay } from "./humidity-display";

describe("HumidityDisplay", () => {
  let action: HumidityDisplay;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = createMockManager();
    polling = createMockPolling();
    action = new HumidityDisplay(manager as any, polling as any);
  });

  describe("onWillAppear", () => {
    it("registers zone and subscribes", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
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
      const ev = createMockEvent({ homeId: "1", zoneId: "2" }, "Keypad");
      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("55%");
    });
  });

  describe("onWillDisappear", () => {
    it("unsubscribes and unregisters", async () => {
      const unsub = vi.fn();
      polling.onUpdate.mockReturnValue(unsub);

      const ev = createMockEvent({ homeId: "1", zoneId: "2" });
      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);

      expect(unsub).toHaveBeenCalled();
      expect(polling.unregisterZone).toHaveBeenCalledWith(1, 2);
    });
  });

  describe("update callback", () => {
    it("shows humidity percentage on key", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2" }, "Keypad");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneState());

      expect(ev.action.setTitle).toHaveBeenCalledWith("55%");
    });

    it("shows humidity on dial with feedback", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2" }, "Encoder");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneState());

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        value: "55%",
        title: "Humidity",
        indicator: 55,
      });
    });

    it("shows 0% when humidity missing", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2" }, "Keypad");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      callback(1, 2, createMockZoneState({ sensorDataPoints: {} }));

      expect(ev.action.setTitle).toHaveBeenCalledWith("0%");
    });

    it("ignores updates for other zones", async () => {
      const ev = createMockEvent({ homeId: "1", zoneId: "2" }, "Keypad");
      await action.onWillAppear(ev as any);

      const callback = polling.onUpdate.mock.calls[0][0];
      ev.action.setTitle.mockClear();
      callback(1, 99, createMockZoneState());

      expect(ev.action.setTitle).not.toHaveBeenCalled();
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
