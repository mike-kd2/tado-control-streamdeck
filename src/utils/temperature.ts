import type { UnitTemperature } from "../types";

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

export function buildTemperature(value: number, unit: UnitTemperature): { celsius: number; fahrenheit: number } {
  if (unit === "fahrenheit") {
    return { celsius: fahrenheitToCelsius(value), fahrenheit: value };
  }
  return { celsius: value, fahrenheit: celsiusToFahrenheit(value) };
}

export function readTemperature(data: { celsius?: number; fahrenheit?: number } | undefined, unit: UnitTemperature): number {
  if (!data) return 0;
  if (unit === "fahrenheit") {
    return data.fahrenheit ?? 0;
  }
  return data.celsius ?? 0;
}

export function formatTemperature(value: number, unit: UnitTemperature): string {
  const symbol = unit === "celsius" ? "°C" : "°F";
  return `${value.toFixed(1)}${symbol}`;
}

export function getIndicatorPercent(value: number, unit: UnitTemperature): number {
  if (unit === "celsius") {
    return Math.max(0, Math.min(100, ((value - 5) / (25 - 5)) * 100));
  }
  return Math.max(0, Math.min(100, ((value - 41) / (77 - 41)) * 100));
}

export function clampTemperature(value: number, unit: UnitTemperature): number {
  if (unit === "celsius") {
    return Math.max(5, Math.min(25, value));
  }
  return Math.max(41, Math.min(77, value));
}
