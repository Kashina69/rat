import type { CSSProperties } from "react";

export const BRAND_COLOR = "#157f3d";

export type BrandStep =
    | 50
    | 100
    | 200
    | 300
    | 400
    | 500
    | 600
    | 700
    | 800
    | 900
    | 950;

type Rgb = readonly [number, number, number];

const WHITE_MIX: Record<BrandStep, number> = {
    50: 0.92,
    100: 0.84,
    200: 0.68,
    300: 0.46,
    400: 0.24,
    500: 0.1,
    600: 0,
    700: -0.12,
    800: -0.24,
    900: -0.38,
    950: -0.52,
};

const WHITE: Rgb = [1, 1, 1];
const BLACK: Rgb = [0, 0, 0];

function parseHex(hex: string): Rgb {
    const value = hex.trim().replace("#", "");
    const full =
        value.length === 3
            ? value
                  .split("")
                  .map((char) => char + char)
                  .join("")
            : value;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) {
        throw new Error(
            `BRAND_COLOR must be a 6-digit hex colour, got "${hex}"`,
        );
    }
    return [
        Number.parseInt(full.slice(0, 2), 16) / 255,
        Number.parseInt(full.slice(2, 4), 16) / 255,
        Number.parseInt(full.slice(4, 6), 16) / 255,
    ];
}

function toHex(rgb: Rgb): string {
    return `#${rgb
        .map((channel) => {
            const byte = Math.round(Math.min(1, Math.max(0, channel)) * 255);
            return byte.toString(16).padStart(2, "0");
        })
        .join("")}`;
}

function toLinear(channel: number): number {
    return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
}

function toGamma(channel: number): number {
    return channel <= 0.0031308
        ? channel * 12.92
        : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function toOklab(rgb: Rgb): Rgb {
    const [r, g, b] = [toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2])];
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}

function fromOklab(lab: Rgb): Rgb {
    const [lightness, a, b] = lab;
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
        toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
    const start = toOklab(from);
    const end = toOklab(to);
    return fromOklab([
        start[0] + (end[0] - start[0]) * amount,
        start[1] + (end[1] - start[1]) * amount,
        start[2] + (end[2] - start[2]) * amount,
    ]);
}

function buildScale(base: string): Record<BrandStep, string> {
    const brand = parseHex(base);
    const steps = Object.entries(WHITE_MIX) as [string, number][];
    return Object.fromEntries(
        steps.map(([step, amount]) => [
            Number(step),
            toHex(mix(brand, amount >= 0 ? WHITE : BLACK, Math.abs(amount))),
        ]),
    ) as Record<BrandStep, string>;
}

export const brandScale = buildScale(BRAND_COLOR);

export const theme = {
    brand: BRAND_COLOR,
    background: "#ffffff",
    foreground: "#0b1210",
    card: "#ffffff",
    subtle: "#f6faf7",
    subtleStrong: "#eef5f0",
    mutedForeground: "#5c6b63",
    border: "#e2e9e4",
    borderStrong: "#cbd6cf",
    primary: brandScale[600],
    primaryHover: brandScale[700],
    primaryForeground: "#ffffff",
    secondary: brandScale[50],
    secondaryForeground: brandScale[800],
    ring: brandScale[500],
    accent: brandScale[600],
    accentHover: brandScale[700],
    accentInk: "#ffffff",
    themeColor: brandScale[700],
} as const;

export const brandCssVars: CSSProperties &
    Record<`--brand-${BrandStep}`, string> = {
    "--brand-50": brandScale[50],
    "--brand-100": brandScale[100],
    "--brand-200": brandScale[200],
    "--brand-300": brandScale[300],
    "--brand-400": brandScale[400],
    "--brand-500": brandScale[500],
    "--brand-600": brandScale[600],
    "--brand-700": brandScale[700],
    "--brand-800": brandScale[800],
    "--brand-900": brandScale[900],
    "--brand-950": brandScale[950],
};
