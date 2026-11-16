import { describe, it, expect } from "vitest";
import { computeProgress, summarizeWeek, recentWeeks, type Curriculum, type LearningRecord } from "../src/core";

const C: Curriculum = {
  items: [
    { id: "A", group: "X" },
    { id: "B", group: "X" },
    { id: "R", group: "Y", progressContexts: ["橋下"] },
  ],
  groups: [{ id: "X" }, { id: "Y" }],
  stages: [
    { level: 1, required: ["A"], mode: "pass" },
    { level: 2, required: ["B"], mode: "pass" },
    { level: 3, required: ["A", "B"], mode: "recheck" },
  ],
  defaultProgressContexts: ["打擊墊", "大腿"],
  streak: 3,
  weeklyGoals: [
    { context: "大腿", kind: "days", target: 5 },
    { context: "打擊墊", kind: "count", target: 2 },
    { context: "橋下", kind: "count", target: 1 },
  ],
};

let seq = 0;
function rec(day: number, item: string, passed: boolean | null, context = "打擊墊", hour = 20): LearningRecord {
  seq++;
  return { path: `r${String(seq).padStart(3, "0")}.md`, date: new Date(2026, 10, day, hour), context, item, passed, raw: {} };
}

describe("進度格與過關", () => {
  it("從最新一則往回數連續達標；最新一則沒達到就是 0", () => {
    const p1 = computeProgress([rec(1, "A", true), rec(2, "A", true)], C);
    expect(p1.items.A.cells).toBe(2);
    const p2 = computeProgress([rec(1, "A", true), rec(2, "A", true), rec(3, "A", false)], C);
    expect(p2.items.A.cells).toBe(0);
  });
  it("上限 3 格；連續三次才算過關，之後沒達到也不收回", () => {
    const rs = [rec(1, "A", true), rec(2, "A", false), rec(3, "A", true), rec(4, "A", true), rec(5, "A", true), rec(6, "A", true), rec(7, "A", false)];
    const p = computeProgress(rs, C);
    expect(p.items.A.cells).toBe(0);
    expect(p.items.A.passedAt?.date.getDate()).toBe(5);
    expect(p.itemBadges.map((b) => b.id)).toEqual(["A"]);
  });
  it("記錄順序依日期，不依輸入順序", () => {
    const p = computeProgress([rec(3, "A", true), rec(1, "A", false), rec(2, "A", true)], C);
    expect(p.items.A.cells).toBe(2);
  });
  it("不計入進度的情境另外列出，不影響進度格", () => {
    const p = computeProgress([rec(1, "A", true), rec(2, "A", true), rec(3, "A", false, "橋下")], C);
    expect(p.items.A.cells).toBe(2);
    expect(p.items.A.otherRecords).toHaveLength(1);
  });
  it("指定情境的項目只計該情境", () => {
    const p = computeProgress([rec(1, "R", true, "打擊墊"), rec(2, "R", true, "橋下")], C);
    expect(p.items.R.cells).toBe(1);
  });
});

describe("等級", () => {
  const pass3 = (item: string, d: number) => [rec(d, item, true), rec(d + 1, item, true), rec(d + 2, item, true)];
  it("沒有記錄時在第 1 期", () => {
    expect(computeProgress([], C).level).toBe(1);
  });
  it("必做過關就升期", () => {
    expect(computeProgress(pass3("A", 1), C).level).toBe(2);
  });
  it("後期必做先過關，前期沒過仍停在前期", () => {
    expect(computeProgress(pass3("B", 1), C).level).toBe(1);
  });
  it("重新檢查期：需要在進入該期之後的新達標記錄", () => {
    const base = [...pass3("A", 1), ...pass3("B", 4)]; // 第 2 期在 11/6 完成
    const p = computeProgress(base, C);
    expect(p.level).toBe(3);
    expect(p.stages[2].startedAt?.getDate()).toBe(6);
    expect(p.stages[2].rechecked).toEqual({ A: false, B: false });
    const p2 = computeProgress([...base, rec(7, "A", true), rec(8, "B", true)], C);
    expect(p2.allDone).toBe(true);
    expect(p2.stages[2].rechecked).toEqual({ A: true, B: true });
  });
  it("項目完成徽章：該項目所有練習都曾過關", () => {
    const p = computeProgress([...pass3("A", 1), ...pass3("B", 4)], C);
    expect(p.groupBadges.map((b) => b.id)).toEqual(["X"]);
    expect(p.groupBadges[0].at.getDate()).toBe(6);
  });
});

describe("每週目標", () => {
  // 2026-11-16 是週一
  it("大腿算不同日期、打擊墊與橋下算則數；沒有代號的記錄也計入", () => {
    const rs = [16, 17, 18, 19, 20, 20].map((d) => rec(d, "", null, "大腿"));
    rs.push(rec(17, "A", true), rec(19, "A", false), rec(21, "即興", null, "橋下"));
    const w = summarizeWeek(rs, C.weeklyGoals, new Date(2026, 10, 18));
    expect(w.goals.map((g) => g.value)).toEqual([5, 2, 1]);
    expect(w.completed).toBe(true);
  });
  it("週一開始：週日的記錄屬於前一週", () => {
    const w = summarizeWeek([rec(15, "A", true)], C.weeklyGoals, new Date(2026, 10, 16));
    expect(w.total).toBe(0);
  });
  it("最近 8 週由舊到新", () => {
    const ws = recentWeeks([rec(16, "A", true)], C.weeklyGoals, new Date(2026, 10, 18), 8);
    expect(ws).toHaveLength(8);
    expect(ws[7].total).toBe(1);
    expect(ws[0].start.getDate()).toBe(28); // 2026-09-28
  });
});
