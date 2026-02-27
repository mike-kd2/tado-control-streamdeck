import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockManager, createMockEvent } from "../test-utils";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, ui: { sendToPropertyInspector: vi.fn().mockResolvedValue(undefined) } },
}));

vi.mock("node-tado-client", () => ({}));

import streamDeck from "@elgato/streamdeck";

import { PresenceStatus } from "./presence-status";

describe("PresenceStatus", () => {
  let action: PresenceStatus;
  let manager: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    manager = createMockManager();
    action = new PresenceStatus(manager as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("onWillAppear", () => {
    it("fetches and shows presence immediately", async () => {
      manager.api.getState.mockResolvedValue({ presence: "HOME" });
      const ev = createMockEvent({ homeId: "1" }, "Keypad");

      await action.onWillAppear(ev as any);

      expect(manager.api.getState).toHaveBeenCalledWith(1);
      expect(ev.action.setState).toHaveBeenCalledWith(0);
      expect(ev.action.setTitle).toHaveBeenCalledWith("HOME");
    });

    it("shows AWAY state correctly", async () => {
      manager.api.getState.mockResolvedValue({ presence: "AWAY" });
      const ev = createMockEvent({ homeId: "1" }, "Keypad");

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(1);
      expect(ev.action.setTitle).toHaveBeenCalledWith("AWAY");
    });

    it("shows feedback on dial", async () => {
      manager.api.getState.mockResolvedValue({ presence: "HOME" });
      const ev = createMockEvent({ homeId: "1" }, "Encoder");

      await action.onWillAppear(ev as any);

      expect(ev.action.setFeedback).toHaveBeenCalledWith({
        value: "HOME",
        title: "Presence",
      });
    });

    it("sets up 5-minute polling interval", async () => {
      manager.api.getState.mockResolvedValue({ presence: "HOME" });
      const ev = createMockEvent({ homeId: "1" }, "Keypad");

      await action.onWillAppear(ev as any);
      manager.api.getState.mockClear();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(manager.api.getState).toHaveBeenCalled();
    });
  });

  describe("onWillDisappear", () => {
    it("clears polling interval", async () => {
      manager.api.getState.mockResolvedValue({ presence: "HOME" });
      const ev = createMockEvent({ homeId: "1" }, "Keypad");
      await action.onWillAppear(ev as any);

      action.onWillDisappear(ev as any);
      manager.api.getState.mockClear();

      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      expect(manager.api.getState).not.toHaveBeenCalled();
    });
  });

  describe("onKeyDown", () => {
    it("toggles from HOME to AWAY", async () => {
      manager.api.getState.mockResolvedValue({ presence: "HOME" });
      const ev = createMockEvent({ homeId: "1" }, "Keypad");

      await action.onKeyDown(ev as any);

      expect(manager.api.setPresence).toHaveBeenCalledWith(1, "AWAY");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
      expect(ev.action.setTitle).toHaveBeenCalledWith("AWAY");
      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("toggles from AWAY to HOME", async () => {
      manager.api.getState.mockResolvedValue({ presence: "AWAY" });
      const ev = createMockEvent({ homeId: "1" }, "Keypad");

      await action.onKeyDown(ev as any);

      expect(manager.api.setPresence).toHaveBeenCalledWith(1, "HOME");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
      expect(ev.action.setTitle).toHaveBeenCalledWith("HOME");
    });

    it("shows alert on error", async () => {
      manager.api.getState.mockRejectedValue(new Error("API error"));
      const ev = createMockEvent({ homeId: "1" }, "Keypad");

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("does nothing when homeId missing", async () => {
      const ev = createMockEvent({}, "Keypad");
      await action.onKeyDown(ev as any);
      expect(manager.api.getState).not.toHaveBeenCalled();
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
  });
});
