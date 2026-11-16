// 由學習記錄推導進度、等級、徽章、每週目標（純邏輯，讀取時計算，不寫入任何檔案）。

import { sortRecords, type LearningRecord } from "./records";
import { addDays, dayKey, weekStart } from "./date";

export interface CurriculumItem {
  id: string;
  group: string;
  /** 只有這些情境的記錄計入進度；未設定時用 Curriculum.defaultProgressContexts */
  progressContexts?: readonly string[];
}

export interface CurriculumStage {
  level: number;
  required: readonly string[];
  /** pass：曾經過關即可；recheck：進入此期之後需要再有一則達到標準的記錄 */
  mode: "pass" | "recheck";
}

export interface WeeklyGoal {
  context: string;
  /** days：不同日期數；count：記錄則數 */
  kind: "days" | "count";
  target: number;
}

export interface Curriculum {
  items: readonly CurriculumItem[];
  groups: readonly { id: string }[];
  stages: readonly CurriculumStage[];
  defaultProgressContexts: readonly string[];
  /** 連續幾次達到標準算過關 */
  streak: number;
  weeklyGoals: readonly WeeklyGoal[];
}

export interface ItemProgress {
  id: string;
  /** 0..streak */
  cells: number;
  /** 第一次連續達標滿 streak 次的那一則；沒過關為 null */
  passedAt: LearningRecord | null;
  /** 計入進度的記錄（時間排序） */
  records: LearningRecord[];
  /** 同代號但不計入進度的記錄（例如鼓上） */
  otherRecords: LearningRecord[];
}

export interface StageStatus {
  level: number;
  /** 進入此期的時間；第 1 期為 null */
  startedAt: Date | null;
  completedAt: Date | null;
  /** recheck 模式下，各代號是否已重新檢查 */
  rechecked: Record<string, boolean>;
}

export interface Badge {
  id: string;
  at: Date;
}

export interface WeekSummary {
  start: Date;
  total: number;
  goals: { goal: WeeklyGoal; value: number; met: boolean }[];
  completed: boolean;
}

export interface Progress {
  items: Record<string, ItemProgress>;
  stages: StageStatus[];
  /** 目前所在的期（必做尚未完成的最早一期）；全部完成時為最後一期 */
  level: number;
  allDone: boolean;
  itemBadges: Badge[];
  groupBadges: Badge[];
}

export function trailingStreak(rs: readonly LearningRecord[], cap: number): number {
  let n = 0;
  for (let i = rs.length - 1; i >= 0 && n < cap; i--) {
    if (rs[i].passed === true) n++;
    else break;
  }
  return n;
}

export function firstPass(rs: readonly LearningRecord[], streak: number): LearningRecord | null {
  let n = 0;
  for (const r of rs) {
    n = r.passed === true ? n + 1 : 0;
    if (n >= streak) return r;
  }
  return null;
}

export function computeProgress(records: readonly LearningRecord[], c: Curriculum): Progress {
  const sorted = sortRecords([...records]);
  const items: Record<string, ItemProgress> = {};
  for (const it of c.items) {
    const ctx = it.progressContexts ?? c.defaultProgressContexts;
    const mine = sorted.filter((r) => r.item === it.id);
    const counted = mine.filter((r) => ctx.includes(r.context));
    items[it.id] = {
      id: it.id,
      cells: trailingStreak(counted, c.streak),
      passedAt: firstPass(counted, c.streak),
      records: counted,
      otherRecords: mine.filter((r) => !ctx.includes(r.context)),
    };
  }

  const stages: StageStatus[] = [];
  let start: Date | null = null;
  let level = c.stages.length ? c.stages[c.stages.length - 1].level : 1;
  let allDone = true;
  let blocked = false;
  for (const s of c.stages) {
    const st: StageStatus = { level: s.level, startedAt: blocked ? null : start, completedAt: null, rechecked: {} };
    if (!blocked) {
      let done = true;
      let latest: number = start ? start.getTime() : -Infinity;
      for (const id of s.required) {
        const ip = items[id];
        let hit: LearningRecord | null | undefined;
        if (s.mode === "pass") hit = ip?.passedAt;
        else {
          const since = start ? start.getTime() : -Infinity;
          hit = ip?.records.find((r) => r.passed === true && r.date.getTime() > since);
          st.rechecked[id] = !!hit;
        }
        if (!hit) done = false;
        else latest = Math.max(latest, hit.date.getTime());
      }
      if (done) {
        st.completedAt = new Date(latest);
        start = st.completedAt;
      } else {
        blocked = true;
        allDone = false;
        level = s.level;
      }
    } else if (s.mode === "recheck") {
      for (const id of s.required) st.rechecked[id] = false;
    }
    stages.push(st);
  }

  const itemBadges: Badge[] = c.items
    .filter((it) => items[it.id].passedAt)
    .map((it) => ({ id: it.id, at: items[it.id].passedAt!.date }));
  const groupBadges: Badge[] = [];
  for (const g of c.groups) {
    const members = c.items.filter((it) => it.group === g.id);
    if (members.length && members.every((it) => items[it.id].passedAt)) {
      const at = Math.max(...members.map((it) => items[it.id].passedAt!.date.getTime()));
      groupBadges.push({ id: g.id, at: new Date(at) });
    }
  }

  return { items, stages, level, allDone, itemBadges, groupBadges };
}

/** 某一週（週一開始）的每週目標達成狀況。所有記錄都計入，包含沒有代號的。 */
export function summarizeWeek(records: readonly LearningRecord[], goals: readonly WeeklyGoal[], anyDayInWeek: Date): WeekSummary {
  const start = weekStart(anyDayInWeek);
  const end = addDays(start, 7);
  const inWeek = records.filter((r) => r.date >= start && r.date < end);
  const res = goals.map((goal) => {
    const rs = inWeek.filter((r) => r.context === goal.context);
    const value = goal.kind === "days" ? new Set(rs.map((r) => dayKey(r.date))).size : rs.length;
    return { goal, value, met: value >= goal.target };
  });
  return { start, total: inWeek.length, goals: res, completed: res.length > 0 && res.every((g) => g.met) };
}

/** 最近 n 週（含本週），由舊到新。 */
export function recentWeeks(records: readonly LearningRecord[], goals: readonly WeeklyGoal[], now: Date, n: number): WeekSummary[] {
  const out: WeekSummary[] = [];
  const thisWeek = weekStart(now);
  for (let i = n - 1; i >= 0; i--) out.push(summarizeWeek(records, goals, addDays(thisWeek, -7 * i)));
  return out;
}
