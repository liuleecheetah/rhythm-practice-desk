import type { Report, Verdict } from "./report";

const VERDICTS: Verdict[] = ["已實測可行", "已實測不可行", "未能測試"];

/** 一列「使用者判斷」按鈕：可行／不可行／未能測試。 */
export function verdictRow(parent: HTMLElement, report: Report, key: string): void {
  const item = report.get(key);
  if (!item) return;
  const row = parent.createDiv({ cls: "rpd-verdict" });
  row.createDiv({ cls: "rpd-verdict-label", text: item.label });
  const btns = row.createDiv({ cls: "rpd-verdict-btns" });
  const render = () => {
    btns.empty();
    for (const v of VERDICTS) {
      const b = btns.createEl("button", { text: v.replace("已實測", "") });
      if (report.get(key)?.verdict === v) b.addClass("mod-cta");
      b.onclick = () => report.setVerdict(key, v);
    }
  };
  render();
  // 分頁切換後這一列被移除時，自動取消監聽
  const off = report.onChange(() => (row.isConnected ? render() : off()));
}

export function section(parent: HTMLElement, title: string, desc?: string): HTMLElement {
  const s = parent.createDiv({ cls: "rpd-section" });
  s.createEl("h3", { text: title });
  if (desc) s.createEl("p", { cls: "rpd-desc", text: desc });
  return s;
}

export function button(parent: HTMLElement, text: string, onClick: () => void, cta = false): HTMLButtonElement {
  const b = parent.createEl("button", { text });
  if (cta) b.addClass("mod-cta");
  b.onclick = onClick;
  return b;
}
