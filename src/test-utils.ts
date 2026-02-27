import { vi } from "vitest";

export function createMockManager() {
  return {
    isReady: true,
    api: {
      getMe: vi.fn().mockResolvedValue({ homes: [{ id: 1, name: "Home" }] }),
      getZones: vi.fn().mockResolvedValue([
        { id: 1, name: "Living Room" },
        { id: 2, name: "Bedroom" },
      ]),
      getZoneState: vi.fn().mockResolvedValue(createMockZoneState()),
      getZoneStates: vi.fn().mockResolvedValue({ zoneStates: { 1: createMockZoneState() } }),
      getZoneOverlay: vi.fn(),
      setZoneOverlays: vi.fn().mockResolvedValue(undefined),
      clearZoneOverlays: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockResolvedValue({ presence: "HOME" }),
      setPresence: vi.fn().mockResolvedValue(undefined),
      getTimeTables: vi.fn().mockResolvedValue({ id: 0 }),
      getTimeTable: vi.fn().mockResolvedValue([]),
      getRatelimit: vi.fn().mockReturnValue(undefined),
      authenticate: vi.fn().mockResolvedValue([null, Promise.resolve()]),
      setTokenCallback: vi.fn(),
    },
    ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
    handleApiError: vi.fn().mockResolvedValue(false),
    resetAuth: vi.fn(),
    checkRefreshTokenExpiry: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockPolling() {
  return {
    registerZone: vi.fn(),
    unregisterZone: vi.fn(),
    onUpdate: vi.fn().mockReturnValue(vi.fn()),
    getCached: vi.fn(),
    refreshZone: vi.fn().mockResolvedValue(undefined),
    setPollInterval: vi.fn(),
  };
}

export function createMockEvent(settings: Record<string, any> = {}, controller: "Encoder" | "Keypad" = "Keypad") {
  return {
    action: {
      isDial: vi.fn().mockReturnValue(controller === "Encoder"),
      isKey: vi.fn().mockReturnValue(controller === "Keypad"),
      setTitle: vi.fn(),
      setImage: vi.fn().mockResolvedValue(undefined),
      setFeedback: vi.fn().mockResolvedValue(undefined),
      setFeedbackLayout: vi.fn().mockResolvedValue(undefined),
      setState: vi.fn(),
      showOk: vi.fn(),
      showAlert: vi.fn(),
      getSettings: vi.fn().mockResolvedValue(settings),
      setSettings: vi.fn().mockResolvedValue(undefined),
      sendToPropertyInspector: vi.fn(),
    },
    payload: {
      settings,
      ticks: 0,
      pressed: true,
      tapPos: [100, 50],
      event: "",
    },
  };
}

export function createMockZoneState(overrides: Record<string, any> = {}) {
  return {
    sensorDataPoints: {
      insideTemperature: { celsius: 21.5, fahrenheit: 70.7 },
      humidity: { percentage: 55 },
    },
    ...overrides,
  };
}

export function createMockZoneStateWithOverlay(power = "ON", temperature = { celsius: 22, fahrenheit: 71.6 }) {
  return {
    ...createMockZoneState(),
    overlay: {
      setting: { power, temperature },
      termination: { typeSkillBasedApp: "MANUAL" },
    },
  };
}

export function createMockBoostState() {
  return {
    ...createMockZoneState(),
    overlay: {
      setting: { power: "ON", temperature: { celsius: 25, fahrenheit: 77 }, isBoost: true },
      termination: { typeSkillBasedApp: "TIMER", remainingTimeInSeconds: 1500 },
    },
  };
}
