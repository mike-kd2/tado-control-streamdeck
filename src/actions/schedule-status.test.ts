import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockManager, createMockEvent } from "../test-utils";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, ui: { sendToPropertyInspector: vi.fn().mockResolvedValue(undefined) } },
}));

vi.mock("node-tado-client", () => ({}));

import streamDeck from "@elgato/streamdeck";

import { ScheduleStatus } from "./schedule-status";

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

describe("ScheduleStatus", () => {
  let action: ScheduleStatus;
  let manager: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    manager = createMockManager();
    action = new ScheduleStatus(manager as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("onWillAppear", () => {
    it("fetches schedule and displays current block", async () => {
      const now = new Date("2026-02-27T14:00:00"); // Friday
      vi.setSystemTime(now);

      manager.api.getTimeTables.mockResolvedValue({ id: 0 });
      manager.api.getTimeTable.mockResolvedValue([
        { dayType: "FRIDAY", start: "06:00", setting: { temperature: { celsius: 20, fahrenheit: 68 } } },
        { dayType: "FRIDAY", start: "08:00", setting: { temperature: { celsius: 22, fahrenheit: 71.6 } } },
        { dayType: "FRIDAY", start: "18:00", setting: { temperature: { celsius: 19, fahrenheit: 66.2 } } },
      ]);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;base64,/));
    });

    it("handles MONDAY_TO_FRIDAY schedule", async () => {
      const now = new Date("2026-02-25T10:00:00"); // Wednesday
      vi.setSystemTime(now);

      manager.api.getTimeTables.mockResolvedValue({ id: 0 });
      manager.api.getTimeTable.mockResolvedValue([
        { dayType: "MONDAY_TO_FRIDAY", start: "06:00", setting: { temperature: { celsius: 20, fahrenheit: 68 } } },
        { dayType: "MONDAY_TO_FRIDAY", start: "18:00", setting: { temperature: { celsius: 17, fahrenheit: 62.6 } } },
      ]);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;base64,/));
    });

    it("handles MONDAY_TO_SUNDAY schedule", async () => {
      const now = new Date("2026-03-01T10:00:00"); // Sunday
      vi.setSystemTime(now);

      manager.api.getTimeTables.mockResolvedValue({ id: 0 });
      manager.api.getTimeTable.mockResolvedValue([
        { dayType: "MONDAY_TO_SUNDAY", start: "07:00", setting: { temperature: { celsius: 21, fahrenheit: 69.8 } } },
        { dayType: "MONDAY_TO_SUNDAY", start: "22:00", setting: { temperature: { celsius: 16, fahrenheit: 60.8 } } },
      ]);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;base64,/));
    });

    it("shows feedback on dial", async () => {
      const now = new Date("2026-02-27T14:00:00");
      vi.setSystemTime(now);

      manager.api.getTimeTables.mockResolvedValue({ id: 0 });
      manager.api.getTimeTable.mockResolvedValue([
        { dayType: "FRIDAY", start: "06:00", setting: { temperature: { celsius: 22, fahrenheit: 71.6 } } },
        { dayType: "FRIDAY", start: "18:00", setting: { temperature: { celsius: 19, fahrenheit: 66.2 } } },
      ]);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Encoder");
      await action.onWillAppear(ev as any);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        value: "22°C",
        title: "bis 18:00",
      });
    });

    it("sets up 15-minute polling interval", async () => {
      manager.api.getTimeTables.mockResolvedValue({ id: 0 });
      manager.api.getTimeTable.mockResolvedValue([]);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action.onWillAppear(ev as any);
      manager.api.getTimeTables.mockClear();

      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

      expect(manager.api.getTimeTables).toHaveBeenCalled();
    });

    it("uses fahrenheit when configured", async () => {
      const now = new Date("2026-02-27T14:00:00");
      vi.setSystemTime(now);

      manager.api.getTimeTables.mockResolvedValue({ id: 0 });
      manager.api.getTimeTable.mockResolvedValue([
        { dayType: "FRIDAY", start: "06:00", setting: { temperature: { celsius: 22, fahrenheit: 71.6 } } },
        { dayType: "FRIDAY", start: "18:00", setting: { temperature: { celsius: 19, fahrenheit: 66.2 } } },
      ]);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "fahrenheit" }, "Keypad");
      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;base64,/));
    });
  });

  describe("onWillDisappear", () => {
    it("clears polling interval", async () => {
      manager.api.getTimeTables.mockResolvedValue({ id: 0 });
      manager.api.getTimeTable.mockResolvedValue([]);

      const ev = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action.onWillAppear(ev as any);

      action.onWillDisappear(ev as any);
      manager.api.getTimeTables.mockClear();

      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
      expect(manager.api.getTimeTables).not.toHaveBeenCalled();
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
