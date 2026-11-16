// 共用一個 AudioContext；執行時防止螢幕自動鎖定。

export class AudioHost {
  private ctx: AudioContext | null = null;
  private wake: WakeLockSentinel | null = null;
  private wantWake = false;

  constructor() {
    document.addEventListener("visibilitychange", this.onVisible);
  }

  /**
   * 必須在使用者點擊的事件裡呼叫（iOS 的限制）。
   * iOS 會把音訊「打斷」（interrupted，例如其他 App 播放聲音、來電、長時間在背景），
   * 這時 resume() 可能一直不回應；所以被打斷的就直接換一個新的，resume 也設時限。
   */
  async context(): Promise<AudioContext> {
    const state = this.ctx?.state as string | undefined;
    if (!this.ctx || state === "closed" || state === "interrupted") this.replace();
    const ctx = this.ctx!;
    if (ctx.state !== "running") {
      const ok = await withTimeout(ctx.resume().then(() => true, () => false), 1500, false);
      if (!ok || (ctx.state as string) !== "running") {
        // 換一個新的再試一次
        this.replace();
        await withTimeout(this.ctx!.resume().then(() => true, () => false), 1500, false);
      }
    }
    if ((this.ctx!.state as string) !== "running") throw new Error(`聲音沒有啟動（狀態：${this.ctx!.state}）。請再按一次開始；若仍無聲，請把 Obsidian 完全關閉再開`);
    return this.ctx!;
  }

  private replace(): void {
    const old = this.ctx;
    this.ctx = new AudioContext();
    if (old && old.state !== "closed") void old.close().catch(() => undefined);
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

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(fallback), ms);
    p.then((v) => {
      window.clearTimeout(t);
      resolve(v);
    });
  });
}
