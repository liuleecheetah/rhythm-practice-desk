// 29 個練習的腳本（純邏輯）。每個腳本決定：節拍器設定、每小節／每格的提示、結束條件、記錄的 setting。
// 內容依 COURSE.md 的做法；腳本只提示，不判定打得準不準（過關由使用者自評）。

import { DEFAULT_CLICK, GROUPINGS_7, GROUPING_7_IDS, SUBDIVISION_LABELS, type ClickConfig, type Grouping7, type Subdivision } from "./clicks";
import { H5_FILLS, H5_TARGET, H5_VARIANTS, T2_LEVELS, T2_PASS_SECONDS, h5Bar, h5Cue, type H5Variant, type MuteLevel } from "./scripts";
import { exerciseById } from "./course";

export type CueKind = "groove" | "ready" | "fill" | "return" | "rest" | "play" | "change" | "foot" | "";

export interface Cue {
  text: string;
  kind?: CueKind;
  /** 第二行說明 */
  detail?: string;
  /** 0–1，D3 的音量弧線 */
  meter?: number;
}

export interface CueContext {
  bar: number;
  step: number;
  cfg: ClickConfig;
  muted: boolean;
  opts: ScriptOptions;
  level?: MuteLevel;
}

export interface ScriptOptions {
  variant?: string;
  grouping7?: Grouping7;
  positions?: number[];
  accent?: boolean;
}

export interface ScriptOption {
  key: keyof ScriptOptions;
  label: string;
  choices: { value: string | number | boolean; label: string }[];
  multi?: boolean;
}

export type Target = { kind: "seconds"; value: number } | { kind: "bars"; value: number };

export interface ExerciseScript {
  id: string;
  /** false：不用節拍器，只計時（例如 D4、P4） */
  clicks: boolean;
  /** 課程沒有指定速度時用的預設，並在畫面上註明 */
  fallbackBpm?: number;
  config(bpm: number, o: ScriptOptions): ClickConfig;
  options?: ScriptOption[];
  defaults?: ScriptOptions;
  /** 可在執行中切換的靜音級別（T2、T4） */
  levels?: MuteLevel[];
  /** 結束條件；有 levels 時只在 passLevel 那一級計算 */
  target?: Target;
  /** 每小節開始時要改的設定（T5 換分組） */
  barUpdate?(bar: number, o: ScriptOptions): Partial<ClickConfig> | null;
  /** 環上標成「皮」的格（格的序號，與 StepEvent.step 相同） */
  handSteps?(bar: number, cfg: ClickConfig, o: ScriptOptions): number[];
  cue(c: CueContext): Cue;
  /** 進度文字，例如「第 2 輪 / 3」 */
  progress?(bar: number, o: ScriptOptions): string;
  /** 記錄的 setting 欄位 */
  setting(o: ScriptOptions, lastBar: number, level?: MuteLevel): string;
  /** 只計時的腳本顯示的固定說明 */
  instructions?: string;
}

const base = (bpm: number, p: Partial<ClickConfig> = {}): ClickConfig => ({ ...DEFAULT_CLICK, bpm, subdivision: 1, ...p });
const beatOf = (c: CueContext) => Math.floor(c.step / (c.cfg.meter === "7/8" ? 1 : c.cfg.subdivision));
const isLastBeat = (c: CueContext) => {
  const beats = c.cfg.meter === "3/4" ? 3 : c.cfg.meter === "7/8" ? 7 : 4;
  return beatOf(c) === beats - 1;
};

// ---------- T1／C2：每 2 小節更換細分 ----------
export const T1_SEQUENCE: Subdivision[] = [1, 2, 3, 4, 3, 2, 1];
const T1_BARS_PER_ROUND = T1_SEQUENCE.length * 2;
function t1Cue(c: CueContext, feet = false): Cue {
  const i = Math.floor(c.bar / 2) % T1_SEQUENCE.length;
  const cur = SUBDIVISION_LABELS[T1_SEQUENCE[i]];
  const next = SUBDIVISION_LABELS[T1_SEQUENCE[(i + 1) % T1_SEQUENCE.length]];
  const prefix = feet ? "腳每拍踩｜手：" : "";
  if (c.bar % 2 === 1 && isLastBeat(c)) return { text: `${prefix}${cur}`, kind: "change", detail: `下一小節換：${next}` };
  return { text: `${prefix}${cur}`, kind: "groove", detail: `${(c.bar % 2) + 1} / 2 小節` };
}
const t1Progress = (bar: number) => `第 ${Math.min(3, Math.floor(bar / T1_BARS_PER_ROUND) + 1)} 輪 / 3`;

// ---------- D2／C4：移動重音 ----------
export const D2_PATTERNS = ["Rlrl", "rLrl", "rlRl", "rlrL"];
function d2Cue(c: CueContext, feet = false): Cue {
  const i = Math.floor(c.bar / 4) % 4;
  const prefix = feet ? "腳每拍踩｜手：" : "";
  if (c.bar % 4 === 3 && isLastBeat(c) && i < 3) return { text: `${prefix}${D2_PATTERNS[i]}`, kind: "change", detail: `下一小節換：${D2_PATTERNS[i + 1]}` };
  return { text: `${prefix}${D2_PATTERNS[i]}`, kind: "groove", detail: `每拍第 ${i + 1} 下重音｜${(c.bar % 4) + 1} / 4 小節` };
}

// ---------- T5：七拍三種分組 ----------
export const T5_ORDER: Grouping7[] = ["2+2+3", "3+2+2", "2+3+2"];
const T5_SAY: Record<Grouping7, string> = { "2+2+3": "1-2、1-2、1-2-3", "3+2+2": "1-2-3、1-2、1-2", "2+3+2": "1-2、1-2-3、1-2" };
const T5_HANDS: Record<Grouping7, string> = { "2+2+3": "右左、右左、右左左", "3+2+2": "右左左、右左、右左", "2+3+2": "右左、右左左、右左" };

// ---------- 靜音測試（T2、T4） ----------
function muteTest(id: string, meter: "4/4" | "3/4"): ExerciseScript {
  return {
    id,
    clicks: true,
    config: (bpm) => base(bpm, { meter, accentFirst: true }),
    levels: T2_LEVELS,
    target: { kind: "seconds", value: T2_PASS_SECONDS },
    cue: (c) => ({ text: `${c.level?.label ?? ""}｜${c.muted ? "靜" : "響"}`, kind: c.muted ? "rest" : "", detail: "八分音符，右左右左；每小節第一下打大聲" }),
    setting: (_o, _b, level) => level?.label ?? "",
  };
}

function timed(id: string, seconds: number, cfg: (bpm: number, o: ScriptOptions) => ClickConfig, cue: (c: CueContext) => Cue, extra: Partial<ExerciseScript> = {}): ExerciseScript {
  return {
    id,
    clicks: true,
    config: cfg,
    target: { kind: "seconds", value: seconds },
    cue,
    setting: () => `${Math.round(seconds / 60)} 分鐘`,
    ...extra,
  };
}

const h5Script = (id: string, feet: boolean): ExerciseScript => ({
  id,
  clicks: true,
  config: (bpm) => base(bpm, { muteOn: 1, muteOff: 3 }),
  options: feet ? [{ key: "variant", label: "fill", choices: H5_VARIANTS.map((v) => ({ value: v, label: `${v}（${H5_FILLS[v].where}${H5_FILLS[v].kind}）` })) }] : undefined,
  defaults: feet ? { variant: "H5a" } : undefined,
  target: { kind: "bars", value: H5_TARGET * 4 + 1 },
  handSteps: (_bar, _cfg, o) => {
    const f = H5_FILLS[(o.variant ?? id) as H5Variant];
    return Array.from({ length: 4 - f.fromBeat }, (_, i) => f.fromBeat + i);
  },
  cue: (c) => {
    const v = (c.opts.variant ?? id) as H5Variant;
    const cue = h5Cue(v, c.bar, c.step);
    return { text: feet ? `腳每拍踩｜${cue.text}` : cue.text, kind: cue.kind, detail: `第 ${h5Bar(c.bar).cycleBar} 小節（4 小節一輪）` };
  },
  progress: (bar) => `已完成 ${h5Bar(Math.max(0, bar)).completed} / ${H5_TARGET} 次`,
  setting: (o, lastBar) => `${feet ? `${o.variant ?? "H5a"}，` : ""}${h5Bar(Math.max(0, lastBar)).completed} 次`,
});

const STICKING: Record<string, string> = { H1: "RLRL", H2: "LRLR", H3: "RRLL", H4: "RLRR LRLL" };
const T6_POSITIONS = [
  { value: 1, label: "第 1 拍第 2 下" },
  { value: 5, label: "第 2 拍第 3 下" },
  { value: 10, label: "第 4 拍第 2 下" },
];

const SCRIPT_LIST: ExerciseScript[] = [
  {
    id: "T1",
    clicks: true,
    config: (bpm) => base(bpm),
    target: { kind: "bars", value: T1_BARS_PER_ROUND * 3 },
    cue: (c) => t1Cue(c),
    progress: t1Progress,
    setting: (_o, lastBar) => `${Math.floor((lastBar + 1) / T1_BARS_PER_ROUND)} 輪`,
  },
  muteTest("T2", "4/4"),
  timed("T3", 120, (bpm) => base(bpm, { subdivision: 4, silentSubs: true }), () => ({ text: "每拍打一下", detail: "兩下之間，心裡默數四個等分" })),
  muteTest("T4", "3/4"),
  {
    id: "T5",
    clicks: true,
    config: (bpm, o) => base(bpm, { meter: "7/8", grouping7: T5_ORDER[0], accentGroups: o.accent !== false }),
    options: [{ key: "accent", label: "分組起點提示音", choices: [{ value: true, label: "開（第 1–3 步）" }, { value: false, label: "關（第 4 步：每一下一樣大聲）" }] }],
    defaults: { accent: true },
    target: { kind: "bars", value: 12 },
    barUpdate: (bar) => ({ grouping7: T5_ORDER[Math.floor(bar / 4) % 3] }),
    cue: (c) => {
      const g = T5_ORDER[Math.floor(c.bar / 4) % 3];
      return { text: g, kind: c.bar % 4 === 3 && c.step === 6 && c.bar < 11 ? "change" : "groove", detail: `念：${T5_SAY[g]}｜手：${T5_HANDS[g]}` };
    },
    progress: (bar) => `分組 ${Math.min(3, Math.floor(bar / 4) + 1)} / 3｜第 ${(bar % 4) + 1} / 4 輪`,
    setting: (o) => `三種分組${o.accent === false ? "，提示音關" : ""}`,
  },
  {
    id: "T6",
    clicks: true,
    config: (bpm) => base(bpm, { subdivision: 3, silentSubs: true }),
    options: [{ key: "positions", label: "要打的位置（可複選）", multi: true, choices: T6_POSITIONS }],
    defaults: { positions: [1] },
    target: { kind: "bars", value: 8 },
    handSteps: (_b, _c, o) => o.positions ?? [1],
    cue: (c) => ((c.opts.positions ?? [1]).includes(c.step) ? { text: "打", kind: "fill" } : { text: "—", detail: "每拍心裡數三下" }),
    progress: (bar) => `第 ${Math.min(8, bar + 1)} / 8 小節`,
    setting: (o) => (o.positions ?? [1]).map((p) => T6_POSITIONS.find((x) => x.value === p)?.label).join("、"),
  },
  ...["H1", "H2", "H3", "H4"].map((id) =>
    timed(id, 120, (bpm) => base(bpm), () => ({ text: STICKING[id], detail: "八分音符，每一下一樣大聲；用手機錄音" })),
  ),
  ...(["H5a", "H5b", "H5c", "H5d"] as const).map((id) => h5Script(id, false)),
  {
    id: "D1",
    clicks: true,
    config: (bpm) => base(bpm),
    cue: (c) => (c.bar % 8 < 4 ? { text: "輕音", kind: "rest", detail: "抬離打擊面幾公分" } : { text: "重音", kind: "play", detail: "抬高；音量靠高度，不靠往下壓" }),
    progress: (bar) => `第 ${(bar % 8) + 1} / 8 小節`,
    setting: () => "4 小節輕／4 小節重",
  },
  {
    id: "D2",
    clicks: true,
    config: (bpm) => base(bpm),
    target: { kind: "bars", value: 16 },
    cue: (c) => d2Cue(c),
    progress: (bar) => `第 ${Math.min(4, Math.floor(bar / 4) + 1)} / 4 種`,
    setting: () => "四種一輪",
  },
  {
    id: "D3",
    clicks: true,
    config: (bpm) => base(bpm, { muteOn: 1, muteOff: 3 }),
    cue: (c) => {
      const steps = c.cfg.meter === "3/4" ? 3 : 4;
      const pos = ((c.bar % 4) + c.step / steps) / 4;
      return pos < 0.5 ? { text: "漸強", kind: "play", meter: pos * 2 } : { text: "漸弱", kind: "rest", meter: (1 - pos) * 2 };
    },
    progress: (bar) => `${(bar % 4) + 1} / 4 小節｜節拍器響 1 靜 3`,
    setting: () => "響1靜3",
  },
  {
    id: "D4",
    clicks: false,
    config: (bpm) => base(bpm),
    instructions: "bass、tone、slap 各連打 8 下，左右手輪流，用手機錄音。只在橋下做。",
    cue: () => ({ text: "" }),
    setting: () => "bass／tone／slap 各 8 下",
  },
  timed("C1", 180, (bpm) => base(bpm), () => ({ text: "腳每拍踩一下，手不動", detail: "可以閉眼；三分鐘後睜眼確認" })),
  {
    id: "C2",
    clicks: true,
    config: (bpm) => base(bpm),
    target: { kind: "bars", value: T1_BARS_PER_ROUND * 3 },
    cue: (c) => t1Cue(c, true),
    progress: t1Progress,
    setting: (_o, lastBar) => `${Math.floor((lastBar + 1) / T1_BARS_PER_ROUND)} 輪`,
  },
  timed("C3", 120, (bpm) => base(bpm), (c) => (beatOf(c) % 2 === 1 ? { text: "腳踩", kind: "foot", detail: "手：八分音符單擊" } : { text: "—", detail: "手：八分音符單擊；腳只踩第 2、4 拍" }), {
    handSteps: () => [1, 3],
  }),
  {
    id: "C4",
    clicks: true,
    config: (bpm) => base(bpm),
    target: { kind: "bars", value: 16 },
    cue: (c) => d2Cue(c, true),
    progress: (bar) => `第 ${Math.min(4, Math.floor(bar / 4) + 1)} / 4 種`,
    setting: () => "四種一輪",
  },
  h5Script("C5", true),
  timed("C6", 120, (bpm) => base(bpm, { meter: "3/4" }), (c) => {
    const right = c.bar % 2 === 0 ? [0, 2] : [1];
    return right.includes(c.step) ? { text: "右腳＋左腳", kind: "foot", detail: `右腳在這一小節踩第 ${right.map((x) => x + 1).join("、")} 拍` } : { text: "左腳", detail: `右腳在這一小節踩第 ${right.map((x) => x + 1).join("、")} 拍` };
  }, {
    fallbackBpm: 60,
    handSteps: (bar) => (bar % 2 === 0 ? [0, 2] : [1]),
  }),
  timed("P1", 180, (bpm) => base(bpm), (c) => {
    const n = (c.bar % 4) + 1;
    return n === 4 ? { text: `第 ${n} 小節`, kind: "fill", detail: "加一個已過關的 fill；出聲數「4 2 3 4」" } : { text: `第 ${n} 小節`, detail: `八分音符；出聲數「${n} 2 3 4」` };
  }),
  timed("P2", 180, (bpm) => base(bpm), (c) => {
    const n = (c.bar % 8) + 1;
    if (n === 8) return { text: `第 ${n} 小節`, kind: "fill", detail: "加 fill" };
    if (n === 4 && c.step === 0) return { text: `第 ${n} 小節`, kind: "play", detail: "第 1 拍打一下特別大聲的重音" };
    return { text: `第 ${n} 小節`, detail: "八分音符" };
  }),
  timed("P3", 180, (bpm) => base(bpm, { muteOn: 1, muteOff: 3 }), (c) => {
    const n = c.bar % 8;
    return n < 4 ? { text: `打 ${n + 1}/4`, kind: "play", detail: "八分音符；腳每拍踩" } : { text: `停 ${n - 3}/4`, kind: "rest", detail: "手完全不打，腳繼續踩" };
  }),
  {
    id: "P4",
    clicks: false,
    config: (bpm) => base(bpm),
    instructions: "與老師或一段錄音輪流：對方打 4 小節，你打 4 小節。速度依對方。",
    cue: () => ({ text: "" }),
    setting: () => "輪流 4 小節",
  },
  timed("P5", 120, (bpm, o) => base(bpm, { meter: "7/8", grouping7: o.grouping7 ?? "2+2+3" }), (c) =>
    c.bar % 2 === 0 ? { text: "打", kind: "play", detail: `分組 ${c.cfg.grouping7}` } : { text: "停", kind: "rest", detail: "下一小節第 1 下回來" }, {
    options: [{ key: "grouping7", label: "七拍分組", choices: GROUPING_7_IDS.map((g) => ({ value: g, label: g })) }],
    defaults: { grouping7: "2+2+3" },
    setting: (o) => `${o.grouping7 ?? "2+2+3"}，打1停1`,
  }),
];

export const SCRIPTS: Record<string, ExerciseScript> = Object.fromEntries(SCRIPT_LIST.map((s) => [s.id, s]));

export function scriptFor(id: string): ExerciseScript | undefined {
  return SCRIPTS[id];
}

/** 腳本用的預設速度：課程的預設，沒有時用腳本的 fallback */
export function defaultBpmFor(id: string): number {
  return exerciseById(id)?.bpm ?? SCRIPTS[id]?.fallbackBpm ?? 70;
}

export { GROUPINGS_7 };
