// 從課程 Markdown 找出某個代號的段落（純邏輯）。
// 標題開頭的代號可以是單一（### T2 …）、前綴（### H5 … 涵蓋 H5a）、範圍（### C1–C5 …）。
// 都找不到時，退回到標題含「（P）」這種項目代號的段落。

const HEADING = /^(#{1,6})\s+(.*)$/;
const CODE = /^([A-Z])(\d+)([a-z]?)$/;
const HEAD_CODE = /^([A-Z])(\d+)([a-z]?)(?:[–-]([A-Z])?(\d+))?(?:\s|$)/;

interface Heading {
  line: number;
  level: number;
  text: string;
}

function headings(lines: string[]): Heading[] {
  const out: Heading[] = [];
  lines.forEach((l, i) => {
    const m = l.match(HEADING);
    if (m) out.push({ line: i, level: m[1].length, text: m[2].trim() });
  });
  return out;
}

/** 0＝不符；3＝完全相同；2＝前綴；1＝範圍 */
function score(headText: string, code: string): number {
  const c = code.match(CODE);
  const h = headText.match(HEAD_CODE);
  if (!c || !h) return 0;
  const [, letter, numS, suffix] = c;
  const num = Number(numS);
  if (h[1] !== letter) return 0;
  const hNum = Number(h[2]);
  if (h[5]) {
    if ((h[4] ?? letter) !== letter) return 0;
    return num >= hNum && num <= Number(h[5]) ? 1 : 0;
  }
  if (hNum !== num) return 0;
  if (h[3] === suffix) return 3;
  return h[3] === "" ? 2 : 0;
}

function sliceSection(lines: string[], hs: Heading[], idx: number): string {
  const h = hs[idx];
  const next = hs.slice(idx + 1).find((x) => x.level <= h.level);
  return lines.slice(h.line, next ? next.line : lines.length).join("\n").trim();
}

export function findSection(md: string, code: string): string | null {
  const lines = md.split(/\r?\n/);
  const hs = headings(lines);
  let best = -1;
  let bestScore = 0;
  hs.forEach((h, i) => {
    const s = score(h.text, code);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  if (best >= 0) return sliceSection(lines, hs, best);
  const letter = code.charAt(0);
  const g = hs.findIndex((h) => h.text.includes(`（${letter}）`));
  return g >= 0 ? sliceSection(lines, hs, g) : null;
}
