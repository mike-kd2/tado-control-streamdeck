import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
}));

import { ScheduleStatus } from "./schedule-status";
import { createMockManager, createMockKeyEvent, createMockDialEvent } from "./__test-helpers";

describe("ScheduleStatus", () => {
  let action: ScheduleStatus;
  let manager: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = createMockManager();
    action = new ScheduleStatus(manager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockBlocks = [
    { dayType: "MONDAY_TO_SUNDAY", start: "06:00", setting: { temperature: { celsius: 20, fahrenheit: 68 } } },
    { dayType: "MONDAY_TO_SUNDAY", start: "09:00", setting: { temperature: { celsius: 17, fahrenheit: 62.6 } } },
    { dayType: "MONDAY_TO_SUNDAY", start: "16:00", setting: { temperature: { celsius: 22, fahrenheit: 71.6 } } },
    { dayType: "MONDAY_TO_SUNDAY", start: "22:00", setting: { temperature: { celsius: 16, fahrenheit: 60.8 } } },
  ];

  function setupScheduleMocks() {
    manager.api.getTimeTables.mockResolvedValue({ id: 0, type: "ONE_DAY" });
    manager.api.getTimeTable.mockResolvedValue(mockBlocks);
  }

  describe("onWillAppear", () => {
    it("shows current schedule block on key", async () => {
      setupScheduleMocks();
      // Set time to 10:00 on a Wednesday
      vi.setSystemTime(new Date(2026, 1, 25, 10, 0));

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev);

      // At 10:00, the 09:00 block (17°C) should be active, next is 16:00
      expect(ev.action.setTitle).toHaveBeenCalledWith("17°C\nbis 16:00");
    });

    it("shows fahrenheit when configured", async () => {
      setupScheduleMocks();
      vi.setSystemTime(new Date(2026, 1, 25, 10, 0));

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "2", unit: "fahrenheit" });
      await action.onWillAppear(ev);

      expect(ev.action.setTitle).toHaveBeenCalledWith("62.6°F\nbis 16:00");
    });

    it("shows schedule on dial feedback", async () => {
      setupScheduleMocks();
      vi.setSystemTime(new Date(2026, 1, 25, 10, 0));

      const ev = createMockDialEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        value: "17°C",
        title: "bis 16:00",
      });
    });

    it("starts 15min polling interval", async () => {
      setupScheduleMocks();
      vi.setSystemTime(new Date(2026, 1, 25, 10, 0));

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev);

      manager.api.getTimeTables.mockClear();
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

      expect(manager.api.getTimeTables).toHaveBeenCalled();
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling", async () => {
      setupScheduleMocks();
      vi.setSystemTime(new Date(2026, 1, 25, 10, 0));

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev);
      action.onWillDisappear(ev as any);

      manager.api.getTimeTables.mockClear();
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      expect(manager.api.getTimeTables).not.toHaveBeenCalled();
    });
  });

  describe("schedule block calculation", () => {
    it("finds correct block for early morning", async () => {
      setupScheduleMocks();
      vi.setSystemTime(new Date(2026, 1, 25, 7, 30));

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev);

      // At 07:30, the 06:00 block (20°C) should be active, next is 09:00
      expect(ev.action.setTitle).toHaveBeenCalledWith("20°C\nbis 09:00");
    });

    it("finds correct block for late evening", async () => {
      setupScheduleMocks();
      vi.setSystemTime(new Date(2026, 1, 25, 23, 0));

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev);

      // At 23:00, the 22:00 block (16°C) should be active, no next block
      expect(ev.action.setTitle).toHaveBeenCalledWith("16°C\nbis —");
    });
  });

  describe("error handling", () => {
    it("does nothing when homeId/zoneId missing", async () => {
      const ev = createMockKeyEvent({});
      await action.onWillAppear(ev);

      expect(manager.api.getTimeTables).not.toHaveBeenCalled();
    });

    it("handles API error silently", async () => {
      manager.api.getTimeTables.mockRejectedValue(new Error("fail"));

      const ev = createMockKeyEvent({ homeId: "1", zoneId: "2", unit: "celsius" });
      await action.onWillAppear(ev);

      // Should not throw, should not call setTitle
      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });
  });
});
