// 驅動節拍器並把環形畫面對齊「聽到的時間」。

import { Metronome, effectiveSubdivision, groupStarts, stepsPerBar, type ClickConfig, type StepEvent } from "@rpd/rhythm";
import type RhythmPracticeDesk from "../main";
import type { Ring } from "./ring";

export interface PlayerHooks {
  /** 每小節開始被排程時（約提前 0.1 秒） */
  onBar?: (bar: number) => void;
  /** 每一格被聽到時（畫面更新用） */
  onHeard?: (e: StepEvent) => void;
}

export class Player {
  met: Metronome | null = null;
  private queue: StepEvent[] = [];
  private raf = 0;
  private handSteps: Set<number> | undefined;

  constructor(private plugin: RhythmPracticeDesk, private ring: Ring) {}

  get running(): boolean {
    return !!this.met?.running;
  }

  layout(cfg: ClickConfig, handSteps?: Set<number>): void {
    this.handSteps = handSteps;
    this.ring.layout({
      steps: stepsPerBar(cfg),
      sub: effectiveSubdivision(cfg),
      groupStarts: cfg.meter === "7/8" ? groupStarts(cfg) : [],
      handSteps,
    });
  }

  async start(cfg: ClickConfig, hooks: PlayerHooks = {}): Promise<void> {
    this.stop();
    const ctx = await this.plugin.audio.context();
    const met = new Metronome(ctx, cfg, this.plugin.settings.volume);
    this.met = met;
    this.queue = [];
    met.onStep = (e) => this.queue.push(e);
    met.onBar = (bar) => hooks.onBar?.(bar);
    this.layout(cfg, this.handSteps);
    met.start();
    void this.plugin.audio.keepAwake(true);
    const loop = () => {
      if (!this.met || this.met !== met) return;
      const heardNow = ctx.currentTime - this.plugin.audio.outputDelay();
      let last: StepEvent | null = null;
      while (this.queue.length && this.queue[0].time <= heardNow) last = this.queue.shift()!;
      if (last) {
        this.ring.setActive(last.step, last.sounded);
        this.ring.setMuted(last.muted);
        hooks.onHeard?.(last);
      }
      if (met.running || this.queue.length) this.raf = window.requestAnimationFrame(loop);
    };
    this.raf = window.requestAnimationFrame(loop);
  }

  stop(): void {
    window.cancelAnimationFrame(this.raf);
    if (this.met) {
      this.met.dispose();
      this.met = null;
    }
    this.queue = [];
    this.ring.clear();
    this.ring.setMuted(false);
    void this.plugin.audio.keepAwake(false);
  }
}
