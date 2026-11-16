// Web Audio 節拍器引擎。發聲時間一律由 AudioContext.currentTime 決定；
// setTimeout 只負責每 ~25 ms 喚醒排程器，不直接觸發發聲。

import { collectDue, type ClickState } from "./scheduler";
import { isMutedBar, levelAt, stepSeconds, stepsPerBar, type ClickConfig, type ClickLevel } from "./clicks";

export interface StepEvent {
  /** 發聲（或應該發聲）的音訊時間 */
  time: number;
  /** 引擎的小節序號（含預備拍） */
  globalBar: number;
  /** 練習小節序號（預備拍為 -1） */
  bar: number;
  step: number;
  stepsPerBar: number;
  countIn: boolean;
  muted: boolean;
  level: ClickLevel;
  /** 這一格實際有發聲 */
  sounded: boolean;
}

export interface MetronomeStats {
  scheduled: number;
  skipped: number;
  maxTimerGapMs: number;
  minLeadMs: number;
}

export const LOOKAHEAD_MS = 25;
export const SCHEDULE_AHEAD_S = 0.1;
/** 頁面在背景時計時器會被放慢，排程視窗拉長以減少斷音（沿用節奏練習台.html 的做法） */
export const SCHEDULE_AHEAD_HIDDEN_S = 0.6;

const FREQ: Record<ClickLevel, number> = { accent: 1600, group: 1300, beat: 1000, sub: 800 };
const GAIN: Record<ClickLevel, number> = { accent: 1, group: 0.85, beat: 0.7, sub: 0.35 };

export class Metronome {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private state: ClickState = { nextTime: 0, beatIndex: 0 };
  private cfg: ClickConfig;
  private lastWake = 0;
  private master: GainNode;
  /** 靜音設定開始生效的練習小節 */
  private muteEpoch = 0;
  private active = false;
  private lastBar = -1;
  /** 練習開始（預備拍之後第一小節）的音訊時間 */
  practiceStart = 0;
  stats: MetronomeStats = { scheduled: 0, skipped: 0, maxTimerGapMs: 0, minLeadMs: Infinity };
  onStep: ((e: StepEvent) => void) | null = null;
  /** 每個小節開始被排程時呼叫（腳本用來改設定、計數）。 */
  onBar: ((bar: number, time: number) => void) | null = null;

  constructor(readonly ctx: AudioContext, cfg: ClickConfig, volume = 0.8) {
    this.cfg = { ...cfg };
    this.master = ctx.createGain();
    this.master.gain.value = volume;
    this.master.connect(ctx.destination);
  }

  get running(): boolean {
    return this.active;
  }

  get config(): Readonly<ClickConfig> {
    return this.cfg;
  }

  setVolume(v: number): void {
    this.master.gain.value = v;
  }

  /** 改速度可在執行中進行，從下一格起生效。 */
  setBpm(bpm: number): void {
    this.cfg.bpm = bpm;
  }

  /** 改靜音設定：從下一個尚未排程的小節起算。 */
  setMute(on: number, off: number): void {
    this.cfg.muteOn = on;
    this.cfg.muteOff = off;
    const nextPracticeBar = this.lastBar + 1 - (this.cfg.countIn ? 1 : 0);
    this.muteEpoch = Math.max(0, nextPracticeBar);
  }

  /** 7/8 換分組（格數不變，只改重音位置），從下一格起生效。 */
  setGrouping7(g: ClickConfig["grouping7"]): void {
    this.cfg.grouping7 = g;
  }

  /** 拍號、細分等會改變格線的設定，執行中改動時重新開始。 */
  setConfig(p: Partial<ClickConfig>): void {
    const wasRunning = this.running;
    if (wasRunning) this.stop();
    Object.assign(this.cfg, p);
    if (wasRunning) this.start();
  }

  start(): void {
    if (this.running) return;
    const t0 = this.ctx.currentTime + 0.12;
    this.state = { nextTime: t0, beatIndex: 0 };
    this.stats = { scheduled: 0, skipped: 0, maxTimerGapMs: 0, minLeadMs: Infinity };
    this.muteEpoch = 0;
    this.lastBar = -1;
    const barLen = stepsPerBar(this.cfg) * stepSeconds(this.cfg);
    this.practiceStart = this.cfg.countIn ? t0 + barLen : t0;
    this.lastWake = now();
    this.active = true;
    this.tick();
  }

  stop(): void {
    this.active = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.stop();
    this.master.disconnect();
  }

  /** 從練習開始起經過的秒數（預備拍期間為負）。 */
  elapsed(): number {
    return this.ctx.currentTime - this.practiceStart;
  }

  private tick = (): void => {
    const wall = now();
    this.stats.maxTimerGapMs = Math.max(this.stats.maxTimerGapMs, wall - this.lastWake);
    this.lastWake = wall;

    const t = this.ctx.currentTime;
    const hidden = typeof document !== "undefined" && document.hidden;
    const spb = stepsPerBar(this.cfg);
    const r = collectDue(this.state, t, hidden ? SCHEDULE_AHEAD_HIDDEN_S : SCHEDULE_AHEAD_S, stepSeconds(this.cfg), spb);
    this.state = r.state;
    this.stats.skipped += r.skipped;
    for (const e of r.events) {
      if (!this.active) break; // 腳本在 onBar／onStep 裡停止了
      const countIn = this.cfg.countIn && e.bar === 0;
      const bar = this.cfg.countIn ? e.bar - 1 : e.bar;
      if (e.beatInBar === 0 && e.bar !== this.lastBar) {
        this.lastBar = e.bar;
        if (!countIn) this.onBar?.(bar, e.time);
      }
      if (!this.active) break;
      // onBar 可能改了靜音設定，所以在它之後判斷
      const muted = !countIn && isMutedBar(bar, this.cfg.muteOn, this.cfg.muteOff, this.muteEpoch);
      const level = levelAt(this.cfg, e.beatInBar);
      // 預備拍只響拍點，不響細分
      const sounded = !muted && !(level === "sub" && (countIn || this.cfg.silentSubs));
      if (sounded) this.click(e.time, level);
      this.stats.minLeadMs = Math.min(this.stats.minLeadMs, (e.time - t) * 1000);
      this.stats.scheduled += 1;
      this.onStep?.({ time: e.time, globalBar: e.bar, bar, step: e.beatInBar, stepsPerBar: spb, countIn, muted, level, sounded });
    }
    this.timer = this.active ? setTimeout(this.tick, LOOKAHEAD_MS) : null;
  };

  private click(time: number, level: ClickLevel): void {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.value = FREQ[level];
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(GAIN[level], time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(env).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.05);
  }
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
