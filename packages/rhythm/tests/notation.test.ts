import { describe, it, expect } from "vitest";
import { parseNotation, cycleCell, formatHits } from "../src/notation";

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
    expect(parseNotation({ pattern: [{ hits: "D..." }] })!.errors.join("\n")).toMatch(/音名/);
  });
  it("沒有 pattern、或 pattern 是空清單時不畫鼓譜", () => {
    expect(parseNotation({ meter: "4/4" })).toBeNull();
    expect(parseNotation({ meter: "4/4", pattern: [] })).toBeNull();
  });
  it("每一軌可以有自己的音名（不同樂器）", () => {
    const n = parseNotation({ meter: "4/4", subdivision: 1, pattern: [
      { track: "djembe", voices: { B: "Bass", T: "Tone", S: "Slap" }, hits: "BtsS" },
      { track: "鈴", voices: { X: "鈴" }, hits: "X.X." },
    ] })!;
    expect(n.errors).toEqual([]);
    expect(n.tracks[0].cells.map((c) => c?.name)).toEqual(["Bass", "Tone", "Slap", "Slap"]);
    expect(n.tracks[1].cells[0]?.name).toBe("鈴");
  });
  it("一軌用到另一軌的音名算錯誤", () => {
    const n = parseNotation({ meter: "4/4", subdivision: 1, pattern: [{ track: "鈴", voices: { X: "鈴" }, hits: "XB.." }] })!;
    expect(n.errors.join()).toMatch(/B/);
  });
});

describe("編輯輔助", () => {
  it("點格子依序換音：休止 → B → b → T → t → 休止", () => {
    let h = "....";
    const seq: string[] = [];
    for (let i = 0; i < 5; i++) { h = cycleCell(h, 1, ["B", "T"], 4); seq.push(h[1]); }
    expect(seq).toEqual(["B", "b", "T", "t", "."]);
  });
  it("格數不足時補休止再換", () => expect(cycleCell("B", 3, ["B"], 4)).toBe("B..B"));
  it("依分組加空白", () => {
    expect(formatHits("D.T...T.D...T...", [4, 4, 4, 4])).toBe("D.T. ..T. D... T...");
    expect(formatHits("D.T.D..", [2, 2, 3])).toBe("D. T. D..");
  });
});
