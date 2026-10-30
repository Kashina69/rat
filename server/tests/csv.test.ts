import { expect, test } from "vitest";
import { escapeCsvCell, toCsv } from "../src/utils/csv.js";

test("plain cells are quoted without neutralisation", () => {
    expect(escapeCsvCell("Ammo 7.62mm")).toBe('"Ammo 7.62mm"');
    expect(escapeCsvCell("")).toBe('""');
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
    expect(escapeCsvCell(42)).toBe('"42"');
    expect(escapeCsvCell("   ")).toBe('"   "');
    expect(escapeCsvCell("  ok")).toBe('"  ok"');
});

test("embedded double quotes are doubled", () => {
    expect(escapeCsvCell('5" pipe')).toBe('"5"" pipe"');
});

test("formula cells are prefixed with an apostrophe", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe(`"'=SUM(A1:A2)"`);
    expect(escapeCsvCell("+cmd")).toBe(`"'+cmd"`);
    expect(escapeCsvCell("-cmd")).toBe(`"'-cmd"`);
    expect(escapeCsvCell("@cmd")).toBe(`"'@cmd"`);
});

test("a leading tab does not bypass neutralisation", () => {
    expect(escapeCsvCell("\t=cmd")).toBe(`"'\t=cmd"`);
    expect(escapeCsvCell("\t=1+1")).toBe(`"'\t=1+1"`);
    expect(escapeCsvCell("\t\t+cmd")).toBe(`"'\t\t+cmd"`);
});

test("leading spaces and control characters do not bypass neutralisation", () => {
    expect(escapeCsvCell("  =cmd")).toBe(`"'  =cmd"`);
    expect(escapeCsvCell("\r=cmd")).toBe(`"'\r=cmd"`);
    expect(escapeCsvCell("\n=cmd")).toBe(`"'\n=cmd"`);
    expect(escapeCsvCell("\r\n=cmd")).toBe(`"'\r\n=cmd"`);
    expect(escapeCsvCell("\u0000=cmd")).toBe(`"'\u0000=cmd"`);
    expect(escapeCsvCell("\uFEFF=cmd")).toBe(`"'\uFEFF=cmd"`);
});

test("negative numbers keep the existing apostrophe prefix", () => {
    expect(escapeCsvCell("-5")).toBe(`"'-5"`);
    expect(escapeCsvCell(-12)).toBe(`"'-12"`);
});

test("toCsv quotes every cell and terminates lines with CRLF", () => {
    const csv = toCsv(
        ["item", "reason"],
        [
            ["Ammo", "=cmd"],
            ['5" pipe', null],
        ],
    );
    expect(csv).toBe(`"item","reason"\r\n"Ammo","'=cmd"\r\n"5"" pipe",""\r\n`);
});
