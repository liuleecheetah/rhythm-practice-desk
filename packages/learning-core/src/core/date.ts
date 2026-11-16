// 本地時間的日期解析與週的計算（純邏輯）。

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 解析 frontmatter 的日期。接受：
 * 2026-11-18、2026-11-18T21:10、2026-11-18 21:10、2026-11-18T21:10:00、Date 物件。
 * 沒有時區的一律當本地時間。讀不懂回傳 null。
 */
export function parseLocalDate(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? "0", m[5] ?? "0", m[6] ?? "0"].map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s);
  // 拒絕 2026-02-31 這種會被進位的日期
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || h > 23 || mi > 59) return null;
  return date;
}

/** 本地日期鍵：2026-11-18 */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 該日所在週的週一 00:00（本地時間） */
export function weekStart(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // 週一＝0
  r.setDate(r.getDate() - dow);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}
