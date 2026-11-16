// 成效檢視頁：最近 8 週每週的練習記錄則數。
// COURSE.md：連續 4 週沒有增加就停用徽章與等級——這一頁讓使用者自己判斷，並提供開關。

import { ItemView, Setting, WorkspaceLeaf } from "obsidian";
import { recentWeeks, dayKey, addDays, type WeekSummary } from "@rpd/learning-core";
import type RhythmPracticeDesk from "../main";
import { CURRICULUM } from "../curriculum";
import { backBar, trackBottomOffset } from "./layout";

export const STATS_VIEW = "rpd-stats";
const NS = "http://www.w3.org/2000/svg";
const WEEKS = 8;

export class StatsView extends ItemView {
  private off: (() => void) | null = null;
  private untrack: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: RhythmPracticeDesk) {
    super(leaf);
  }

  getViewType(): string { return STATS_VIEW; }
  getDisplayText(): string { return "成效"; }
  getIcon(): string { return "bar-chart-2"; }

  async onOpen(): Promise<void> {
    this.untrack = trackBottomOffset(this.contentEl);
    this.off = this.plugin.store.onChange(() => this.render());
    this.render();
  }

  async onClose(): Promise<void> {
    this.off?.();
    this.untrack?.();
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("rpd-root");
    backBar(root, () => void this.plugin.openToday());
    root.createEl("h2", { text: "最近 8 週的練習記錄" });
    const weeks = recentWeeks(this.plugin.store.snapshot.records, CURRICULUM.weeklyGoals, new Date(), WEEKS);

    const chart = root.createDiv({ cls: "rpd-section rpd-chart" });
    chart.createDiv({ cls: "rpd-desc", text: "每週的記錄則數（週一開始，含沒有代號的記錄）。點長條看數字。" });
    drawBars(chart, weeks);

    // 表格：同一份數字的文字版
    const table = root.createEl("table", { cls: "rpd-table" });
    const game = this.plugin.settings.showGamification;
    const head = table.createEl("tr");
    for (const h of ["週", "記錄", "大腿（天）", "打擊墊", "橋下", ...(game ? ["每週目標"] : [])]) head.createEl("th", { text: h });
    for (const w of [...weeks].reverse()) {
      const tr = table.createEl("tr");
      tr.createEl("td", { text: weekLabel(w) });
      tr.createEl("td", { text: String(w.total) });
      for (const g of w.goals) tr.createEl("td", { text: String(g.value) });
      if (game) tr.createEl("td", { text: w.completed ? "完成" : "—" });
    }

    const rule = root.createDiv({ cls: "rpd-section" });
    rule.createDiv({ cls: "rpd-label", text: "怎麼判斷遊戲化元素要不要留" });
    rule.createDiv({ text: "COURSE.md 的規則：連續 4 週的練習次數沒有增加，就停用徽章與等級，只保留過關標準與練習記錄。" });
    rule.createDiv({ cls: "rpd-desc", text: trendNote(weeks) });
    new Setting(rule)
      .setName("顯示等級與徽章")
      .setDesc("關閉後，等級、徽章、每週目標都不顯示；過關標準、進度格與練習記錄照常。")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showGamification).onChange(async (v) => {
          this.plugin.settings.showGamification = v;
          await this.plugin.saveSettings();
        }),
      );
  }
}

function weekLabel(w: WeekSummary): string {
  const a = dayKey(w.start).slice(5).replace("-", "/");
  const b = dayKey(addDays(w.start, 6)).slice(5).replace("-", "/");
  return `${a}–${b}`;
}

/** 只描述事實，不下結論 */
function trendNote(weeks: WeekSummary[]): string {
  const last5 = weeks.slice(-5).map((w) => w.total);
  const rising = last5.slice(1).some((v, i) => v > last5[i]);
  return `最近 5 週的則數依序是 ${last5.join("、")}。${rising ? "其中至少有一週比前一週多。" : "這 4 週都沒有比前一週多。"}`;
}

function drawBars(parent: HTMLElement, weeks: WeekSummary[]): void {
  const W = 320, H = 180, padL = 28, padB = 26, padT = 10;
  const max = Math.max(4, ...weeks.map((w) => w.total));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `最近 ${weeks.length} 週的練習記錄則數：${weeks.map((w) => w.total).join("、")}`);
  svg.classList.add("rpd-bars");
  const plotW = W - padL - 4, plotH = H - padT - padB;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const el = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    if (text !== undefined) e.textContent = text;
    svg.appendChild(e);
    return e;
  };
  for (let v = 0; v <= top; v += step) {
    el("line", { x1: padL, x2: W - 4, y1: y(v), y2: y(v), class: v === 0 ? "rpd-axis" : "rpd-grid" });
    el("text", { x: padL - 6, y: y(v) + 4, "text-anchor": "end", class: "rpd-tick" }, String(v));
  }
  const slot = plotW / weeks.length;
  const bw = Math.min(22, slot - 6);
  const tip = parent.createDiv({ cls: "rpd-tip" });
  tip.setText(" ");
  weeks.forEach((w, i) => {
    const x = padL + i * slot + (slot - bw) / 2;
    const h = Math.max(0, y(0) - y(w.total));
    const isNow = i === weeks.length - 1;
    if (h > 0) {
      // 頂端 4px 圓角、底部貼齊基線
      const r = Math.min(4, h, bw / 2);
      const d = `M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + bw - r} Q${x + bw},${y(0) - h} ${x + bw},${y(0) - h + r} V${y(0)} Z`;
      el("path", { d, class: isNow ? "rpd-bar is-now" : "rpd-bar" });
    }
    el("text", { x: x + bw / 2, y: H - 8, "text-anchor": "middle", class: "rpd-tick" }, isNow ? "本週" : dayKey(w.start).slice(5).replace("-", "/"));
    // 命中區比長條大
    const hit = el("rect", { x: padL + i * slot, y: padT, width: slot, height: plotH, class: "rpd-hit" });
    const show = () => tip.setText(`${weekLabel(w)}：${w.total} 則`);
    hit.addEventListener("pointerenter", show);
    hit.addEventListener("click", show);
  });
  parent.appendChild(svg);
}
