import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
}));

import { QuickPreset } from "./quick-preset";
import { createMockManager, createMockPolling, createMockKeyEvent } from "./__test-helpers";

describe("QuickPreset", () => {
  let action: QuickPreset;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    manager = createMockManager();
    polling = createMockPolling();
    action = new QuickPreset(manager, polling);
  });

  describe("onKeyDown", () => {
    it("applies preset temperature to all zones atomically", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1", presetTemperature: 22, terminationType: "MANUAL" });
      await action.onKeyDown(ev);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([
          expect.objectContaining({ power: "ON", zone_id: 1 }),
          expect.objectContaining({ power: "ON", zone_id: 2 }),
        ]),
        "MANUAL",
      );
    });

    it("sets power OFF when temp is 5°C or below (frost protection)", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1", presetTemperature: 5, terminationType: "MANUAL" });
      await action.onKeyDown(ev);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([
          expect.objectContaining({ power: "OFF" }),
        ]),
        "MANUAL",
      );
    });

    it("uses NEXT_TIME_BLOCK termination type", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1", presetTemperature: 20, terminationType: "NEXT_TIME_BLOCK" });
      await action.onKeyDown(ev);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(1, expect.any(Array), "NEXT_TIME_BLOCK");
    });

    it("uses numeric termination type as seconds", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1", presetTemperature: 20, terminationType: "3600" });
      await action.onKeyDown(ev);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(1, expect.any(Array), 3600);
    });

    it("defaults to 22°C when no temperature set", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1", terminationType: "MANUAL" });
      await action.onKeyDown(ev);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([
          expect.objectContaining({ temperature: expect.objectContaining({ celsius: 22 }) }),
        ]),
        "MANUAL",
      );
    });

    it("shows OK after success and refreshes zones", async () => {
      manager.api.setZoneOverlays.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1", presetTemperature: 22, terminationType: "MANUAL" });
      await action.onKeyDown(ev);

      expect(ev.action.showOk).toHaveBeenCalled();
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 1);
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("shows alert on error", async () => {
      manager.api.getZones.mockRejectedValue(new Error("fail"));

      const ev = createMockKeyEvent({ homeId: "1", presetTemperature: 22, terminationType: "MANUAL" });
      await action.onKeyDown(ev);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });
  });
});
