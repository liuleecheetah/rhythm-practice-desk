import { describe, it, expect } from "vitest";
import { EXERCISES, STAGES, GROUPS } from "../src/course";

describe("課程資料", () => {
  it("29 個練習，代號不重複", () => {
    expect(EXERCISES).toHaveLength(29);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(29);
  });
  it("每個項目都有練習；各項目的數量符合 COURSE.md", () => {
    const count = (g: string) => EXERCISES.filter((e) => e.group === g).length;
    expect(GROUPS.map((g) => count(g.id))).toEqual([6, 8, 4, 6, 5]);
  });
  it("分期表引用的代號都存在", () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const s of STAGES) for (const id of [...s.required, ...s.pad, ...s.thigh]) expect(ids.has(id), `${s.level} 期的 ${id}`).toBe(true);
  });
  it("六期，只有第 6 期是重新檢查", () => {
    expect(STAGES.map((s) => s.mode)).toEqual(["pass", "pass", "pass", "pass", "pass", "recheck"]);
  });
});
