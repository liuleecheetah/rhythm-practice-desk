// 把節奏課程資料接到 learning-core 的通用介面。

import type { Curriculum, RecordSchema } from "@rpd/learning-core";
import { DEFAULT_PROGRESS_PLACES, EXERCISES, FREE_ITEMS, GROUPS, PASS_STREAK, PLACES, STAGES, WEEKLY_GOALS } from "@rpd/rhythm";

export const LOG_TYPE = "practice-log";
export const LOG_SUBFOLDER = "練習日誌";

export const SCHEMA: RecordSchema = {
  fields: { type: LOG_TYPE, date: "date", context: "place", item: "exercise", passed: "passed" },
  contexts: PLACES,
  knownItems: EXERCISES.map((e) => e.id),
  freeItems: FREE_ITEMS,
};

export const CURRICULUM: Curriculum = {
  items: EXERCISES.map((e) => ({ id: e.id, group: e.group, progressContexts: e.progressPlaces })),
  groups: GROUPS,
  stages: STAGES.map((s) => ({ level: s.level, required: s.required, mode: s.mode })),
  defaultProgressContexts: DEFAULT_PROGRESS_PLACES,
  streak: PASS_STREAK,
  weeklyGoals: WEEKLY_GOALS,
};
