// Web Audio 節拍器引擎。發聲時間一律由 AudioContext.currentTime 決定；
// setTimeout 只負責每 ~25 ms 喚醒排程器，不直接觸發發聲。

import { collectDue, secondsPerBeat, type ClickEvent, type ClickState } from "./scheduler";

export interface MetronomeOptions {
  bpm: number;
  beatsPerBar: number;
  /** 第 1 拍用較高的提示音 */
  accentFirstBeat: boolean;
  /** 0–1 */
  volume: number;
}

export interface MetronomeStats {
  /** 已排程發聲的拍數 */
  scheduled: number;
  /** 計時器停擺而跳過的拍數 */
  skipped: number;
  /** 排程器兩次喚醒之間最長的間隔（ms） */
  maxTimerGapMs: number;
  /** 排程時距離發聲時間最少剩多少 ms（負值代表排得太晚） */
  minLeadMs: number;
  /** 開始以來音訊時鐘經過的秒數 */
  audioElapsed: number;
  /** 開始以來系統時鐘經過的秒數 */
  wallElapsed: number;
}

export const LOOKAHEAD_MS = 25;
export const SCHEDULE_AHEAD_S = 0.1;

export class Metronome {
  private timer: number | null = null;
  private state: ClickState = { nextTime: 0, beatIndex: 0 };
  private opts: MetronomeOptions;
  private startAudio = 0;
  private startWall = 0;
  private lastWake = 0;
  private master: GainNode;
  stats: MetronomeStats = this.emptyStats();
  /** 每排程一拍就呼叫（time 是未來的音訊時間，供視覺同步用） */
  onSchedule: ((e: ClickEvent) => void) | null = null;

  constructor(readonly ctx: AudioContext, opts: MetronomeOptions) {
    this.opts = { ...opts };
    this.master = ctx.createGain();
    this.master.gain.value = opts.volume;
    this.master.connect(ctx.destination);
  }

  get running(): boolean {
    return this.timer !== null;
  }

  setOptions(p: Partial<MetronomeOptions>): void {
    Object.assign(this.opts, p);
    this.master.gain.value = this.opts.volume;
  }

  start(): void {
    if (this.running) return;
    const now = this.ctx.currentTime;
    this.state = { nextTime: now + 0.1, beatIndex: 0 };
    this.stats = this.emptyStats();
    this.startAudio = this.state.nextTime;
    this.startWall = performance.now() / 1000 + 0.1;
    this.lastWake = performance.now();
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.stop();
    this.master.disconnect();
  }

  private tick = (): void => {
    const wall = performance.now();
    this.stats.maxTimerGapMs = Math.max(this.stats.maxTimerGapMs, wall - this.lastWake);
    this.lastWake = wall;

    const now = this.ctx.currentTime;
    const r = collectDue(this.state, now, SCHEDULE_AHEAD_S, secondsPerBeat(this.opts.bpm), this.opts.beatsPerBar);
    this.state = r.state;
    this.stats.skipped += r.skipped;
    for (const e of r.events) {
      this.stats.minLeadMs = Math.min(this.stats.minLeadMs, (e.time - now) * 1000);
      this.click(e.time, this.opts.accentFirstBeat && e.beatInBar === 0);
      this.stats.scheduled += 1;
      this.onSchedule?.(e);
    }
    this.stats.audioElapsed = Math.max(0, now - this.startAudio);
    this.stats.wallElapsed = Math.max(0, wall / 1000 - this.startWall);
    this.timer = window.setTimeout(this.tick, LOOKAHEAD_MS);
  };

  private click(time: number, accent: boolean): void {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(1, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(env).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  private emptyStats(): MetronomeStats {
    return { scheduled: 0, skipped: 0, maxTimerGapMs: 0, minLeadMs: Infinity, audioElapsed: 0, wallElapsed: 0 };
  }
}
