// 教材卡的通用部分：出處、依據分級、影片與段落（純邏輯）。
// 鼓譜等領域內容由使用它的外掛另外解析。

import { extractVideoId } from "./youtube";

export interface Segment {
  label: string;
  start: number;
  end: number | null;
  rate: number | null;
}

export interface VideoRef {
  url: string;
  /** 讀不出 ID 時為 null */
  id: string | null;
  label: string;
  segments: Segment[];
}

export interface MaterialCard {
  title: string;
  source: string;
  evidence: string;
  videos: VideoRef[];
  warnings: string[];
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const t = parseTime(v);
    return t;
  }
  return null;
}

/** 「83」「1:23」「1:02:03」→ 秒；讀不懂回傳 null */
export function parseTime(s: string): number | null {
  const t = s.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [h, mi, se] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
  if (se > 59 || (m[1] !== undefined && mi > 59)) return null;
  return h * 3600 + mi * 60 + se;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function parseVideos(raw: unknown, warnings: string[]): VideoRef[] {
  if (raw === undefined || raw === null || raw === "") return [];
  if (!Array.isArray(raw)) {
    warnings.push("videos 應該是清單");
    return [];
  }
  return raw.map((v, i) => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const url = typeof v === "string" ? v : String(o.url ?? "");
    const id = extractVideoId(url);
    if (!id) warnings.push(`第 ${i + 1} 部影片的網址讀不出 YouTube 影片 ID`);
    const segsRaw = Array.isArray(o.segments) ? o.segments : [];
    const segments: Segment[] = [];
    segsRaw.forEach((s, j) => {
      const so = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      const start = num(so.start);
      const end = num(so.end);
      if (start === null) {
        warnings.push(`第 ${i + 1} 部影片的第 ${j + 1} 個段落沒有起點`);
        return;
      }
      if (end !== null && end <= start) warnings.push(`段落「${String(so.label ?? j + 1)}」的終點早於起點`);
      segments.push({ label: String(so.label ?? `段落 ${j + 1}`), start, end, rate: num(so.rate) });
    });
    return { url, id, label: String(o.label ?? `影片 ${i + 1}`), segments };
  });
}

export function parseMaterialCard(fm: Record<string, unknown>, evidenceLevels: readonly string[]): MaterialCard {
  const warnings: string[] = [];
  const title = String(fm.title ?? "").trim();
  const source = String(fm.source ?? "").trim();
  const evidence = String(fm.evidence ?? "").trim();
  if (!source) warnings.push("出處（source）是必填，目前是空白");
  if (evidence && !evidenceLevels.includes(evidence)) warnings.push(`依據分級「${evidence}」不是 ${evidenceLevels.join("｜")} 其中之一`);
  if (!evidence) warnings.push("依據分級（evidence）是空白");
  return { title, source, evidence, videos: parseVideos(fm.videos, warnings), warnings };
}
