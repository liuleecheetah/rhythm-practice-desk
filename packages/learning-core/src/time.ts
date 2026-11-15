const pad = (n: number) => String(n).padStart(2, "0");

/** 檔名用的本地時間戳：2026-11-18-2110 */
export function fileStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** frontmatter 用的本地時間（到分鐘）：2026-11-18T21:10 */
export function localIsoMinute(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
