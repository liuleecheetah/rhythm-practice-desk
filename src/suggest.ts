// 下一次的速度建議（純邏輯）。

import type { LearningRecord } from "@rpd/learning-core/src/core";
import { BPM_STEP_DOWN, PASS_STREAK, type Exercise } from "@rpd/rhythm/src/course";

export interface Suggestion {
  bpm: number | null;
  /** 給使用者看的說明；沒有特別要說的時候是空字串 */
  note: string;
  /** 降速後仍沒達到 */
  backtrack: boolean;
}

export const MIN_BPM = 30;
export const MAX_BPM = 240;

function bpmOf(r: LearningRecord): number | null {
  const v = Number(r.raw.bpm);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** records：計入進度的記錄，時間排序。cells：目前的進度格數。 */
export function suggestNext(ex: Exercise, records: readonly LearningRecord[], cells: number): Suggestion {
  const last = records[records.length - 1];
  if (!last) return { bpm: ex.bpm, note: ex.bpm ? "課程的預設速度" : "", backtrack: false };
  const lastBpm = bpmOf(last) ?? ex.bpm;
  if (last.passed === false) {
    const bpm = lastBpm === null ? null : Math.max(MIN_BPM, lastBpm - BPM_STEP_DOWN);
    const prev = records[records.length - 2];
    const prevBpm = prev ? bpmOf(prev) : null;
    const backtrack = !!prev && prev.passed === false && prevBpm !== null && lastBpm !== null && lastBpm < prevBpm;
    return {
      bpm,
      note: backtrack ? "降速後仍沒達到：建議回到前一期的必做練習" : `上次沒達到，降 ${BPM_STEP_DOWN} BPM`,
      backtrack,
    };
  }
  if (cells >= PASS_STREAK && ex.speeds && lastBpm !== null) {
    const next = ex.speeds.find((s) => s > lastBpm);
    if (next) return { bpm: lastBpm, note: `這個速度已過關，下一個速度是 ${next} BPM`, backtrack: false };
  }
  return { bpm: lastBpm, note: "", backtrack: false };
}
