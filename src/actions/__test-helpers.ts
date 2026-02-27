import { vi } from "vitest";

export function createMockManager() {
  return {
    api: {
      getMe: vi.fn().mockResolvedValue({ homes: [{ id: 1, name: "Home" }] }),
      getZones: vi.fn().mockResolvedValue([
        { id: 1, name: "Living Room" },
        { id: 2, name: "Kitchen" },
      ]),
      getState: vi.fn(),
      setPresence: vi.fn(),
      getZoneState: vi.fn(),
      getZoneOverlay: vi.fn(),
      setZoneOverlays: vi.fn(),
      clearZoneOverlays: vi.fn(),
      getTimeTables: vi.fn(),
      getTimeTable: vi.fn(),
    },
  } as any;
}

export function createMockPolling() {
  return {
    registerZone: vi.fn(),
    unregisterZone: vi.fn(),
    onUpdate: vi.fn().mockReturnValue(vi.fn()),
    getCached: vi.fn(),
    refreshZone: vi.fn(),
  } as any;
}

export function createMockKeyEvent(settings: Record<string, any> = {}) {
  return {
    payload: { settings },
    action: {
      isKey: vi.fn().mockReturnValue(true),
      isDial: vi.fn().mockReturnValue(false),
      getSettings: vi.fn().mockResolvedValue(settings),
      setSettings: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn(),
      setState: vi.fn(),
      setFeedback: vi.fn(),
      showOk: vi.fn(),
      showAlert: vi.fn(),
      sendToPropertyInspector: vi.fn(),
    },
  } as any;
}

export function createMockDialEvent(settings: Record<string, any> = {}, extra: Record<string, any> = {}) {
  return {
    payload: { settings, ...extra },
    action: {
      isKey: vi.fn().mockReturnValue(false),
      isDial: vi.fn().mockReturnValue(true),
      getSettings: vi.fn().mockResolvedValue(settings),
      setSettings: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn(),
      setState: vi.fn(),
      setFeedback: vi.fn(),
      setFeedbackLayout: vi.fn(),
      showOk: vi.fn(),
      showAlert: vi.fn(),
      sendToPropertyInspector: vi.fn(),
    },
  } as any;
}

export const MOCK_ZONE_STATE = {
  sensorDataPoints: {
    insideTemperature: { celsius: 21.5, fahrenheit: 70.7 },
    humidity: { percentage: 55 },
  },
  overlay: {
    setting: {
      power: "ON",
      temperature: { celsius: 22, fahrenheit: 71.6 },
    },
  },
} as any;

export const MOCK_ZONE_STATE_NO_OVERLAY = {
  sensorDataPoints: {
    insideTemperature: { celsius: 19.5, fahrenheit: 67.1 },
    humidity: { percentage: 48 },
  },
} as any;
