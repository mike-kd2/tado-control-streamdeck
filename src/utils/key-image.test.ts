import { describe, it, expect } from "vitest";
import { createKeyImage } from "./key-image";

const DATA_URI_PREFIX = "data:image/svg+xml;base64,";

function decodeSvg(dataUri: string): string {
  const base64 = dataUri.slice(DATA_URI_PREFIX.length);
  return Buffer.from(base64, "base64").toString("utf8");
}

describe("createKeyImage", () => {
  it("returns a base64 SVG data URI", () => {
    const result = createKeyImage(["21.5°C"]);
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("embeds the text in the SVG for 1 line", () => {
    const result = createKeyImage(["21.5°C"]);
    const svg = decodeSvg(result);
    expect(svg).toContain("21.5°C");
    expect(svg).toContain('font-size="20"');
  });

  it("embeds both lines for 2 lines", () => {
    const result = createKeyImage(["21.5°C", "55%"]);
    const svg = decodeSvg(result);
    expect(svg).toContain("21.5°C");
    expect(svg).toContain("55%");
    expect(svg).toContain('font-size="18"');
    expect(svg).toContain('font-size="14"');
  });

  it("embeds all 3 lines for 3 lines", () => {
    const result = createKeyImage(["top", "middle", "bottom"]);
    const svg = decodeSvg(result);
    expect(svg).toContain("top");
    expect(svg).toContain("middle");
    expect(svg).toContain("bottom");
    expect(svg).toContain('font-size="13"');
    expect(svg).toContain('font-size="16"');
    expect(svg).toContain('font-size="12"');
  });

  it("clamps to 3 lines when more are provided", () => {
    const result = createKeyImage(["a", "b", "c", "d"]);
    const svg = decodeSvg(result);
    expect(svg).toContain("a");
    expect(svg).toContain("b");
    expect(svg).toContain("c");
    expect(svg).not.toContain(">d<");
  });

  it("applies custom textColor", () => {
    const result = createKeyImage(["test"], { textColor: "#4CAF50" });
    const svg = decodeSvg(result);
    expect(svg).toContain("#4CAF50");
  });

  it("applies custom bgColor", () => {
    const result = createKeyImage(["test"], { bgColor: "#000000" });
    const svg = decodeSvg(result);
    expect(svg).toContain("#000000");
  });

  it("uses default dark background and white text", () => {
    const result = createKeyImage(["test"]);
    const svg = decodeSvg(result);
    expect(svg).toContain("#1a1a1a");
    expect(svg).toContain("#ffffff");
  });

  it("escapes XML special characters", () => {
    const result = createKeyImage(['<foo> & "bar"']);
    const svg = decodeSvg(result);
    expect(svg).toContain("&lt;foo&gt; &amp; &quot;bar&quot;");
    expect(svg).not.toContain("<foo>");
  });

  it("generates valid SVG with correct dimensions", () => {
    const result = createKeyImage(["test"]);
    const svg = decodeSvg(result);
    expect(svg).toContain('width="72"');
    expect(svg).toContain('height="72"');
    expect(svg).toContain('viewBox="0 0 72 72"');
  });
});
