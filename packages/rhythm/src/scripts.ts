// 練習腳本的純邏輯：決定每小節的靜音、提示文字與結束條件。

import { DEFAULT_CLICK, type ClickConfig } from "./clicks";

// ---------- T2 四拍的靜音測試 ----------

export interface MuteLevel {
  label: string;
  on: number;
  off: number;
  /** 過關判定用的那一級 */
  passLevel?: boolean;
  /** 選配 */
  optional?: boolean;
}

/** COURSE.md T2 第 1、3、4、5 步 */
export const T2_LEVELS: MuteLevel[] = [
  { label: "全開", on: 0, off: 0 },
  { label: "響2靜2", on: 2, off: 2 },
  { label: "響1靜3", on: 1, off: 3, passLevel: true },
  { label: "響1靜7", on: 1, off: 7, optional: true },
];
export const T2_PASS_SECONDS = 180;

export function t2Config(bpm: number): ClickConfig {
  // 只有第 1 拍有較大的提示音；節拍器每拍一下，八分音符由你打
  return { ...DEFAULT_CLICK, bpm, meter: "4/4", subdivision: 1, accentFirst: true, muteOn: 0, muteOff: 0, countIn: true };
}

// ---------- H5 四個固定的 fill ----------

export type H5Variant = "H5a" | "H5b" | "H5c" | "H5d";
export const H5_VARIANTS: H5Variant[] = ["H5a", "H5b", "H5c", "H5d"];

/** fromBeat：fill 從第 4 小節的第幾拍開始（0 起算） */
export const H5_FILLS: Record<H5Variant, { fromBeat: number; kind: string; hits: number; where: string }> = {
  H5a: { fromBeat: 3, kind: "十六分", hits: 4, where: "第 4 拍" },
  H5b: { fromBeat: 2, kind: "十六分", hits: 8, where: "第 3、4 拍" },
  H5c: { fromBeat: 0, kind: "十六分", hits: 16, where: "整小節" },
  H5d: { fromBeat: 2, kind: "三連音", hits: 6, where: "第 3、4 拍" },
};
export const H5_TARGET = 10;

export function isH5(id: string): id is H5Variant {
  return (H5_VARIANTS as string[]).includes(id);
}

export function h5Config(bpm: number): ClickConfig {
  // 響 1 靜 3：節拍器只在 fill 之後的那一小節有聲音
  return { ...DEFAULT_CLICK, bpm, meter: "4/4", subdivision: 1, accentFirst: true, muteOn: 1, muteOff: 3, countIn: true };
}

export interface H5BarInfo {
  /** 1–4 */
  cycleBar: number;
  isFillBar: boolean;
  /** 進入這一小節時，已經完成幾次 fill（回到第 1 拍） */
  completed: number;
}

export function h5Bar(bar: number): H5BarInfo {
  return { cycleBar: (bar % 4) + 1, isFillBar: bar % 4 === 3, completed: Math.floor(bar / 4) };
}

export type CueKind = "groove" | "ready" | "fill" | "return";

export function h5Cue(v: H5Variant, bar: number, beat: number): { text: string; kind: CueKind } {
  const info = h5Bar(bar);
  const f = H5_FILLS[v];
  if (info.cycleBar === 1 && beat === 0 && bar > 0) return { text: "回到 1", kind: "return" };
  if (!info.isFillBar) return { text: "八分音符", kind: "groove" };
  if (beat < f.fromBeat) return { text: "八分音符，接著 fill", kind: "ready" };
  return { text: `fill：${f.kind} ${f.hits} 下`, kind: "fill" };
}

/** 第 10 次回到第 1 拍的那一小節打完後結束 */
export function h5ShouldStop(bar: number): boolean {
  return bar >= H5_TARGET * 4 + 1;
}
