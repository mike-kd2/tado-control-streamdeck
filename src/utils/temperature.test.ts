import { describe, it, expect } from "vitest";
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  buildTemperature,
  readTemperature,
  formatTemperature,
  getIndicatorPercent,
  clampTemperature,
} from "./temperature";

describe("celsiusToFahrenheit", () => {
  it("converts 0°C to 32°F", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });

  it("converts 100°C to 212°F", () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });

  it("converts 20°C to 68°F", () => {
    expect(celsiusToFahrenheit(20)).toBe(68);
  });

  it("converts negative temperatures", () => {
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });
});

describe("fahrenheitToCelsius", () => {
  it("converts 32°F to 0°C", () => {
    expect(fahrenheitToCelsius(32)).toBe(0);
  });

  it("converts 212°F to 100°C", () => {
    expect(fahrenheitToCelsius(212)).toBe(100);
  });

  it("converts 68°F to 20°C", () => {
    expect(fahrenheitToCelsius(68)).toBe(20);
  });

  it("converts -40°F to -40°C", () => {
    expect(fahrenheitToCelsius(-40)).toBe(-40);
  });
});

describe("buildTemperature", () => {
  it("builds from celsius value", () => {
    const result = buildTemperature(20, "celsius");
    expect(result.celsius).toBe(20);
    expect(result.fahrenheit).toBe(68);
  });

  it("builds from fahrenheit value", () => {
    const result = buildTemperature(68, "fahrenheit");
    expect(result.fahrenheit).toBe(68);
    expect(result.celsius).toBe(20);
  });
});

describe("readTemperature", () => {
  it("reads celsius value", () => {
    expect(readTemperature({ celsius: 21.5, fahrenheit: 70.7 }, "celsius")).toBe(21.5);
  });

  it("reads fahrenheit value", () => {
    expect(readTemperature({ celsius: 21.5, fahrenheit: 70.7 }, "fahrenheit")).toBe(70.7);
  });

  it("returns 0 for undefined data", () => {
    expect(readTemperature(undefined, "celsius")).toBe(0);
  });

  it("returns 0 for missing property", () => {
    expect(readTemperature({}, "celsius")).toBe(0);
  });
});

describe("formatTemperature", () => {
  it("formats celsius", () => {
    expect(formatTemperature(21.5, "celsius")).toBe("21.5°C");
  });

  it("formats fahrenheit", () => {
    expect(formatTemperature(70.7, "fahrenheit")).toBe("70.7°F");
  });

  it("formats with one decimal place", () => {
    expect(formatTemperature(20, "celsius")).toBe("20.0°C");
  });
});

describe("getIndicatorPercent", () => {
  it("returns 0 for minimum celsius", () => {
    expect(getIndicatorPercent(5, "celsius")).toBe(0);
  });

  it("returns 100 for maximum celsius", () => {
    expect(getIndicatorPercent(25, "celsius")).toBe(100);
  });

  it("returns 50 for midpoint celsius", () => {
    expect(getIndicatorPercent(15, "celsius")).toBe(50);
  });

  it("clamps below minimum", () => {
    expect(getIndicatorPercent(0, "celsius")).toBe(0);
  });

  it("clamps above maximum", () => {
    expect(getIndicatorPercent(30, "celsius")).toBe(100);
  });

  it("returns 0 for minimum fahrenheit (41°F)", () => {
    expect(getIndicatorPercent(41, "fahrenheit")).toBe(0);
  });

  it("returns 100 for maximum fahrenheit (77°F)", () => {
    expect(getIndicatorPercent(77, "fahrenheit")).toBe(100);
  });
});

describe("clampTemperature", () => {
  it("clamps celsius to min 5", () => {
    expect(clampTemperature(3, "celsius")).toBe(5);
  });

  it("clamps celsius to max 25", () => {
    expect(clampTemperature(30, "celsius")).toBe(25);
  });

  it("keeps celsius within range", () => {
    expect(clampTemperature(20, "celsius")).toBe(20);
  });

  it("clamps fahrenheit to min 41", () => {
    expect(clampTemperature(35, "fahrenheit")).toBe(41);
  });

  it("clamps fahrenheit to max 77", () => {
    expect(clampTemperature(85, "fahrenheit")).toBe(77);
  });

  it("keeps fahrenheit within range", () => {
    expect(clampTemperature(68, "fahrenheit")).toBe(68);
  });
});
