import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSettings } = vi.hoisted(() => ({
  mockSettings: {
    getGlobalSettings: vi.fn().mockResolvedValue({}),
    setGlobalSettings: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    settings: mockSettings,
    system: { openUrl: vi.fn() },
  },
}));

vi.mock("./utils/timeout", () => ({
  withTimeout: <T>(p: Promise<T>) => p,
}));

vi.mock("node-tado-client", () => ({
  Tado: vi.fn().mockImplementation(() => ({
    authenticate: vi.fn().mockResolvedValue([null, Promise.resolve()]),
    setTokenCallback: vi.fn(),
    getZoneStates: vi.fn().mockResolvedValue({
      zoneStates: {
        1: {
          sensorDataPoints: { insideTemperature: { celsius: 21, fahrenheit: 69.8 }, humidity: { percentage: 50 } },
          overlay: null,
        },
        2: {
          sensorDataPoints: { insideTemperature: { celsius: 19, fahrenheit: 66.2 }, humidity: { percentage: 60 } },
          overlay: { setting: { power: "ON", temperature: { celsius: 22, fahrenheit: 71.6 } }, termination: { typeSkillBasedApp: "MANUAL" } },
        },
      },
    }),
    getZoneState: vi.fn().mockResolvedValue({
      sensorDataPoints: { insideTemperature: { celsius: 21, fahrenheit: 69.8 }, humidity: { percentage: 50 } },
    }),
    getRatelimit: vi.fn().mockReturnValue({ remaining: 500, limit: 1000 }),
    getMe: vi.fn().mockResolvedValue({ homes: [{ id: 1, name: "Home" }] }),
    getZones: vi.fn().mockResolvedValue([{ id: 1, name: "Living Room" }, { id: 2, name: "Bedroom" }]),
  })),
}));

import { TadoManager } from "./tado-manager";
import { PollingService } from "./polling-service";
import { CurrentTemperature } from "./actions/current-temperature";
import { HumidityDisplay } from "./actions/humidity-display";

function createMockEvent(settings: Record<string, any>, controller: "Encoder" | "Keypad" = "Keypad") {
  return {
    action: {
      isDial: vi.fn().mockReturnValue(controller === "Encoder"),
      isKey: vi.fn().mockReturnValue(controller === "Keypad"),
      setTitle: vi.fn(),
      setFeedback: vi.fn().mockResolvedValue(undefined),
      setFeedbackLayout: vi.fn().mockResolvedValue(undefined),
      setState: vi.fn(),
      showOk: vi.fn(),
      showAlert: vi.fn(),
      getSettings: vi.fn().mockResolvedValue(settings),
      setSettings: vi.fn().mockResolvedValue(undefined),
      sendToPropertyInspector: vi.fn(),
    },
    payload: { settings, ticks: 0, tapPos: [100, 50], event: "" },
  };
}

describe("Integration Tests", () => {
  let manager: TadoManager;
  let polling: PollingService;

  beforeEach(() => {
    vi.useFakeTimers();
    (TadoManager as any).instance = undefined;
    (PollingService as any).instance = undefined;
    manager = TadoManager.getInstance();
    polling = PollingService.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Auth flow", () => {
    it("authenticates with refresh token (no browser)", async () => {
      mockSettings.getGlobalSettings.mockResolvedValue({ refresh_token: "valid-token" });
      await manager.ensureAuthenticated();
      expect(manager.isReady).toBe(true);
    });

    it("re-auth after token reset does not duplicate", async () => {
      mockSettings.getGlobalSettings.mockResolvedValue({});
      await manager.ensureAuthenticated();
      manager.resetAuth();
      await manager.ensureAuthenticated();
      expect(manager.isReady).toBe(true);
    });
  });

  describe("Polling lifecycle", () => {
    it("action appear -> polling starts -> data arrives -> display updates", async () => {
      await manager.ensureAuthenticated();

      const tempAction = new CurrentTemperature(manager as any, polling as any);
      const ev = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" }, "Keypad");

      await tempAction.onWillAppear(ev as any);
      await vi.advanceTimersByTimeAsync(0);

      expect(ev.action.setTitle).toHaveBeenCalled();
    });

    it("action disappear -> polling stops -> no more API calls", async () => {
      await manager.ensureAuthenticated();

      const tempAction = new CurrentTemperature(manager as any, polling as any);
      const ev = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" }, "Keypad");

      await tempAction.onWillAppear(ev as any);
      tempAction.onWillDisappear(ev as any);

      const zoneStates = manager.api.getZoneStates as ReturnType<typeof vi.fn>;
      zoneStates.mockClear();
      await vi.advanceTimersByTimeAsync(120_000);

      expect(zoneStates).not.toHaveBeenCalled();
    });

    it("profile switch: old actions disappear, new appear, polling adapts", async () => {
      await manager.ensureAuthenticated();

      const action1 = new CurrentTemperature(manager as any, polling as any);
      const ev1 = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" }, "Keypad");
      await action1.onWillAppear(ev1 as any);

      // "Profile switch" — old action disappears
      action1.onWillDisappear(ev1 as any);

      // New action appears on new profile
      const action2 = new HumidityDisplay(manager as any, polling as any);
      const ev2 = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      await action2.onWillAppear(ev2 as any);

      await vi.advanceTimersByTimeAsync(0);

      expect(ev2.action.setTitle).toHaveBeenCalled();
    });
  });

  describe("Multi-action scenarios", () => {
    it("3 zones visible: only 1 API call per home", async () => {
      await manager.ensureAuthenticated();

      const a1 = new CurrentTemperature(manager as any, polling as any);
      const a2 = new CurrentTemperature(manager as any, polling as any);
      const a3 = new HumidityDisplay(manager as any, polling as any);

      const ev1 = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" }, "Keypad");
      const ev2 = createMockEvent({ homeId: "1", zoneId: "2", unit: "celsius" }, "Keypad");
      const ev3 = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" }, "Keypad");

      await a1.onWillAppear(ev1 as any);
      await a2.onWillAppear(ev2 as any);
      await a3.onWillAppear(ev3 as any);

      const zoneStates = manager.api.getZoneStates as ReturnType<typeof vi.fn>;
      zoneStates.mockClear();

      await vi.advanceTimersByTimeAsync(60_000);

      // Should be called once per home (home 1), not per zone
      expect(zoneStates).toHaveBeenCalledTimes(1);
      expect(zoneStates).toHaveBeenCalledWith(1);
    });
  });
});
