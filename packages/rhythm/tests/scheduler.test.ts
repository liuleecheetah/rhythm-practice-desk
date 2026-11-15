import { describe, it, expect } from "vitest";
import { collectDue, secondsPerBeat } from "../src/scheduler";

describe("collectDue", () => {
  const spb = secondsPerBeat(120); // 0.5 s

  it("只排程視窗內的拍點", () => {
    const r = collectDue({ nextTime: 1, beatIndex: 0 }, 0.95, 0.1, spb, 4);
    expect(r.events.map((e) => e.time)).toEqual([1]);
    expect(r.state).toEqual({ nextTime: 1.5, beatIndex: 1 });
  });

  it("視窗還沒到下一拍時不排程", () => {
    const r = collectDue({ nextTime: 1.5, beatIndex: 1 }, 1.0, 0.1, spb, 4);
    expect(r.events).toEqual([]);
  });

  it("小節內拍號與小節數正確", () => {
    const r = collectDue({ nextTime: 0, beatIndex: 0 }, 0, 2.6, spb, 4);
    expect(r.events.map((e) => [e.bar, e.beatInBar])).toEqual([
      [0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1],
    ]);
  });

  it("2 分鐘、每 25 ms 呼叫一次：拍數正確、間隔不漂", () => {
    let st = { nextTime: 0.1, beatIndex: 0 };
    const times: number[] = [];
    for (let now = 0; now < 120; now += 0.025) {
      const r = collectDue(st, now, 0.1, spb, 4);
      st = r.state;
      times.push(...r.events.map((e) => e.time));
    }
    expect(times.length).toBe(240);
    for (let i = 0; i < times.length; i++) {
      expect(Math.abs(times[i] - (0.1 + i * spb))).toBeLessThan(1e-9);
    }
  });

  it("計時器停擺時不補發，沿格線往前跳", () => {
    const r = collectDue({ nextTime: 1, beatIndex: 2 }, 3.2, 0.1, spb, 4);
    // 1 → 跳過 1, 1.5, 2, 2.5, 3 → 下一拍 3.5 不在 [3.2, 3.3)
    expect(r.skipped).toBe(5);
    expect(r.state.nextTime).toBeCloseTo(3.5, 9);
    expect(r.state.beatIndex).toBe(7);
    expect(r.events).toEqual([]);
  });

  it("參數錯誤時丟出例外", () => {
    expect(() => collectDue({ nextTime: 0, beatIndex: 0 }, 0, 0.1, 0, 4)).toThrow();
  });
});
