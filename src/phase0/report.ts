// 階段 0 測試結果的收集。使用者的判斷（聽起來準不準、有沒有聲音）
// 由使用者按按鈕記錄；外掛自動量到的數值放在 detail。

export type Verdict = "未測" | "已實測可行" | "已實測不可行" | "未能測試";

export interface ReportItem {
  key: string;
  group: string;
  label: string;
  verdict: Verdict;
  detail: string;
}

export class Report {
  private items = new Map<string, ReportItem>();
  private listeners = new Set<() => void>();
  readonly env: Record<string, string> = {};

  define(key: string, group: string, label: string): void {
    if (!this.items.has(key)) this.items.set(key, { key, group, label, verdict: "未測", detail: "" });
  }

  get(key: string): ReportItem | undefined {
    return this.items.get(key);
  }

  setVerdict(key: string, verdict: Verdict): void {
    const it = this.items.get(key);
    if (!it) return;
    it.verdict = verdict;
    this.emit();
  }

  setDetail(key: string, detail: string): void {
    const it = this.items.get(key);
    if (!it) return;
    it.detail = detail;
    this.emit();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  toMarkdown(nowIso: string): string {
    const lines: string[] = [];
    lines.push("---", "type: phase0-report", `date: ${nowIso}`, "---", "");
    lines.push("# 節奏練習台 階段 0 測試結果", "");
    lines.push("## 環境", "");
    for (const [k, v] of Object.entries(this.env)) lines.push(`- ${k}：${v}`);
    let group = "";
    for (const it of this.items.values()) {
      if (it.group !== group) {
        group = it.group;
        lines.push("", `## ${group}`, "");
      }
      lines.push(`- **${it.label}**：${it.verdict}${it.detail ? `（${it.detail}）` : ""}`);
    }
    lines.push("");
    return lines.join("\n");
  }
}
