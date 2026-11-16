import { describe, it, expect } from "vitest";
import { parseNotation } from "../src/notation";

const voices = { D: "Dum", T: "Tak", K: "Ka" };

describe("parseNotation", () => {
  it("4/4 十六分格：16 格，忽略空白與 |；大寫重音、小寫輕音", () => {
    const n = parseNotation({ meter: "4/4", subdivision: 4, voices, pattern: [{ track: "皮", hits: "D.Tk | ..T. D... T..." }] })!;
    expect(n.errors).toEqual([]);
    expect(n.total).toBe(16);
    expect(n.groups).toEqual([4, 4, 4, 4]);
    expect(n.tracks[0].cells[0]).toEqual({ voice: "D", name: "Dum", accent: true });
    expect(n.tracks[0].cells[3]).toEqual({ voice: "K", name: "Ka", accent: false });
    expect(n.tracks[0].cells[1]).toBeNull();
  });
  it("加法拍子用 groups 決定格數", () => {
    const n = parseNotation({ meter: "7/8", subdivision: 1, groups: [2, 2, 3], voices, pattern: [{ hits: "D.T.D.." }] })!;
    expect(n.errors).toEqual([]);
    expect(n.total).toBe(7);
  });
  it("12/8：每拍一格就是 12 格", () => {
    expect(parseNotation({ meter: "12/8", voices, pattern: [{ hits: "D.T.D.T.D.T." }] })!.errors).toEqual([]);
  });
  it("格數不符、未知字元、缺 voices 都列為錯誤", () => {
    const n = parseNotation({ meter: "4/4", subdivision: 4, voices, pattern: [{ track: "皮", hits: "D.X." }] })!;
    expect(n.errors.join("\n")).toMatch(/4 格，應為 16 格/);
    expect(n.errors.join("\n")).toMatch(/X/);
    expect(parseNotation({ pattern: [{ hits: "D..." }] })!.errors.join("\n")).toMatch(/voices/);
  });
  it("沒有 pattern 時不畫鼓譜", () => expect(parseNotation({ meter: "4/4" })).toBeNull());
});
