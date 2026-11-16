import { describe, it, expect } from "vitest";
import { DEFAULT_CLICK, levelAt, stepsPerBar, stepSeconds, isMutedBar, groupStarts, clampBpm, type ClickConfig } from "../src/clicks";

const c = (p: Partial<ClickConfig>): ClickConfig => ({ ...DEFAULT_CLICK, ...p });

describe("拍號與細分", () => {
  it("4/4 十六分：16 格，每格 1/4 拍", () => {
    const k = c({ subdivision: 4, bpm: 60 });
    expect(stepsPerBar(k)).toBe(16);
    expect(stepSeconds(k)).toBeCloseTo(0.25);
  });
  it("3/4 三連音：9 格", () => expect(stepsPerBar(c({ meter: "3/4", subdivision: 3 }))).toBe(9));
  it("7/8 以八分音符計，忽略細分", () => {
    const k = c({ meter: "7/8", subdivision: 4, bpm: 140 });
    expect(stepsPerBar(k)).toBe(7);
    expect(stepSeconds(k)).toBeCloseTo(60 / 140);
  });
  it("7/8 三種分組的起點", () => {
    expect(groupStarts(c({ meter: "7/8", grouping7: "2+2+3" }))).toEqual([0, 2, 4]);
    expect(groupStarts(c({ meter: "7/8", grouping7: "3+2+2" }))).toEqual([0, 3, 5]);
    expect(groupStarts(c({ meter: "7/8", grouping7: "2+3+2" }))).toEqual([0, 2, 5]);
  });
});

describe("提示音", () => {
  it("4/4 八分：第 1 拍重音，其餘拍、細分", () => {
    const k = c({ subdivision: 2 });
    expect([0, 1, 2, 3].map((s) => levelAt(k, s))).toEqual(["accent", "sub", "beat", "sub"]);
  });
  it("關掉第 1 拍重音", () => expect(levelAt(c({ accentFirst: false }), 0)).toBe("beat"));
  it("7/8 分組重音可開關", () => {
    const k = c({ meter: "7/8", grouping7: "3+2+2" });
    expect([0, 1, 2, 3, 4, 5, 6].map((s) => levelAt(k, s))).toEqual(["accent", "beat", "beat", "group", "beat", "group", "beat"]);
    expect(levelAt({ ...k, accentGroups: false }, 3)).toBe("beat");
    expect(levelAt({ ...k, accentFirst: false }, 0)).toBe("group");
  });
});

describe("靜音小節", () => {
  it("響 1 靜 3", () => expect([0, 1, 2, 3, 4, 5].map((b) => isMutedBar(b, 1, 3))).toEqual([false, true, true, true, false, true]));
  it("響 2 靜 2", () => expect([0, 1, 2, 3, 4].map((b) => isMutedBar(b, 2, 2))).toEqual([false, false, true, true, false]));
  it("靜 0 不靜音", () => expect(isMutedBar(5, 1, 0)).toBe(false));
  it("中途改設定：從 epoch 小節重新起算", () => {
    expect([4, 5, 6, 7, 8].map((b) => isMutedBar(b, 1, 3, 5))).toEqual([false, false, true, true, true]);
  });
});

it("BPM 限制在 30–240", () => {
  expect(clampBpm(10)).toBe(30);
  expect(clampBpm(300)).toBe(240);
});
