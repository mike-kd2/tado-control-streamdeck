import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSettings, mockSystem, mockAuthenticate, mockSetTokenCallback } = vi.hoisted(() => ({
  mockSettings: {
    getGlobalSettings: vi.fn(),
    setGlobalSettings: vi.fn(),
  },
  mockSystem: {
    openUrl: vi.fn(),
  },
  mockAuthenticate: vi.fn(),
  mockSetTokenCallback: vi.fn(),
}));

vi.mock("@elgato/streamdeck", () => ({
  default: {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    settings: mockSettings,
    system: mockSystem,
  },
}));

vi.mock("node-tado-client", () => ({
  Tado: vi.fn().mockImplementation(() => ({
    authenticate: mockAuthenticate,
    setTokenCallback: mockSetTokenCallback,
  })),
}));

import { TadoManager } from "./tado-manager";

function createFreshManager(): TadoManager {
  (TadoManager as any).instance = undefined;
  return TadoManager.getInstance();
}

describe("TadoManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.getGlobalSettings.mockResolvedValue({});
    mockSettings.setGlobalSettings.mockResolvedValue(undefined);
  });

  describe("singleton", () => {
    it("returns the same instance", () => {
      (TadoManager as any).instance = undefined;
      const a = TadoManager.getInstance();
      const b = TadoManager.getInstance();
      expect(a).toBe(b);
    });
  });

  describe("ensureAuthenticated", () => {
    it("authenticates only once (idempotent)", async () => {
      const manager = createFreshManager();
      mockAuthenticate.mockResolvedValue([null, Promise.resolve()]);

      await manager.ensureAuthenticated();
      await manager.ensureAuthenticated();

      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    });

    it("concurrent calls wait on the same promise", async () => {
      const manager = createFreshManager();
      let resolveAuth: () => void;
      const authPromise = new Promise<void>((r) => { resolveAuth = r; });
      mockAuthenticate.mockResolvedValue([null, authPromise]);

      const p1 = manager.ensureAuthenticated();
      const p2 = manager.ensureAuthenticated();

      resolveAuth!();
      await Promise.all([p1, p2]);

      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    });

    it("uses refresh token from settings when available", async () => {
      const manager = createFreshManager();
      mockSettings.getGlobalSettings.mockResolvedValue({ refresh_token: "saved-token" });
      mockAuthenticate.mockResolvedValue([null, Promise.resolve()]);

      await manager.ensureAuthenticated();

      expect(mockAuthenticate).toHaveBeenCalledWith("saved-token");
    });

    it("passes undefined when no refresh token saved", async () => {
      const manager = createFreshManager();
      mockSettings.getGlobalSettings.mockResolvedValue({});
      mockAuthenticate.mockResolvedValue([null, Promise.resolve()]);

      await manager.ensureAuthenticated();

      expect(mockAuthenticate).toHaveBeenCalledWith(undefined);
    });

    it("opens browser when verify info is returned", async () => {
      const manager = createFreshManager();
      const verify = { verification_uri_complete: "https://auth.tado.com/verify?code=ABC" };
      mockAuthenticate.mockResolvedValue([verify, Promise.resolve()]);

      await manager.ensureAuthenticated();

      expect(mockSystem.openUrl).toHaveBeenCalledWith("https://auth.tado.com/verify?code=ABC");
    });

    it("does not open browser when no verify info (refresh token valid)", async () => {
      const manager = createFreshManager();
      mockAuthenticate.mockResolvedValue([null, Promise.resolve()]);

      await manager.ensureAuthenticated();

      expect(mockSystem.openUrl).not.toHaveBeenCalled();
    });

    it("throws and resets on auth failure", async () => {
      const manager = createFreshManager();
      mockAuthenticate.mockRejectedValue(new Error("auth failed"));

      await expect(manager.ensureAuthenticated()).rejects.toThrow("auth failed");
      expect(manager.isReady).toBe(false);
    });
  });

  describe("resetAuth", () => {
    it("allows re-authentication after reset", async () => {
      const manager = createFreshManager();
      mockAuthenticate.mockResolvedValue([null, Promise.resolve()]);

      await manager.ensureAuthenticated();
      expect(manager.isReady).toBe(true);

      manager.resetAuth();
      expect(manager.isReady).toBe(false);

      await manager.ensureAuthenticated();
      expect(mockAuthenticate).toHaveBeenCalledTimes(2);
    });
  });

  describe("handleApiError", () => {
    it("re-authenticates on 401", async () => {
      const manager = createFreshManager();
      mockAuthenticate.mockResolvedValue([null, Promise.resolve()]);
      await manager.ensureAuthenticated();

      manager.resetAuth();
      mockAuthenticate.mockResolvedValue([null, Promise.resolve()]);

      const recovered = await manager.handleApiError({ response: { status: 401 } });
      expect(recovered).toBe(true);
      expect(manager.isReady).toBe(true);
    });

    it("returns false for non-401 errors", async () => {
      const manager = createFreshManager();
      const recovered = await manager.handleApiError({ response: { status: 500 } });
      expect(recovered).toBe(false);
    });

    it("returns false for non-HTTP errors", async () => {
      const manager = createFreshManager();
      const recovered = await manager.handleApiError(new Error("network error"));
      expect(recovered).toBe(false);
    });
  });

  describe("token callback", () => {
    it("saves token to global settings", async () => {
      const manager = createFreshManager();

      // Get the callback that was registered
      const tokenCallback = mockSetTokenCallback.mock.calls[0][0];

      mockSettings.getGlobalSettings.mockResolvedValue({ pollIntervalSeconds: 60 });

      const token = {
        access_token: "new-access",
        refresh_token: "new-refresh",
        expiry: new Date("2026-03-01T00:00:00Z"),
      };

      await tokenCallback(token);

      expect(mockSettings.setGlobalSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          pollIntervalSeconds: 60,
          access_token: "new-access",
          refresh_token: "new-refresh",
          expiry: "2026-03-01T00:00:00.000Z",
          refreshTokenSetAt: expect.any(String),
        }),
      );
    });
  });
});
