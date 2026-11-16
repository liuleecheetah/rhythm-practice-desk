// 鼓譜解析（純邏輯）。一個字元一格；「.」休止；大寫＝重音或骨架音，小寫＝輕音或裝飾音。
// 空白與「|」只用來分隔，忽略。

export interface NoteCell {
  /** voices 的代號（大寫） */
  voice: string;
  name: string;
  accent: boolean;
}

export interface Track {
  label: string;
  cells: (NoteCell | null)[];
}

export interface Notation {
  meter: string;
  /** 每拍幾格 */
  subdivision: number;
  /** 分組（以格為單位）；沒有時等於每拍一組 */
  groups: number[];
  total: number;
  tracks: Track[];
  errors: string[];
}

export interface NotationInput {
  meter?: unknown;
  subdivision?: unknown;
  groups?: unknown;
  voices?: unknown;
  pattern?: unknown;
}

export function cleanHits(s: string): string {
  return s.replace(/[\s|]/g, "");
}

export function parseNotation(input: NotationInput, label = "基本型"): Notation | null {
  const errors: string[] = [];
  if (input.pattern === undefined || input.pattern === null) return null;
  const meter = String(input.meter ?? "4/4").trim();
  const m = meter.match(/^(\d+)\/(\d+)$/);
  if (!m) errors.push(`拍號「${meter}」讀不懂，應寫成 4/4、12/8 這種形式`);
  const numerator = m ? Number(m[1]) : 4;
  const subdivision = Number(input.subdivision ?? 1);
  if (!Number.isInteger(subdivision) || subdivision < 1 || subdivision > 8) errors.push("subdivision（每拍幾格）應為 1–8 的整數");
  const sub = Number.isInteger(subdivision) && subdivision >= 1 ? subdivision : 1;

  let groups: number[] = [];
  if (Array.isArray(input.groups) && input.groups.length) {
    groups = input.groups.map(Number);
    if (groups.some((g) => !Number.isInteger(g) || g < 1)) {
      errors.push("groups 應為正整數清單，例如 [2, 2, 3]");
      groups = [];
    }
  }
  const total = groups.length ? groups.reduce((a, b) => a + b, 0) : numerator * sub;
  if (!groups.length) groups = Array.from({ length: total / sub }, () => sub);

  const voices = new Map<string, string>();
  if (input.voices && typeof input.voices === "object" && !Array.isArray(input.voices)) {
    for (const [k, v] of Object.entries(input.voices as Record<string, unknown>)) {
      if (k.length !== 1 || k === ".") errors.push(`voices 的代號「${k}」必須是一個字元（不能是 .）`);
      else voices.set(k.toUpperCase(), String(v));
    }
  } else errors.push("缺少 voices（這張卡用到的音：代號 → 名稱）");

  const rawTracks = Array.isArray(input.pattern) ? input.pattern : [];
  if (!rawTracks.length) errors.push(`${label}：pattern 應為清單，每軌一行`);
  const tracks: Track[] = rawTracks.map((t, i) => {
    const o = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    const name = String(o.track ?? `第 ${i + 1} 軌`);
    const hits = cleanHits(String(o.hits ?? ""));
    if (hits.length !== total) errors.push(`${label}「${name}」有 ${hits.length} 格，應為 ${total} 格（${meter}${groups.length ? `，分組 ${groups.join("+")}` : ""}，每拍 ${sub} 格）`);
    const unknown = new Set<string>();
    const cells = [...hits].map((ch) => {
      if (ch === ".") return null;
      const key = ch.toUpperCase();
      const v = voices.get(key);
      if (!v) {
        unknown.add(ch);
        return null;
      }
      return { voice: key, name: v, accent: ch === key && ch !== ch.toLowerCase() };
    });
    if (unknown.size) errors.push(`${label}「${name}」用到 voices 沒列的字元：${[...unknown].join("、")}`);
    return { label: name, cells };
  });
  return { meter, subdivision: sub, groups, total, tracks, errors };
}
