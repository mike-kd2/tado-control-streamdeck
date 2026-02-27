export interface KeyImageOptions {
  bgColor?: string;
  textColor?: string;
}

/**
 * Creates a base64-encoded SVG data URI for use with action.setImage().
 * Renders 1–3 text lines centered on a 72×72px canvas.
 * The first line is displayed larger (primary value); subsequent lines smaller.
 */
export function createKeyImage(lines: string[], options: KeyImageOptions = {}): string {
  const { bgColor = "#1a1a1a", textColor = "#ffffff" } = options;
  const size = 72;

  const textElements = buildTextElements(lines, textColor);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bgColor}" rx="6"/>${textElements}</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function buildTextElements(lines: string[], textColor: string): string {
  const safe = lines.slice(0, 3).map(escapeXml);
  const font = "Arial, sans-serif";

  if (safe.length === 1) {
    return `<text x="36" y="44" font-size="20" fill="${textColor}" text-anchor="middle" font-family="${font}" font-weight="bold">${safe[0]}</text>`;
  }
  if (safe.length === 2) {
    return (
      `<text x="36" y="28" font-size="18" fill="${textColor}" text-anchor="middle" font-family="${font}" font-weight="bold">${safe[0]}</text>` +
      `<text x="36" y="52" font-size="14" fill="${textColor}" text-anchor="middle" font-family="${font}" opacity="0.8">${safe[1]}</text>`
    );
  }
  return (
    `<text x="36" y="20" font-size="13" fill="${textColor}" text-anchor="middle" font-family="${font}">${safe[0]}</text>` +
    `<text x="36" y="40" font-size="16" fill="${textColor}" text-anchor="middle" font-family="${font}" font-weight="bold">${safe[1]}</text>` +
    `<text x="36" y="60" font-size="12" fill="${textColor}" text-anchor="middle" font-family="${font}" opacity="0.8">${safe[2]}</text>`
  );
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
