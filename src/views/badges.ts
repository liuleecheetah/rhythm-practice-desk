// 徽章頁：29 個練習與 5 個項目，已取得與未取得分開，附取得日期。

import { ItemView, WorkspaceLeaf } from "obsidian";
import { computeProgress, dayKey } from "@rpd/learning-core";
import { EXERCISES, GROUPS } from "@rpd/rhythm";
import type RhythmPracticeDesk from "../main";
import { CURRICULUM } from "../curriculum";
import { backBar, trackBottomOffset } from "./layout";

export const BADGES_VIEW = "rpd-badges";

export class BadgesView extends ItemView {
  private off: (() => void) | null = null;
  private untrack: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: RhythmPracticeDesk) {
    super(leaf);
  }

  getViewType(): string { return BADGES_VIEW; }
  getDisplayText(): string { return "徽章"; }
  getIcon(): string { return "award"; }

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
    if (!this.plugin.settings.showGamification) {
      root.createDiv({ cls: "rpd-section", text: "已在設定關閉「顯示等級與徽章」。" });
      return;
    }
    const p = computeProgress(this.plugin.store.snapshot.records, CURRICULUM);
    const got = new Map(p.itemBadges.map((b) => [b.id, b.at]));
    const gotG = new Map(p.groupBadges.map((b) => [b.id, b.at]));
    root.createEl("h2", { text: `徽章 ${got.size + gotG.size} / ${EXERCISES.length + GROUPS.length}` });
    root.createDiv({ cls: "rpd-desc", text: "徽章只記錄已經過關的練習，不換取任何東西。過關之後即使某次沒達到，徽章也不收回。" });

    const done = root.createDiv({ cls: "rpd-section" });
    done.createEl("h3", { text: "已取得" });
    const doneG = GROUPS.filter((g) => gotG.has(g.id));
    const doneE = EXERCISES.filter((e) => got.has(e.id));
    if (!doneG.length && !doneE.length) done.createDiv({ cls: "rpd-desc", text: "還沒有。同一個練習連續 3 次達到標準就會取得。" });
    for (const g of doneG) badge(done, `項目完成：${g.name}`, `${dayKey(gotG.get(g.id)!)}`, true, true);
    for (const e of doneE) badge(done, `${e.id} ${e.name}`, dayKey(got.get(e.id)!), true);

    const todo = root.createDiv({ cls: "rpd-section" });
    todo.createEl("h3", { text: "未取得" });
    for (const g of GROUPS.filter((x) => !gotG.has(x.id))) {
      const n = EXERCISES.filter((e) => e.group === g.id);
      badge(todo, `項目完成：${g.name}`, `${n.filter((e) => got.has(e.id)).length} / ${n.length} 個練習已過關`, false, true);
    }
    for (const e of EXERCISES.filter((x) => !got.has(x.id))) badge(todo, `${e.id} ${e.name}`, `進度 ${p.items[e.id].cells} / 3`, false);
  }
}

function badge(parent: HTMLElement, title: string, sub: string, earned: boolean, group = false): void {
  const row = parent.createDiv({ cls: `rpd-badge${earned ? " is-earned" : ""}${group ? " is-group" : ""}` });
  row.createSpan({ cls: "rpd-badge-mark", text: earned ? "●" : "○" });
  const t = row.createDiv();
  t.createDiv({ text: title });
  t.createDiv({ cls: "rpd-desc", text: sub });
}
