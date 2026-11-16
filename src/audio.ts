// 共用一個 AudioContext；執行時防止螢幕自動鎖定。

export class AudioHost {
  private ctx: AudioContext | null = null;
  private wake: WakeLockSentinel | null = null;
  private wantWake = false;

  constructor() {
    document.addEventListener("visibilitychange", this.onVisible);
  }

  /** 必須在使用者點擊的事件裡呼叫（iOS 的限制）。 */
  async context(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === "closed") this.ctx = new AudioContext();
    if (this.ctx.state !== "running") await this.ctx.resume();
    return this.ctx;
  }

  /** 視覺提示的延遲：聲音實際被聽到的時間比排程時間晚多少秒。 */
  outputDelay(): number {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    if (!c) return 0;
    return c.outputLatency || c.baseLatency || 0;
  }

  async keepAwake(on: boolean): Promise<void> {
    this.wantWake = on;
    if (on) await this.requestWake();
    else if (this.wake) {
      await this.wake.release().catch(() => undefined);
      this.wake = null;
    }
  }

  private async requestWake(): Promise<void> {
    if (!("wakeLock" in navigator) || this.wake) return;
    try {
      this.wake = await navigator.wakeLock.request("screen");
      this.wake.addEventListener("release", () => (this.wake = null));
    } catch {
      this.wake = null;
    }
  }

  private onVisible = () => {
    if (document.visibilityState === "visible" && this.wantWake) void this.requestWake();
  };

  dispose(): void {
    document.removeEventListener("visibilitychange", this.onVisible);
    void this.keepAwake(false);
    void this.ctx?.close();
    this.ctx = null;
  }
}
