import { describe, it, expect } from "vitest";
import { suggestNext } from "../src/suggest";
import { exerciseById } from "@rpd/rhythm/src/course";
import type { LearningRecord } from "@rpd/learning-core/src/core";

const T2 = exerciseById("T2")!;
const r = (day: number, passed: boolean, bpm: number): LearningRecord =>
  ({ path: `${day}.md`, date: new Date(2026, 10, day), context: "打擊墊", item: "T2", passed, raw: { bpm } });

describe("suggestNext", () => {
  it("沒有記錄：課程預設", () => expect(suggestNext(T2, [], 0).bpm).toBe(70));
  it("沒達到：降 10", () => {
    const s = suggestNext(T2, [r(1, false, 70)], 0);
    expect(s.bpm).toBe(60);
    expect(s.backtrack).toBe(false);
  });
  it("降速後仍沒達到：建議回前一期", () => {
    const s = suggestNext(T2, [r(1, false, 70), r(2, false, 60)], 0);
    expect(s.bpm).toBe(50);
    expect(s.backtrack).toBe(true);
  });
  it("過關後提示下一個速度，但預設維持原速", () => {
    const rs = [r(1, true, 70), r(2, true, 70), r(3, true, 70)];
    const s = suggestNext(T2, rs, 3);
    expect(s.bpm).toBe(70);
    expect(s.note).toContain("90");
  });
  it("不低於 30 BPM", () => expect(suggestNext(T2, [r(1, false, 35)], 0).bpm).toBe(30));
});
