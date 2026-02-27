import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
}));

import { PresenceStatus } from "./presence-status";
import { createMockManager, createMockKeyEvent } from "./__test-helpers";

describe("PresenceStatus", () => {
  let action: PresenceStatus;
  let manager: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = createMockManager();
    action = new PresenceStatus(manager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("onWillAppear", () => {
    it("displays current presence on key", async () => {
      manager.api.getState.mockResolvedValue({ presence: "HOME" });

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onWillAppear(ev);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
      expect(ev.action.setTitle).toHaveBeenCalledWith("HOME");
    });

    it("starts polling every 5 minutes", async () => {
      manager.api.getState.mockResolvedValue({ presence: "HOME" });

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onWillAppear(ev);

      manager.api.getState.mockResolvedValue({ presence: "AWAY" });
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(ev.action.setState).toHaveBeenCalledWith(1);
      expect(ev.action.setTitle).toHaveBeenCalledWith("AWAY");
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling interval", async () => {
      manager.api.getState.mockResolvedValue({ presence: "HOME" });

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onWillAppear(ev);
      action.onWillDisappear(ev as any);

      manager.api.getState.mockClear();
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

      expect(manager.api.getState).not.toHaveBeenCalled();
    });
  });

  describe("onKeyDown - toggle presence", () => {
    it("toggles from HOME to AWAY", async () => {
      manager.api.getState.mockResolvedValue({ presence: "HOME" });
      manager.api.setPresence.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(manager.api.setPresence).toHaveBeenCalledWith(1, "AWAY");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
      expect(ev.action.setTitle).toHaveBeenCalledWith("AWAY");
      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("toggles from AWAY to HOME", async () => {
      manager.api.getState.mockResolvedValue({ presence: "AWAY" });
      manager.api.setPresence.mockResolvedValue(undefined);

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(manager.api.setPresence).toHaveBeenCalledWith(1, "HOME");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("shows alert on error", async () => {
      manager.api.getState.mockRejectedValue(new Error("fail"));

      const ev = createMockKeyEvent({ homeId: "1" });
      await action.onKeyDown(ev);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("does nothing without homeId", async () => {
      const ev = createMockKeyEvent({});
      await action.onKeyDown(ev);

      expect(manager.api.getState).not.toHaveBeenCalled();
    });
  });
});
