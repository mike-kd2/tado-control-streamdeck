import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockManager, createMockPolling, createMockEvent } from "../test-utils";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, ui: { sendToPropertyInspector: vi.fn().mockResolvedValue(undefined) } },
}));

vi.mock("node-tado-client", () => ({}));

import streamDeck from "@elgato/streamdeck";

import { QuickPreset } from "./quick-preset";

describe("QuickPreset", () => {
  let action: QuickPreset;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = createMockManager();
    polling = createMockPolling();
    action = new QuickPreset(manager as any, polling as any);
  });

  describe("onKeyDown", () => {
    it("sets zone overlays with correct temperature", async () => {
      const ev = createMockEvent({ homeId: "1", presetName: "Heat", presetTemperature: 22, terminationType: "MANUAL" });
      await action.onKeyDown(ev as any);

      expect(manager.api.getZones).toHaveBeenCalledWith(1);
      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [
          expect.objectContaining({ power: "ON", zone_id: 1, temperature: expect.objectContaining({ celsius: 22 }) }),
          expect.objectContaining({ power: "ON", zone_id: 2, temperature: expect.objectContaining({ celsius: 22 }) }),
        ],
        "MANUAL",
      );
    });

    it("uses NEXT_TIME_BLOCK termination", async () => {
      const ev = createMockEvent({ homeId: "1", presetTemperature: 20, terminationType: "NEXT_TIME_BLOCK" });
      await action.onKeyDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(1, expect.any(Array), "NEXT_TIME_BLOCK");
    });

    it("uses numeric termination (seconds)", async () => {
      const ev = createMockEvent({ homeId: "1", presetTemperature: 20, terminationType: "3600" });
      await action.onKeyDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(1, expect.any(Array), 3600);
    });

    it("defaults to MANUAL for invalid termination", async () => {
      const ev = createMockEvent({ homeId: "1", presetTemperature: 20, terminationType: "invalid" });
      await action.onKeyDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(1, expect.any(Array), "MANUAL");
    });

    it("sets power OFF when temperature <= 5", async () => {
      const ev = createMockEvent({ homeId: "1", presetTemperature: 5, terminationType: "MANUAL" });
      await action.onKeyDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [
          expect.objectContaining({ power: "OFF" }),
          expect.objectContaining({ power: "OFF" }),
        ],
        "MANUAL",
      );
    });

    it("defaults to 22C when no temperature set", async () => {
      const ev = createMockEvent({ homeId: "1", presetTemperature: 0, terminationType: "MANUAL" });
      await action.onKeyDown(ev as any);

      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([expect.objectContaining({ temperature: expect.objectContaining({ celsius: 22 }) })]),
        "MANUAL",
      );
    });

    it("shows OK after success", async () => {
      const ev = createMockEvent({ homeId: "1", presetTemperature: 22, terminationType: "MANUAL" });
      await action.onKeyDown(ev as any);
      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("refreshes all zones after preset", async () => {
      const ev = createMockEvent({ homeId: "1", presetTemperature: 22, terminationType: "MANUAL" });
      await action.onKeyDown(ev as any);

      expect(polling.refreshZone).toHaveBeenCalledWith(1, 1);
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("shows alert on error", async () => {
      manager.api.getZones.mockRejectedValue(new Error("API error"));
      const ev = createMockEvent({ homeId: "1", presetTemperature: 22, terminationType: "MANUAL" });
      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("does nothing when homeId missing", async () => {
      const ev = createMockEvent({ presetTemperature: 22 });
      await action.onKeyDown(ev as any);
      expect(manager.api.getZones).not.toHaveBeenCalled();
    });
  });

  describe("onSendToPlugin", () => {
    it("sends homes list on getHomes event", async () => {
      const ev = createMockEvent({});
      ev.payload.event = "getHomes";
      await action.onSendToPlugin(ev as any);

      expect((streamDeck as any).ui.sendToPropertyInspector).toHaveBeenCalledWith({
        event: "getHomes",
        items: [{ label: "Home", value: 1 }],
      });
    });
  });
});
