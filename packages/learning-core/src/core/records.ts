// 學習記錄的解析與驗證（純邏輯）。欄位名稱可設定，讓不同的學習外掛共用。

import { parseLocalDate } from "./date";

export interface RecordFieldMap {
  /** 記錄類型欄位的值，例如 practice-log */
  type: string;
  date: string;
  /** 場地／情境，例如 place */
  context: string;
  /** 練習項目代號，例如 exercise */
  item: string;
  passed: string;
}

export interface RecordSchema {
  fields: RecordFieldMap;
  /** context 允許的值 */
  contexts: readonly string[];
  /** 認得的項目代號；不在清單內、也不在 freeItems 內的視為讀不懂 */
  knownItems: readonly string[];
  /** 不計入進度的自由項目，例如「即興」。空白一律允許 */
  freeItems: readonly string[];
}

export interface LearningRecord {
  path: string;
  date: Date;
  context: string;
  /** 空字串代表沒有代號 */
  item: string;
  /** 沒有代號的記錄可為 null */
  passed: boolean | null;
  /** 原始 frontmatter，讓使用它的外掛讀取其他欄位（例如 bpm） */
  raw: Record<string, unknown>;
}

export type ParseResult =
  | { ok: true; record: LearningRecord }
  | { ok: false; path: string; reason: string };

function parseBool(v: unknown): boolean | null | undefined {
  if (v === true || v === false) return v;
  if (v === null || v === undefined || v === "") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined; // 讀不懂
}

/** 驗證一則記錄的 frontmatter。type 不符時回傳 null（不是這種記錄，不列為錯誤）。 */
export function parseRecord(path: string, fm: Record<string, unknown>, schema: RecordSchema): ParseResult | null {
  const f = schema.fields;
  if (fm.type !== f.type) return null;
  const fail = (reason: string): ParseResult => ({ ok: false, path, reason });

  const date = parseLocalDate(fm[f.date]);
  if (!date) return fail(`${f.date} 讀不懂（應為 2026-11-18T21:10）`);

  const context = typeof fm[f.context] === "string" ? (fm[f.context] as string).trim() : "";
  if (!schema.contexts.includes(context)) return fail(`${f.context} 必須是 ${schema.contexts.join("｜")} 其中之一`);

  const rawItem = fm[f.item];
  const item = rawItem === null || rawItem === undefined ? "" : String(rawItem).trim();
  const known = schema.knownItems.includes(item);
  if (item && !known && !schema.freeItems.includes(item)) return fail(`${f.item}「${item}」不是認得的代號`);

  const passed = parseBool(fm[f.passed]);
  if (passed === undefined) return fail(`${f.passed} 必須是 true 或 false`);
  if (known && passed === null) return fail(`有代號的記錄必須填 ${f.passed}`);

  return { ok: true, record: { path, date, context, item, passed, raw: fm } };
}

/** 依時間排序；同一分鐘的依路徑排序，讓結果穩定。 */
export function sortRecords(rs: LearningRecord[]): LearningRecord[] {
  return [...rs].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
