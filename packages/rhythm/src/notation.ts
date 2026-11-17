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
  /** 這一軌的音名（代號大寫 → 名稱） */
  voices: Record<string, string>;
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
  if (Array.isArray(input.pattern) && input.pattern.length === 0) return null;
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

  // 卡片層的 voices（舊格式）作為每一軌的預設；每一軌可以有自己的 voices
  const cardVoices = readVoices(input.voices, "voices", errors);

  const rawTracks = Array.isArray(input.pattern) ? input.pattern : [];
  const tracks: Track[] = rawTracks.map((t, i) => {
    const o = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    const name = String(o.track ?? "").trim() || `第 ${i + 1} 軌`;
    const own = o.voices !== undefined && o.voices !== null ? readVoices(o.voices, `${label}「${name}」的 voices`, errors) : new Map<string, string>();
    const voices = new Map([...cardVoices, ...own]);
    if (!voices.size) errors.push(`${label}「${name}」還沒有設定音名（voices）`);
    const hits = cleanHits(String(o.hits ?? ""));
    if (hits.length !== total) errors.push(`${label}「${name}」有 ${hits.length} 格，應為 ${total} 格（${meter}${input.groups && Array.isArray(input.groups) && input.groups.length ? `，分組 ${groups.join("+")}` : ""}，每拍 ${sub} 格）`);
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
    if (unknown.size) errors.push(`${label}「${name}」用到音名沒列的字元：${[...unknown].join("、")}`);
    return { label: name, voices: Object.fromEntries(voices), cells };
  });
  return { meter, subdivision: sub, groups, total, tracks, errors };
}

function readVoices(raw: unknown, where: string, errors: string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (raw === undefined || raw === null || raw === "") return out;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(`${where} 應為「代號: 名稱」的對照`);
    return out;
  }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k.length !== 1 || k === ".") errors.push(`${where} 的代號「${k}」必須是一個字元（不能是 .）`);
    else out.set(k.toUpperCase(), String(v));
  }
  return out;
}

/** 依分組加空白，方便閱讀：D.T...T. → "D.T. ..T." */
export function formatHits(clean: string, groups: number[]): string {
  const parts: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= clean.length) break;
    parts.push(clean.slice(i, i + g));
    i += g;
  }
  if (i < clean.length) parts.push(clean.slice(i));
  return parts.join(" ");
}

/** 點一格時換到下一個音：休止 → 第一個音（重）→ 第一個音（輕）→ 第二個音… → 休止 */
export function cycleCell(clean: string, index: number, voiceKeys: string[], total: number): string {
  const padded = clean.padEnd(total, ".").slice(0, Math.max(total, clean.length));
  const order: string[] = ["."];
  for (const k of voiceKeys) {
    const up = k.toUpperCase();
    order.push(up);
    const low = up.toLowerCase();
    if (low !== up) order.push(low);
  }
  const cur = padded[index] ?? ".";
  const next = order[(order.indexOf(cur) + 1) % order.length] ?? ".";
  return padded.slice(0, index) + next + padded.slice(index + 1);
}
