import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
}));

import { PowerAllOff } from "./off";
import { createMockManager, createMockPolling, createMockKeyEvent } from "./__test-helpers";

describe("PowerAllOff", () => {
  let action: PowerAllOff;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    manager = createMockManager();
    polling = createMockPolling();
    action = new PowerAllOff(manager, polling);
  });

  describe("onKeyDown", () => {
    it("turns off all zones with frost protection (5°C)", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [
          expect.objectContaining({ power: "OFF", zone_id: 1, temperature: { celsius: 5, fahrenheit: 41 } }),
          expect.objectContaining({ power: "OFF", zone_id: 2, temperature: { celsius: 5, fahrenheit: 41 } }),
        ],
        "MANUAL",
      );
    });

    it("shows OK after success", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("calls refreshZone for all zones", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(polling.refreshZone).toHaveBeenCalledWith(1, 1);
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("shows alert on error", async () => {
      manager.api.getZones.mockRejectedValue(new Error("fail"));

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
