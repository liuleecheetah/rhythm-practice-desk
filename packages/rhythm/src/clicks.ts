// 拍號、細分、重音、靜音小節的純邏輯。

export type MeterId = "4/4" | "3/4" | "7/8";
export const METERS: MeterId[] = ["4/4", "3/4", "7/8"];

export const GROUPINGS_7 = {
  "2+2+3": [2, 2, 3],
  "3+2+2": [3, 2, 2],
  "2+3+2": [2, 3, 2],
} as const;
export type Grouping7 = keyof typeof GROUPINGS_7;
export const GROUPING_7_IDS = Object.keys(GROUPINGS_7) as Grouping7[];

/** 每拍細分：1 四分、2 八分、3 三連音、4 十六分（7/8 固定為 1） */
export type Subdivision = 1 | 2 | 3 | 4;
export const SUBDIVISION_LABELS: Record<Subdivision, string> = { 1: "四分", 2: "八分", 3: "三連音", 4: "十六分" };

export interface ClickConfig {
  /** 4/4、3/4 以四分音符計；7/8 以八分音符計 */
  bpm: number;
  meter: MeterId;
  grouping7: Grouping7;
  subdivision: Subdivision;
  /** 第 1 拍用重音提示音 */
  accentFirst: boolean;
  /** 7/8 的分組起點用重音 */
  accentGroups: boolean;
  /** 響 N 小節 */
  muteOn: number;
  /** 靜 M 小節；0＝不靜音 */
  muteOff: number;
  /** 開始前一小節預備拍 */
  countIn: boolean;
}

export const DEFAULT_CLICK: ClickConfig = {
  bpm: 70, meter: "4/4", grouping7: "2+2+3", subdivision: 1,
  accentFirst: true, accentGroups: true, muteOn: 0, muteOff: 0, countIn: true,
};

export const BPM_MIN = 30;
export const BPM_MAX = 240;
export function clampBpm(n: number): number {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(n)));
}

/** 每小節的分組（以拍為單位）。4/4 → [1,1,1,1]；7/8 → 例如 [2,2,3] */
export function groupsOf(c: ClickConfig): number[] {
  if (c.meter === "7/8") return [...GROUPINGS_7[c.grouping7]];
  return c.meter === "3/4" ? [1, 1, 1] : [1, 1, 1, 1];
}

export function pulsesPerBar(c: ClickConfig): number {
  return groupsOf(c).reduce((a, b) => a + b, 0);
}

export function effectiveSubdivision(c: ClickConfig): Subdivision {
  return c.meter === "7/8" ? 1 : c.subdivision;
}

export function stepsPerBar(c: ClickConfig): number {
  return pulsesPerBar(c) * effectiveSubdivision(c);
}

export function stepSeconds(c: ClickConfig): number {
  return 60 / c.bpm / effectiveSubdivision(c);
}

/** 分組起點（以拍為單位） */
export function groupStarts(c: ClickConfig): number[] {
  const out: number[] = [];
  let a = 0;
  for (const g of groupsOf(c)) {
    out.push(a);
    a += g;
  }
  return out;
}

export type ClickLevel = "accent" | "group" | "beat" | "sub";

/** 小節內第 step 格該發哪一種提示音（不考慮靜音）。 */
export function levelAt(c: ClickConfig, step: number): ClickLevel {
  const sub = effectiveSubdivision(c);
  if (step % sub !== 0) return "sub";
  const pulse = step / sub;
  const isGroupStart = c.meter === "7/8" && c.accentGroups && groupStarts(c).includes(pulse);
  if (pulse === 0 && c.accentFirst) return "accent";
  if (isGroupStart) return "group";
  return "beat";
}

/** 練習小節（預備拍之後，從 0 起算）是否靜音。epoch：靜音設定開始生效的小節。 */
export function isMutedBar(bar: number, on: number, off: number, epoch = 0): boolean {
  if (off <= 0 || on <= 0 || bar < epoch) return false;
  return (bar - epoch) % (on + off) >= on;
}
