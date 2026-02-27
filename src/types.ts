import type { JsonObject } from "@elgato/utils";

export type UnitTemperature = "celsius" | "fahrenheit";

export type TadoGlobalSettings = JsonObject & {
  access_token?: string;
  refresh_token?: string;
  expiry?: string;
  pollIntervalSeconds?: number;
  defaultUnit?: UnitTemperature;
};

export type HomeActionSettings = JsonObject & {
  homeId: string;
};

export type ZoneActionSettings = HomeActionSettings & {
  zoneId: string;
  unit: UnitTemperature;
};

export type PowerSettings = ZoneActionSettings & {
  temperature: number;
};

export type PresetSettings = HomeActionSettings & {
  presetName: string;
  presetTemperature: number;
  terminationType: string;
};
