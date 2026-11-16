import { describe, it, expect } from "vitest";
import { SCRIPTS, scriptFor, T1_SEQUENCE, T5_ORDER, defaultBpmFor, type CueContext } from "../src/registry";
import { EXERCISES } from "../src/course";
import { T2_LEVELS } from "../src/scripts";

const ctx = (id: string, bar: number, step: number, extra: Partial<CueContext> = {}): CueContext => {
  const s = scriptFor(id)!;
  const opts = { ...(s.defaults ?? {}) };
  return { bar, step, cfg: s.config(defaultBpmFor(id), opts), muted: false, opts, ...extra };
};

describe("腳本清單", () => {
  it("29 個練習都有腳本，設定合法", () => {
    for (const e of EXERCISES) {
      const s = SCRIPTS[e.id];
      expect(s, e.id).toBeDefined();
      const cfg = s.config(defaultBpmFor(e.id), s.defaults ?? {});
      expect(cfg.bpm).toBeGreaterThanOrEqual(30);
      expect(typeof s.cue(ctx(e.id, 0, 0)).text).toBe("string");
    }
  });
  it("課程沒有指定速度的 C6 用 60，並標成 fallback", () => {
    expect(EXERCISES.find((e) => e.id === "C6")!.bpm).toBeNull();
    expect(defaultBpmFor("C6")).toBe(60);
    expect(scriptFor("C6")!.fallbackBpm).toBe(60);
  });
  it("D4、P4 只計時、不用節拍器", () => {
    expect(scriptFor("D4")!.clicks).toBe(false);
    expect(scriptFor("P4")!.clicks).toBe(false);
  });
});

describe("各腳本的提示", () => {
  it("T1：每 2 小節換細分，順序 四分→八分→三連音→十六分→三連音→八分→四分；3 輪結束", () => {
    const seq = Array.from({ length: 7 }, (_, i) => scriptFor("T1")!.cue(ctx("T1", i * 2, 0)).text);
    expect(seq).toEqual(["四分", "八分", "三連音", "十六分", "三連音", "八分", "四分"]);
    expect(T1_SEQUENCE).toHaveLength(7);
    expect(scriptFor("T1")!.cue(ctx("T1", 1, 3)).detail).toBe("下一小節換：八分");
    expect(scriptFor("T1")!.target).toEqual({ kind: "bars", value: 42 });
  });
  it("T4 是 3/4 的靜音測試，級別同 T2", () => {
    const s = scriptFor("T4")!;
    expect(s.config(70, {}).meter).toBe("3/4");
    expect(s.levels).toBe(T2_LEVELS);
  });
  it("T5：每 4 輪換分組，12 小節三種換過一輪", () => {
    const s = scriptFor("T5")!;
    expect([0, 4, 8].map((b) => s.barUpdate!(b, {})!.grouping7)).toEqual(T5_ORDER);
    expect(s.cue(ctx("T5", 4, 0)).detail).toContain("右左左、右左、右左");
    expect(s.target).toEqual({ kind: "bars", value: 12 });
  });
  it("D2：每 4 小節換重音位置", () => {
    const s = scriptFor("D2")!;
    expect([0, 4, 8, 12].map((b) => s.cue(ctx("D2", b, 0)).text)).toEqual(["Rlrl", "rLrl", "rlRl", "rlrL"]);
  });
  it("D3：響 1 靜 3；前 2 小節漸強、後 2 小節漸弱", () => {
    const s = scriptFor("D3")!;
    expect([s.config(70, {}).muteOn, s.config(70, {}).muteOff]).toEqual([1, 3]);
    const a = s.cue(ctx("D3", 0, 0)), b = s.cue(ctx("D3", 1, 3)), c = s.cue(ctx("D3", 3, 3));
    expect([a.text, b.text, c.text]).toEqual(["漸強", "漸強", "漸弱"]);
    expect(b.meter!).toBeGreaterThan(a.meter!);
  });
  it("P3：打 4 停 4，響 1 靜 3", () => {
    const s = scriptFor("P3")!;
    expect([0, 3, 4, 7, 8].map((b) => s.cue(ctx("P3", b, 0)).kind)).toEqual(["play", "play", "rest", "rest", "play"]);
    expect(s.config(70, {}).muteOff).toBe(3);
  });
  it("C6：右腳每兩拍，第一小節 1、3 拍，第二小節 2 拍", () => {
    const s = scriptFor("C6")!;
    expect(s.handSteps!(0, s.config(60, {}), {})).toEqual([0, 2]);
    expect(s.handSteps!(1, s.config(60, {}), {})).toEqual([1]);
  });
  it("C5 可選 fill，記錄寫明是哪一個", () => {
    const s = scriptFor("C5")!;
    expect(s.setting({ variant: "H5c" }, 40)).toBe("H5c，10 次");
  });
  it("T6：只在選定的三連音位置提示「打」", () => {
    const s = scriptFor("T6")!;
    expect(s.cue(ctx("T6", 0, 1)).text).toBe("打");
    expect(s.cue(ctx("T6", 0, 2)).text).toBe("—");
    expect(s.config(60, {}).silentSubs).toBe(true);
  });
});
