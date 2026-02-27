import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
}));

import { Boost } from "./boost";
import { createMockManager, createMockPolling, createMockKeyEvent } from "./__test-helpers";

describe("Boost", () => {
  let action: Boost;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    manager = createMockManager();
    polling = createMockPolling();
    action = new Boost(manager, polling);
  });

  describe("onKeyDown", () => {
    it("boosts all zones to 25°C for 1800 seconds", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(manager.api.getZones).toHaveBeenCalledWith(1);
      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [
          expect.objectContaining({ power: "ON", zone_id: 1, temperature: { celsius: 25, fahrenheit: 77 } }),
          expect.objectContaining({ power: "ON", zone_id: 2, temperature: { celsius: 25, fahrenheit: 77 } }),
        ],
        1800,
      );
    });

    it("shows OK after success", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("calls refreshZone for all zones after boost", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(polling.refreshZone).toHaveBeenCalledWith(1, 1);
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("shows alert on error", async () => {
      manager.api.getZones.mockRejectedValue(new Error("API error"));

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("does nothing without homeId", async () => {
      const ev = createMockKeyEvent({});
      await action.onKeyDown(ev);

      expect(manager.api.getZones).not.toHaveBeenCalled();
    });
  });
});
