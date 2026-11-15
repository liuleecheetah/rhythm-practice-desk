import { Metronome } from "@rpd/rhythm";
import type { Report } from "./report";
import { section, button, verdictRow } from "./ui";

const BPM = 120;
const BEATS = 4;
const DURATION_S = 120;

export function defineMetronomeItems(r: Report): void {
  const g = "4.2 Web Audio 節拍器";
  r.define("met.sound", g, "按開始後聽得到點擊聲（靜音撥鍵關閉時）");
  r.define("met.steady", g, "120 BPM 跑滿 2 分鐘，聽起來不漂、不斷");
  r.define("met.visual", g, "環形亮點和聲音對得上");
  r.define("met.wakelock", g, "勾選「防止自動鎖屏」後，2 分鐘內螢幕沒有自動變暗或鎖定");
  r.define("met.background", g, "鎖定螢幕或切到其他 App 後回來，節拍器能接著跑（預期會中斷）");
  r.define("met.silentDefault", g, "靜音撥鍵開啟時，一般模式仍有聲音");
  r.define("met.silentPlayback", g, "靜音撥鍵開啟時，勾選「忽略靜音撥鍵」後有聲音");
}

interface AudioSessionLike { type: string }

function audioSession(): AudioSessionLike | null {
  const n = navigator as unknown as { audioSession?: AudioSessionLike };
  return n.audioSession ?? null;
}

/** 渲染節拍器測試頁，回傳清理函式。 */
export function renderMetronomeTest(root: HTMLElement, report: Report, getVolume: () => number): () => void {
  let ctx: AudioContext | null = null;
  let met: Metronome | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let raf = 0;
  const beatTimes: { time: number; beat: number }[] = [];
  const taps: number[] = [];

  const intro = section(root, `測試內容：${BPM} BPM、4/4、跑 ${DURATION_S / 60} 分鐘`,
    "建議戴耳機。第一次先把靜音撥鍵關掉，確認有聲音；之後再依下方判斷項目逐一測。");

  const opts = intro.createDiv({ cls: "rpd-row" });
  const wlBox = checkbox(opts, "防止自動鎖屏（Screen Wake Lock）", true);
  const as = audioSession();
  const asBox = checkbox(opts, as ? "忽略靜音撥鍵（audioSession＝playback）" : "忽略靜音撥鍵：這台裝置不支援 audioSession", false);
  if (!as) asBox.disabled = true;
  report.setDetail("met.silentPlayback", as ? `支援 audioSession，目前 type=${as.type}` : "不支援 navigator.audioSession");
  report.setDetail("met.wakelock", "wakeLock" in navigator ? "支援 Wake Lock API" : "不支援 Wake Lock API");

  // 環形：4 個點，依音訊時間亮起
  const ring = root.createDiv({ cls: "rpd-ring" });
  const dots: HTMLElement[] = [];
  for (let i = 0; i < BEATS; i++) {
    const d = ring.createDiv({ cls: "rpd-dot" });
    const a = (i / BEATS) * 2 * Math.PI - Math.PI / 2;
    d.style.left = `${50 + 40 * Math.cos(a)}%`;
    d.style.top = `${50 + 40 * Math.sin(a)}%`;
    if (i === 0) d.addClass("rpd-dot-one");
    dots.push(d);
  }
  const center = ring.createDiv({ cls: "rpd-ring-center", text: "—" });

  const stats = root.createDiv({ cls: "rpd-status", text: "尚未開始。" });
  const log = root.createEl("ul", { cls: "rpd-log" });
  const addLog = (t: string) => {
    const sec = ctx ? ctx.currentTime.toFixed(1) : "-";
    log.createEl("li", { text: `[音訊 ${sec}s] ${t}` });
  };

  const controls = root.createDiv({ cls: "rpd-row rpd-bottom" });
  const startBtn = button(controls, "開始", () => void start(), true);
  button(controls, "停止", () => void stop("手動停止"));

  const tapSec = section(root, "跟拍測試（選做，粗略）",
    "節拍器在跑時，聽到點擊就按下方大按鈕，按 16 下。顯示的是按下時間與最近一拍的平均差，包含手指與觸控延遲，只當參考。");
  const tapBtn = tapSec.createEl("button", { cls: "rpd-tap", text: "跟著點擊按這裡" });
  const tapOut = tapSec.createDiv({ cls: "rpd-status" });
  tapBtn.addEventListener("pointerdown", () => {
    if (!ctx || !met?.running || beatTimes.length === 0) return;
    const t = ctx.currentTime;
    let best = Infinity;
    for (const b of beatTimes) if (Math.abs(t - b.time) < Math.abs(best)) best = t - b.time;
    taps.push(best * 1000);
    if (taps.length > 16) taps.shift();
    const mean = taps.reduce((a, b) => a + b, 0) / taps.length;
    const sd = Math.sqrt(taps.reduce((a, b) => a + (b - mean) ** 2, 0) / taps.length);
    tapOut.setText(`${taps.length} 下：平均 ${mean.toFixed(0)} ms（正值＝比點擊晚），標準差 ${sd.toFixed(0)} ms`);
  });

  const v = section(root, "你的判斷");
  for (const k of ["met.sound", "met.steady", "met.visual", "met.wakelock", "met.background", "met.silentDefault", "met.silentPlayback"]) {
    verdictRow(v, report, k);
  }

  const onVis = () => {
    addLog(document.visibilityState === "hidden" ? "頁面進入背景" : "頁面回到前景");
    if (document.visibilityState === "visible" && wlBox.checked && met?.running) void requestWakeLock();
  };
  document.addEventListener("visibilitychange", onVis);

  async function requestWakeLock(): Promise<void> {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      addLog("已取得 Wake Lock");
      wakeLock.addEventListener("release", () => addLog("Wake Lock 被釋放"));
    } catch (e) {
      addLog(`Wake Lock 失敗：${(e as Error).name}`);
      report.setDetail("met.wakelock", `request 失敗：${(e as Error).name}`);
    }
  }

  async function start(): Promise<void> {
    if (met?.running) return;
    if (as) {
      try {
        as.type = asBox.checked ? "playback" : "auto";
      } catch {
        addLog("設定 audioSession 失敗");
      }
    }
    if (!ctx) {
      ctx = new AudioContext();
      ctx.addEventListener("statechange", () => addLog(`AudioContext 狀態：${ctx?.state}`));
    }
    if (ctx.state !== "running") await ctx.resume();
    met?.dispose();
    met = new Metronome(ctx, { bpm: BPM, beatsPerBar: BEATS, accentFirstBeat: true, volume: getVolume() });
    beatTimes.length = 0;
    taps.length = 0;
    met.onSchedule = (e) => {
      beatTimes.push({ time: e.time, beat: e.beatInBar });
      if (beatTimes.length > 16) beatTimes.shift();
    };
    met.start();
    addLog(`開始。audioSession=${as ? as.type : "不支援"}；baseLatency=${fmtMs(ctx.baseLatency)}；outputLatency=${fmtMs((ctx as AudioContext & { outputLatency?: number }).outputLatency)}`);
    if (wlBox.checked) await requestWakeLock();
    startBtn.disabled = true;
    raf = window.requestAnimationFrame(frame);
  }

  async function stop(reason: string): Promise<void> {
    if (!met) return;
    const wasRunning = met.running;
    met.stop();
    window.cancelAnimationFrame(raf);
    dots.forEach((d) => d.removeClass("rpd-dot-on"));
    startBtn.disabled = false;
    if (wakeLock) { await wakeLock.release().catch(() => undefined); wakeLock = null; }
    if (wasRunning) {
      addLog(`${reason}。${summary()}`);
      report.setDetail("met.steady", summary());
    }
  }

  function summary(): string {
    if (!met) return "";
    const s = met.stats;
    const drift = (s.wallElapsed - s.audioElapsed) * 1000;
    return `音訊時間 ${s.audioElapsed.toFixed(1)} 秒、排程 ${s.scheduled} 拍、跳過 ${s.skipped} 拍、` +
      `計時器最長間隔 ${s.maxTimerGapMs.toFixed(0)} ms、最少提前 ${isFinite(s.minLeadMs) ? s.minLeadMs.toFixed(0) : "-"} ms、` +
      `系統時鐘與音訊時鐘差 ${drift.toFixed(0)} ms`;
  }

  let lastStatsUpdate = 0;
  function frame(): void {
    if (!ctx || !met?.running) return;
    const now = ctx.currentTime;
    let cur: { time: number; beat: number } | null = null;
    for (const b of beatTimes) if (b.time <= now) cur = b;
    dots.forEach((d, i) => d.toggleClass("rpd-dot-on", cur !== null && cur.beat === i && now - cur.time < 0.15));
    if (cur) center.setText(String(cur.beat + 1));
    if (performance.now() - lastStatsUpdate > 250) {
      lastStatsUpdate = performance.now();
      stats.setText(`${ctx.state}｜${summary()}`);
    }
    if (met.stats.audioElapsed >= DURATION_S) {
      void stop("跑滿 2 分鐘，自動停止");
      return;
    }
    raf = window.requestAnimationFrame(frame);
  }

  return () => {
    void stop("離開測試頁");
    met?.dispose();
    document.removeEventListener("visibilitychange", onVis);
    void ctx?.close();
  };
}

function checkbox(parent: HTMLElement, label: string, checked: boolean): HTMLInputElement {
  const l = parent.createEl("label", { cls: "rpd-check" });
  const c = l.createEl("input", { type: "checkbox" });
  c.checked = checked;
  l.appendText(label);
  return c;
}

function fmtMs(s: number | undefined): string {
  return typeof s === "number" ? `${(s * 1000).toFixed(1)} ms` : "不支援";
}
