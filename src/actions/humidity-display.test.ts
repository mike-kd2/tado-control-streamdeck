import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
}));

import { HumidityDisplay } from "./humidity-display";
import {
  createMockManager,
  createMockPolling,
  createMockKeyEvent,
  createMockDialEvent,
  MOCK_ZONE_STATE,
} from "./__test-helpers";

describe("HumidityDisplay", () => {
  let action: HumidityDisplay;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    manager = createMockManager();
    polling = createMockPolling();
    action = new HumidityDisplay(manager, polling);
  });

  describe("onWillAppear / onWillDisappear", () => {
    it("registers zone and subscribes to updates", async () => {
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);

      expect(polling.registerZone).toHaveBeenCalledWith(1, 3);
      expect(polling.onUpdate).toHaveBeenCalled();
    });

    it("unregisters zone on disappear", async () => {
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);
      action.onWillDisappear(ev as any);

      expect(polling.unregisterZone).toHaveBeenCalledWith(1, 3);
    });
  });

  describe("display update", () => {
    it("shows humidity percentage on key (no extra API call)", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 3, MOCK_ZONE_STATE);

      expect(ev.action.setTitle).toHaveBeenCalledWith("55%");
      expect(manager.api.getZoneState).not.toHaveBeenCalled();
    });

    it("shows humidity on dial feedback", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockDialEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 3, MOCK_ZONE_STATE);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        value: "55%",
        title: "Humidity",
        indicator: 55,
      });
    });

    it("shows 0% when humidity data is missing", async () => {
      let capturedCallback: Function;
      polling.onUpdate.mockImplementation((cb: Function) => {
        capturedCallback = cb;
        return vi.fn();
      });

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);
      capturedCallback!(1, 3, { sensorDataPoints: {} });

      expect(ev.action.setTitle).toHaveBeenCalledWith("0%");
    });

    it("shows cached data immediately on appear", async () => {
      polling.getCached.mockReturnValue(MOCK_ZONE_STATE);
      const ev = createMockKeyEvent({ homeId: "1", zoneId: "3", unit: "celsius" });
      await action.onWillAppear(ev);

      expect(ev.action.setTitle).toHaveBeenCalledWith("55%");
    });
  });
});
