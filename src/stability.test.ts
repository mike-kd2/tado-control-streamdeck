import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
  action: () => (target: any) => target,
  SingletonAction: class {},
  default: {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    settings: {
      getGlobalSettings: vi.fn().mockResolvedValue({}),
      setGlobalSettings: vi.fn().mockResolvedValue(undefined),
    },
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
      zoneStates: { 1: { sensorDataPoints: { insideTemperature: { celsius: 21, fahrenheit: 69.8 }, humidity: { percentage: 50 } } } },
    }),
    getZoneState: vi.fn().mockResolvedValue({
      sensorDataPoints: { insideTemperature: { celsius: 21, fahrenheit: 69.8 }, humidity: { percentage: 50 } },
    }),
    getRatelimit: vi.fn().mockReturnValue({ remaining: 500, limit: 1000 }),
    getMe: vi.fn().mockResolvedValue({ homes: [{ id: 1, name: "Home" }] }),
    getZones: vi.fn().mockResolvedValue([{ id: 1, name: "Zone 1" }]),
  })),
}));

import { TadoManager } from "./tado-manager";
import { PollingService } from "./polling-service";
import { CurrentTemperature } from "./actions/current-temperature";

function createMockEvent(settings: Record<string, any>) {
  return {
    action: {
      isDial: vi.fn().mockReturnValue(false),
      isKey: vi.fn().mockReturnValue(true),
      setTitle: vi.fn(),
      setFeedback: vi.fn(),
      setFeedbackLayout: vi.fn(),
      setState: vi.fn(),
      showOk: vi.fn(),
      showAlert: vi.fn(),
      getSettings: vi.fn().mockResolvedValue(settings),
      setSettings: vi.fn(),
      sendToPropertyInspector: vi.fn(),
    },
    payload: { settings, ticks: 0, tapPos: [100, 50], event: "" },
  };
}

describe("Stability Tests", () => {
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

  it("no memory leak after 50x appear/disappear cycles", async () => {
    await manager.ensureAuthenticated();

    const action = new CurrentTemperature(manager as any, polling as any);

    for (let i = 0; i < 50; i++) {
      const ev = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" });
      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);
    }

    // After all cycles, no zones should be registered (polling stopped)
    const zoneStates = manager.api.getZoneStates as ReturnType<typeof vi.fn>;
    zoneStates.mockClear();
    await vi.advanceTimersByTimeAsync(70_000);
    expect(zoneStates).not.toHaveBeenCalled();
  });

  it("no unhandled rejection on network timeout", async () => {
    await manager.ensureAuthenticated();

    const action = new CurrentTemperature(manager as any, polling as any);
    const ev = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" });
    await action.onWillAppear(ev as any);

    // Simulate API failure
    (manager.api.getZoneStates as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("timeout"));
    (manager as any).handleApiError = vi.fn().mockResolvedValue(false);

    // Advance timer to trigger poll — should not throw
    await vi.advanceTimersByTimeAsync(60_000);

    // Action should still be functional
    action.onWillDisappear(ev as any);
  });

  it("correct cleanup on plugin stop (all intervals cleared)", async () => {
    await manager.ensureAuthenticated();

    const action = new CurrentTemperature(manager as any, polling as any);
    const ev = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" });

    await action.onWillAppear(ev as any);
    action.onWillDisappear(ev as any);

    // Verify no lingering timers cause issues
    const zoneStates = manager.api.getZoneStates as ReturnType<typeof vi.fn>;
    zoneStates.mockClear();
    await vi.advanceTimersByTimeAsync(70_000);
    expect(zoneStates).not.toHaveBeenCalled();
  });

  it("no double polling after rapid profile switch", async () => {
    await manager.ensureAuthenticated();

    const action = new CurrentTemperature(manager as any, polling as any);

    // Rapid appear/disappear/appear
    const ev1 = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" });
    await action.onWillAppear(ev1 as any);
    action.onWillDisappear(ev1 as any);

    const ev2 = createMockEvent({ homeId: "1", zoneId: "1", unit: "celsius" });
    await action.onWillAppear(ev2 as any);

    const zoneStates = manager.api.getZoneStates as ReturnType<typeof vi.fn>;
    zoneStates.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);

    // Should be called exactly once, not twice (no double polling)
    expect(zoneStates).toHaveBeenCalledTimes(1);
  });
});
