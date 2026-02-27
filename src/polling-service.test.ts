import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @elgato/streamdeck before importing the module
vi.mock("@elgato/streamdeck", () => ({
  default: {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock("./utils/timeout", () => ({
  withTimeout: <T>(p: Promise<T>) => p,
}));

vi.mock("./tado-manager", () => ({
  TadoManager: {
    getInstance: vi.fn(),
  },
}));

import { PollingService } from "./polling-service";
import { TadoManager } from "./tado-manager";

function createFreshPollingService(): PollingService {
  // Access the private static instance and reset it
  (PollingService as any).instance = undefined;
  return PollingService.getInstance();
}

describe("PollingService", () => {
  let service: PollingService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = createFreshPollingService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("singleton", () => {
    it("returns the same instance", () => {
      const a = PollingService.getInstance();
      const b = PollingService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe("registerZone / unregisterZone", () => {
    it("starts polling when first zone is registered", () => {
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: {} }),
          getRatelimit: vi.fn().mockReturnValue(undefined),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      service.registerZone(1, 1);
      // The polling should have been started (pollAll called immediately)
      expect(mockManager.api.getZoneStates).toHaveBeenCalledWith(1);
    });

    it("stops polling when last zone is unregistered", () => {
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: {} }),
          getZoneState: vi.fn().mockResolvedValue({}),
          getRatelimit: vi.fn().mockReturnValue(undefined),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      service.registerZone(1, 1);
      service.unregisterZone(1, 1);

      // After unregistering, advancing timers should not trigger another poll
      mockManager.api.getZoneStates.mockClear();
      vi.advanceTimersByTime(120_000);
      expect(mockManager.api.getZoneStates).not.toHaveBeenCalled();
    });

    it("does not stop polling when other zones remain", () => {
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: {} }),
          getRatelimit: vi.fn().mockReturnValue(undefined),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      service.registerZone(1, 1);
      service.registerZone(1, 2);
      service.unregisterZone(1, 1);

      mockManager.api.getZoneStates.mockClear();
      vi.advanceTimersByTime(60_000);
      expect(mockManager.api.getZoneStates).toHaveBeenCalled();
    });
  });

  describe("onUpdate", () => {
    it("notifies listeners when zone data arrives", async () => {
      const mockState = { sensorDataPoints: { insideTemperature: { celsius: 21 } } };
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: { 1: mockState } }),
          getRatelimit: vi.fn().mockReturnValue(undefined),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      const listener = vi.fn();
      service.onUpdate(listener);
      service.registerZone(100, 1);

      // Allow the async poll to complete
      await vi.advanceTimersByTimeAsync(0);

      expect(listener).toHaveBeenCalledWith(100, 1, mockState);
    });

    it("returns unsubscribe function", async () => {
      const mockState = { sensorDataPoints: {} };
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: { 1: mockState } }),
          getRatelimit: vi.fn().mockReturnValue(undefined),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      const listener = vi.fn();
      const unsub = service.onUpdate(listener);
      service.registerZone(200, 1);
      await vi.advanceTimersByTimeAsync(0);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      listener.mockClear();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("getCached", () => {
    it("returns undefined for uncached zone", () => {
      expect(service.getCached(1, 1)).toBeUndefined();
    });

    it("returns cached state after poll", async () => {
      const mockState = { sensorDataPoints: { insideTemperature: { celsius: 22 } } };
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: { 5: mockState } }),
          getRatelimit: vi.fn().mockReturnValue(undefined),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      service.registerZone(10, 5);
      await vi.advanceTimersByTimeAsync(0);

      expect(service.getCached(10, 5)).toEqual(mockState);
    });
  });

  describe("refreshZone", () => {
    it("fetches a single zone and updates cache", async () => {
      const mockState = { sensorDataPoints: { insideTemperature: { celsius: 19 } } };
      const mockManager = {
        isReady: false,
        api: {
          getZoneState: vi.fn().mockResolvedValue(mockState),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      const result = await service.refreshZone(10, 3);
      expect(result).toEqual(mockState);
      expect(service.getCached(10, 3)).toEqual(mockState);
    });
  });

  describe("rate-limit throttling", () => {
    it("doubles poll interval when remaining < 100", async () => {
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: { 1: { sensorDataPoints: {} } } }),
          getRatelimit: vi.fn().mockReturnValue({ remaining: 50, limit: 1000 }),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      service.registerZone(1, 1);
      await vi.advanceTimersByTimeAsync(0);

      // Rate limit check should have been called
      expect(mockManager.api.getRatelimit).toHaveBeenCalled();

      // After throttling, at 60s (old interval) there should be no poll
      mockManager.api.getZoneStates.mockClear();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockManager.api.getZoneStates).not.toHaveBeenCalled();

      // At 120s (doubled interval) it should poll
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockManager.api.getZoneStates).toHaveBeenCalled();
    });

    it("does not throttle when rate limit is healthy", async () => {
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: { 1: { sensorDataPoints: {} } } }),
          getRatelimit: vi.fn().mockReturnValue({ remaining: 500, limit: 1000 }),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      service.registerZone(1, 1);
      await vi.advanceTimersByTimeAsync(0);

      mockManager.api.getZoneStates.mockClear();

      // At 60s it should poll (default interval maintained)
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockManager.api.getZoneStates).toHaveBeenCalled();
    });

    it("handles undefined rate limit gracefully", async () => {
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: {} }),
          getRatelimit: vi.fn().mockReturnValue(undefined),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      service.registerZone(1, 1);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockManager.api.getRatelimit).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("does not throw when listener errors", async () => {
      const mockState = { sensorDataPoints: {} };
      const mockManager = {
        isReady: true,
        api: {
          getZoneStates: vi.fn().mockResolvedValue({ zoneStates: { 1: mockState } }),
          getRatelimit: vi.fn().mockReturnValue(undefined),
        },
        handleApiError: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(TadoManager.getInstance).mockReturnValue(mockManager as any);

      service.onUpdate(() => {
        throw new Error("listener crash");
      });
      const goodListener = vi.fn();
      service.onUpdate(goodListener);

      service.registerZone(1, 1);
      await vi.advanceTimersByTimeAsync(0);

      // Good listener should still be called despite the first one throwing
      expect(goodListener).toHaveBeenCalled();
    });
  });
});
