import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Metronome, type StepEvent } from "../src/metronome";
import { DEFAULT_CLICK } from "../src/clicks";

// 假的 AudioContext：時間由測試推進，只記錄發聲時間
class FakeCtx {
  currentTime = 0;
  clicks: number[] = [];
  destination = {};
  createGain() {
    return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n, disconnect() {} };
  }
  createOscillator() {
    const self = this;
    return { frequency: { value: 0 }, connect: (n: unknown) => n, start(t: number) { self.clicks.push(t); }, stop() {} };
  }
}

function run(m: Metronome, ctx: FakeCtx, seconds: number) {
  for (let t = 0; t < seconds; t += 0.025) {
    ctx.currentTime = t;
    vi.advanceTimersByTime(25);
  }
}

describe("Metronome", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("預備拍一小節後，響 1 靜 3：只有每 4 小節的第 1 小節發聲", () => {
    const ctx = new FakeCtx();
    const m = new Metronome(ctx as unknown as AudioContext, { ...DEFAULT_CLICK, bpm: 120, muteOn: 1, muteOff: 3 });
    const steps: StepEvent[] = [];
    m.onStep = (e) => steps.push(e);
    m.start();
    run(m, ctx, 2 * 9 + 0.3); // 預備 1 小節＋8 小節（每小節 2 秒）
    m.stop();
    const soundedBars = [...new Set(steps.filter((s) => s.sounded).map((s) => s.bar))];
    expect(soundedBars).toEqual([-1, 0, 4, 8]);
    expect(steps.filter((s) => s.countIn)).toHaveLength(4);
  });

  it("中途改靜音設定，從下一小節重新起算", () => {
    const ctx = new FakeCtx();
    const m = new Metronome(ctx as unknown as AudioContext, { ...DEFAULT_CLICK, bpm: 120, countIn: false });
    const steps: StepEvent[] = [];
    m.onStep = (e) => steps.push(e);
    m.onBar = (bar) => { if (bar === 2) m.setMute(1, 3); };
    m.start();
    run(m, ctx, 2 * 8);
    m.stop();
    const muted = [...new Set(steps.filter((s) => s.muted).map((s) => s.bar))];
    // 第 2 小節開始排程時改設定 → 生效於第 3 小節：3 響、4–6 靜、7 響
    expect(muted).toEqual([4, 5, 6]);
  });

  it("在 onBar 裡停止，引擎不會繼續排程", () => {
    const ctx = new FakeCtx();
    const m = new Metronome(ctx as unknown as AudioContext, { ...DEFAULT_CLICK, bpm: 120, countIn: false });
    m.onBar = (bar) => { if (bar === 2) m.stop(); };
    m.start();
    run(m, ctx, 10);
    expect(m.running).toBe(false);
    expect(ctx.clicks.length).toBe(8); // 0、1 兩小節
  });

  it("拍點間隔一致（3 分鐘，70 BPM 八分）", () => {
    const ctx = new FakeCtx();
    const m = new Metronome(ctx as unknown as AudioContext, { ...DEFAULT_CLICK, bpm: 70, subdivision: 2, countIn: false });
    m.start();
    run(m, ctx, 180);
    m.stop();
    const step = 60 / 70 / 2;
    ctx.clicks.forEach((t, i) => expect(Math.abs(t - (ctx.clicks[0] + i * step))).toBeLessThan(1e-9));
    expect(ctx.clicks.length).toBeGreaterThan(415);
  });
});
