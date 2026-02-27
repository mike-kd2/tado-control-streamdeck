import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockManager, createMockPolling, createMockEvent } from "../test-utils";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, ui: { sendToPropertyInspector: vi.fn().mockResolvedValue(undefined) } },
}));

vi.mock("node-tado-client", () => ({}));

import streamDeck from "@elgato/streamdeck";

import { Boost } from "./boost";

describe("Boost", () => {
  let action: Boost;
  let manager: ReturnType<typeof createMockManager>;
  let polling: ReturnType<typeof createMockPolling>;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = createMockManager();
    polling = createMockPolling();
    action = new Boost(manager as any, polling as any);
  });

  describe("onKeyDown", () => {
    it("sets all zones to boost (25C, 30 min)", async () => {
      const ev = createMockEvent({ homeId: "1" });
      await action.onKeyDown(ev as any);

      expect(manager.api.getZones).toHaveBeenCalledWith(1);
      expect(manager.api.setZoneOverlays).toHaveBeenCalledWith(
        1,
        [
          expect.objectContaining({ power: "ON", isBoost: true, zone_id: 1, temperature: { celsius: 25, fahrenheit: 77 } }),
          expect.objectContaining({ power: "ON", isBoost: true, zone_id: 2, temperature: { celsius: 25, fahrenheit: 77 } }),
        ],
        1800,
      );
    });

    it("shows OK after success", async () => {
      const ev = createMockEvent({ homeId: "1" });
      await action.onKeyDown(ev as any);
      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("refreshes all zones after boost", async () => {
      const ev = createMockEvent({ homeId: "1" });
      await action.onKeyDown(ev as any);

      expect(polling.refreshZone).toHaveBeenCalledWith(1, 1);
      expect(polling.refreshZone).toHaveBeenCalledWith(1, 2);
    });

    it("shows alert on error", async () => {
      manager.api.getZones.mockRejectedValue(new Error("API error"));
      const ev = createMockEvent({ homeId: "1" });
      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("does nothing when homeId missing", async () => {
      const ev = createMockEvent({});
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
