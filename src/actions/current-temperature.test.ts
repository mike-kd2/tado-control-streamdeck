import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
}));

import { CurrentTemperature } from "./current-temperature";
import {
  createMockManager,
  createMockPolling,
  createMockKeyEvent,
  createMockDialEvent,
  MOCK_ZONE_STATE,
  MOCK_ZONE_STATE_NO_OVERLAY,
} from "./__test-helpers";

describe("CurrentTemperature", () => {
  let action: CurrentTemperature;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    manager = createMockManager();
    polling = createMockPolling();
    action = new CurrentTemperature(manager, polling);
  });

  describe("onWillAppear", () => {
    it("registers zone with polling service", async () => {
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "5", unit: "celsius" });
      await action.onWillAppear(ev);

      expect(polling.registerZone).toHaveBeenCalledWith(1, 5);
    });

    it("subscribes to polling updates", async () => {
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "5", unit: "celsius" });
      await action.onWillAppear(ev);

      expect(polling.onUpdate).toHaveBeenCalledWith(expect.any(Function));
    });

    it("shows cached data immediately", async () => {
      polling.getCached.mockReturnValue(MOCK_ZONE_STATE);
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "5", unit: "celsius" });
      await action.onWillAppear(ev);

      expect(ev.action.setTitle).toHaveBeenCalledWith("21.5°C\n55%");
    });

    it("does nothing if homeId/zoneId not configured", async () => {
      const ev = createMockKeyEvent({});
      await action.onWillAppear(ev);

      expect(polling.registerZone).not.toHaveBeenCalled();
    });
  });

  describe("onWillDisappear", () => {
    it("unregisters zone from polling", async () => {
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "5", unit: "celsius" });

      // First appear so unsubscribe is set
      await action.onWillAppear(ev);
      action.onWillDisappear(ev as any);

      expect(polling.unregisterZone).toHaveBeenCalledWith(1, 5);
    });

    it("calls unsubscribe on disappear", async () => {
      const unsubFn = vi.fn();
      polling.onUpdate.mockReturnValue(unsubFn);

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "5", unit: "celsius" });
      await action.onWillAppear(ev);
      action.onWillDisappear(ev as any);

      expect(unsubFn).toHaveBeenCalled();
    });
  });

  describe("display update via polling callback", () => {
    it("updates key display with temperature and humidity", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 3, MOCK_ZONE_STATE);

      expect(ev.action.setTitle).toHaveBeenCalledWith("21.5°C\n55%");
    });

    it("updates dial display with temperature and humidity", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockDialEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 3, MOCK_ZONE_STATE);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        value: "21.5°C",
        title: "55%",
        indicator: expect.any(Number),
      });
    });

    it("displays fahrenheit when configured", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "fahrenheit" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 3, MOCK_ZONE_STATE);

      expect(ev.action.setTitle).toHaveBeenCalledWith("70.7°F\n55%");
    });

    it("shows temp without humidity if not available", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 3, { sensorDataPoints: { insideTemperature: { celsius: 20 } } });

      expect(ev.action.setTitle).toHaveBeenCalledWith("20.0°C");
    });

    it("ignores updates for other zones", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 99, MOCK_ZONE_STATE);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });
  });

  describe("onSendToPlugin", () => {
    it("sends home list on getHomes event", async () => {
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      ev.payload.event = "getHomes";
      await action.onSendToPlugin!(ev);

      expect(manager.api.getMe).toHaveBeenCalled();
      expect(ev.action.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "getHomes",
        items: [{ label: "Home", value: 1 }],
      });
    });

    it("sends zone list on getZones event", async () => {
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      ev.payload.event = "getZones";
      await action.onSendToPlugin!(ev);

      expect(manager.api.getZones).toHaveBeenCalledWith(1);
      expect(ev.action.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "getZones",
        items: [
          { label: "Living Room", value: 1 },
          { label: "Kitchen", value: 2 },
        ],
      });
    });
  });

  describe("onDidReceiveSettings", () => {
    it("sends zones when homeId set but no zoneId", async () => {
      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onDidReceiveSettings!(ev);

      expect(manager.api.getZones).toHaveBeenCalledWith(1);
    });

    it("does not send zones when both homeId and zoneId set", async () => {
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3" });
      await action.onDidReceiveSettings!(ev);

      expect(manager.api.getZones).not.toHaveBeenCalled();
    });
  });
});
