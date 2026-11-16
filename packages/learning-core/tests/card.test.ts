import { describe, it, expect } from "vitest";
import { parseMaterialCard, parseTime, formatTime } from "../src/materials/card";

const LEVELS = ["可查依據", "轉述", "推論重建"];

describe("時間", () => {
  it.each([["83", 83], ["1:23", 83], ["01:02:03", 3723], ["0:05", 5]])("%s", (s, v) => expect(parseTime(s)).toBe(v));
  it("讀不懂", () => { expect(parseTime("1:75")).toBeNull(); expect(parseTime("一分")).toBeNull(); });
  it("格式化", () => { expect(formatTime(83)).toBe("1:23"); expect(formatTime(3723)).toBe("1:02:03"); });
});

describe("parseMaterialCard", () => {
  it("合法卡片", () => {
    const c = parseMaterialCard({ title: "X", source: "Frishkopf 2009", evidence: "可查依據", videos: [{ url: "https://youtu.be/dQw4w9WgXcQ", label: "範例", segments: [{ label: "基本型", start: 83, end: "1:41", rate: 0.75 }] }] }, LEVELS);
    expect(c.warnings).toEqual([]);
    expect(c.videos[0].id).toBe("dQw4w9WgXcQ");
    expect(c.videos[0].segments[0]).toEqual({ label: "基本型", start: 83, end: 101, rate: 0.75 });
  });
  it("出處空白、分級不對、網址讀不懂、終點早於起點都給警告", () => {
    const c = parseMaterialCard({ source: "", evidence: "聽說", videos: [{ url: "abc", segments: [{ start: 10, end: 5 }] }] }, LEVELS);
    expect(c.warnings.join("\n")).toMatch(/出處/);
    expect(c.warnings.join("\n")).toMatch(/聽說/);
    expect(c.warnings.join("\n")).toMatch(/影片 ID/);
    expect(c.warnings.join("\n")).toMatch(/終點早於起點/);
  });
});
