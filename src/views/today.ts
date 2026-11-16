// 今日頁（外掛首頁，規格 6.3）：目前在哪一期、本週目標、依場地列出今天可做的內容、最近 7 天、全部練習。

import { ItemView, Modal, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { computeProgress, dayKey, summarizeWeek, addDays, sortRecords, type Progress, type StoreSnapshot, type LearningRecord } from "@rpd/learning-core";
import { EXERCISES, GROUPS, STAGES, WEEKLY_GOALS, exerciseById, type Place } from "@rpd/rhythm";
import type RhythmPracticeDesk from "../main";
import { CURRICULUM } from "../curriculum";
import { suggestNext } from "../suggest";
import { renderCells } from "./cells";
import { NewRecordModal } from "./newRecord";
import { hasScript, PAIR_SECONDS } from "./runner";
import { METRONOME_VIEW } from "./metronomeView";
import { BADGES_VIEW } from "./badges";
import { STATS_VIEW } from "./stats";
import { CARDS_VIEW } from "./cards";
import { trackBottomOffset } from "./layout";

export const TODAY_VIEW = "rpd-today";
/** 第 3 期起提供「兩個練習輪流」 */
const PAIR_FROM_LEVEL = 3;

export class TodayView extends ItemView {
  private off: (() => void) | null = null;
  private untrack: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: RhythmPracticeDesk) {
    super(leaf);
  }

  getViewType(): string { return TODAY_VIEW; }
  getDisplayText(): string { return "節奏練習台"; }
  getIcon(): string { return "drum"; }

  async onOpen(): Promise<void> {
    this.untrack = trackBottomOffset(this.contentEl);
    this.off = this.plugin.store.onChange((s) => this.render(s));
    this.render(this.plugin.store.snapshot);
  }

  async onClose(): Promise<void> {
    this.off?.();
    this.untrack?.();
  }

  /** 設定改變時重畫 */
  refresh(): void {
    this.render(this.plugin.store.snapshot);
  }

  private render(snap: StoreSnapshot): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("rpd-root");
    const game = this.plugin.settings.showGamification;
    const p = computeProgress(snap.records, CURRICULUM);
    const stage = STAGES.find((s) => s.level === p.level)!;

    // ---- 目前在哪一期 ----
    const head = root.createDiv({ cls: "rpd-section" });
    const title = p.allDone ? "六期都已完成" : game ? `第 ${stage.level} 期（等級 ${stage.level}）` : `第 ${stage.level} 期`;
    head.createEl("h2", { text: title });
    head.createDiv({ cls: "rpd-desc", text: `參考進度：每期都最快過關時，這一期在第 ${stage.weeks} 週。這只是參考，不是期限。` });
    if (p.allDone) head.createDiv({ text: "COURSE.md：第 6 期全部通過後，開始六階課程的階 1；本課程的練習改成每次練習開頭做 2 分鐘。" });
    head.createDiv({ cls: "rpd-label", text: `必做：${stage.requiredText}` });
    const st = p.stages[stage.level - 1];
    for (const id of stage.required) {
      const extra = stage.mode === "recheck" ? (st.rechecked[id] ? "已重新檢查" : "尚未重新檢查（進入這一期之後需要再一次達到標準）") : "";
      this.exerciseRow(head, id, p, defaultPlace(id), extra);
    }

    // ---- 本週目標 ----
    if (game) {
      const week = summarizeWeek(snap.records, CURRICULUM.weeklyGoals, new Date());
      const wk = root.createDiv({ cls: "rpd-section" });
      wk.createEl("h3", { text: week.completed ? "本週目標：已完成" : "本週目標" });
      const ul = wk.createDiv({ cls: "rpd-goals" });
      week.goals.forEach((g, i) => {
        const meta = WEEKLY_GOALS[i];
        const el = ul.createDiv({ cls: g.met ? "rpd-goal is-met" : "rpd-goal" });
        el.createDiv({ cls: "rpd-goal-num", text: `${g.value}/${g.goal.target}` });
        el.createDiv({ text: `${meta.label}（${meta.unit}）` });
      });
    }

    // ---- 依場地 ----
    root.createEl("h3", { cls: "rpd-h", text: "今天可以做的" });

    const pad = root.createDiv({ cls: "rpd-section" });
    pad.createEl("h3", { text: "打擊墊 10 分鐘" });
    pad.createDiv({ cls: "rpd-plan", text: "2 分鐘 T1｜6 分鐘主要練習｜2 分鐘記錄" });
    pad.createDiv({ cls: "rpd-label", text: "暖手 2 分鐘" });
    this.exerciseRow(pad, "T1", p, "打擊墊", "", { duration: 120 });
    pad.createDiv({ cls: "rpd-label", text: `主要練習 6 分鐘：自己挑一個${stage.padNote ? `（${stage.padNote}）` : ""}` });
    const padList = unique([...stage.required.filter((id) => defaultPlace(id) === "打擊墊"), ...stage.pad]);
    for (const id of padList) this.exerciseRow(pad, id, p, "打擊墊", stage.required.includes(id) ? "必做" : "");
    if (stage.level >= PAIR_FROM_LEVEL) {
      const b = pad.createEl("button", { cls: "rpd-wide rpd-secondary", text: `兩個練習輪流，各 ${PAIR_SECONDS / 60} 分鐘` });
      b.onclick = () => new PairModal(this.app, padList, (a, c) => void this.plugin.openRunner(a, { pair: c, place: "打擊墊" })).open();
    }

    const thigh = root.createDiv({ cls: "rpd-section" });
    thigh.createEl("h3", { text: "大腿加腳跟 5 分鐘" });
    thigh.createDiv({ cls: "rpd-plan", text: `坐著，手拍大腿、腳跟點地，戴耳機${stage.thighNote ? `｜另外：${stage.thighNote}` : ""}` });
    for (const id of stage.thigh) this.exerciseRow(thigh, id, p, "大腿");

    const bridge = root.createDiv({ cls: "rpd-section" });
    bridge.createEl("h3", { text: "橋下 90 分鐘" });
    bridge.createDiv({ cls: "rpd-plan", text: `這一期：${stage.bridge}` });
    const plan: [string, string, string?][] = [
      ["15 分鐘", "D4：djembe 三個音的左右手一致，錄音", "D4"],
      ["20 分鐘", "把本週在打擊墊上已過關的一個練習搬到 djembe（速度比打擊墊慢 10 BPM）"],
      ["20 分鐘", "當期的 C 練習，腳用左腳 hi-hat 或腳踝鈴"],
      ["25 分鐘", "P1 或 P3，使用完整的混合鼓組"],
      ["10 分鐘", "自由即興一段並錄音"],
    ];
    for (const [t, what, id] of plan) {
      const row = bridge.createDiv({ cls: "rpd-ex" });
      row.createDiv({ cls: "rpd-ex-main" }).setText(`${t}｜${what}`);
      if (id) {
        renderCells(row, p.items[id]);
        row.onclick = () => void this.plugin.openRunner(id, { place: "橋下" });
      }
    }
    const impro = bridge.createEl("button", { cls: "rpd-wide rpd-secondary", text: "記錄一段即興（不計入進度）" });
    impro.onclick = () => new NewRecordModal(this.app, this.plugin.store, { place: "橋下", exercise: "即興", setting: "", bpm: null, durationMin: 10 }).open();

    // ---- 最近 7 天 ----
    const since = addDays(new Date(new Date().setHours(0, 0, 0, 0)), -6);
    const recent = sortRecords(snap.records.filter((r) => r.date >= since)).reverse();
    const rc = root.createDiv({ cls: "rpd-section" });
    rc.createEl("h3", { text: "最近 7 天的記錄" });
    if (!recent.length) rc.createDiv({ cls: "rpd-desc", text: "還沒有記錄。" });
    for (const r of recent) this.recordRow(rc, r);

    // ---- 讀不懂的筆記 ----
    if (snap.unreadable.length) {
      const bad = root.createDiv({ cls: "rpd-section rpd-warn" });
      bad.createEl("h3", { text: `這 ${snap.unreadable.length} 則讀不懂` });
      bad.createDiv({ cls: "rpd-desc", text: "已略過，不會自動修改。請打開筆記手動修正 frontmatter。" });
      for (const u of snap.unreadable) {
        const row = bad.createDiv({ cls: "rpd-row-link" });
        row.createDiv({ text: u.path.split("/").pop() ?? u.path });
        row.createDiv({ cls: "rpd-desc", text: u.reason });
        row.onclick = () => this.openPath(u.path);
      }
    }

    // ---- 全部練習 ----
    const all = root.createEl("details", { cls: "rpd-section rpd-all" });
    all.createEl("summary", { text: `全部練習（${EXERCISES.length} 個）` });
    for (const g of GROUPS) {
      all.createDiv({ cls: "rpd-label", text: g.name });
      for (const e of EXERCISES.filter((x) => x.group === g.id)) this.exerciseRow(all, e.id, p, defaultPlace(e.id));
    }

    const links = root.createDiv({ cls: "rpd-links" });
    if (game) {
      const b = links.createEl("button", { text: `徽章 ${p.itemBadges.length + p.groupBadges.length} / ${EXERCISES.length + GROUPS.length}` });
      b.onclick = () => void this.plugin.openView(BADGES_VIEW);
    }
    const s = links.createEl("button", { text: "成效（最近 8 週）" });
    s.onclick = () => void this.plugin.openView(STATS_VIEW);
    const cards = links.createEl("button", { text: "節奏卡" });
    cards.onclick = () => void this.plugin.openView(CARDS_VIEW, { path: null });

    // ---- 主要按鈕在下方，單手可按 ----
    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const row2 = bottom.createDiv({ cls: "rpd-choice" });
    const met = row2.createEl("button", { text: "節拍器" });
    met.onclick = () => void this.plugin.openView(METRONOME_VIEW);
    const add = row2.createEl("button", { cls: "mod-cta", text: "新增練習記錄" });
    add.onclick = () => this.openNew(stage.required[0], defaultPlace(stage.required[0]), p);
  }

  private exerciseRow(parent: HTMLElement, id: string, p: Progress, place: Place, extra = "", runner: { duration?: number } = {}): void {
    const ex = exerciseById(id);
    if (!ex) return;
    const ip = p.items[id];
    const row = parent.createDiv({ cls: "rpd-ex" });
    const main = row.createDiv({ cls: "rpd-ex-main" });
    main.createSpan({ cls: "rpd-code", text: id });
    main.createSpan({ text: ex.name });
    renderCells(row, ip);
    const last = ip.records[ip.records.length - 1];
    const sub: string[] = [];
    if (extra) sub.push(extra);
    if (ip.passedAt) sub.push("已過關");
    if (last) sub.push(`上次 ${fmtDate(last.date)} ${last.raw.bpm ? `${last.raw.bpm} BPM ` : ""}${last.passed ? "達到" : "沒達到"}`);
    const s = suggestNext(ex, ip.records, ip.cells);
    if (s.note && ip.records.length) sub.push(s.note);
    if (ip.otherRecords.length) sub.push(`鼓上 ${ip.otherRecords.length} 則`);
    if (sub.length) row.createDiv({ cls: "rpd-desc", text: sub.join("｜") });
    row.onclick = () => (hasScript(id) ? void this.plugin.openRunner(id, { place, ...runner }) : this.openNew(id, place, p));
  }

  private recordRow(parent: HTMLElement, r: LearningRecord): void {
    const row = parent.createDiv({ cls: "rpd-row-link" });
    const res = r.passed === true ? "達到" : r.passed === false ? "沒達到" : "";
    row.createDiv({ text: [fmtDate(r.date), r.context, r.item, r.raw.bpm ? `${r.raw.bpm} BPM` : "", res].filter(Boolean).join("　") });
    if (r.raw.dropped_at) row.createDiv({ cls: "rpd-desc", text: String(r.raw.dropped_at) });
    row.onclick = () => this.openPath(r.path);
  }

  private openNew(id: string, place: Place, p: Progress): void {
    const ex = exerciseById(id);
    const ip = p.items[id];
    const s = ex ? suggestNext(ex, ip.records, ip.cells) : { bpm: null, note: "" };
    new NewRecordModal(this.app, this.plugin.store, { place, exercise: id, setting: "", bpm: s.bpm, durationMin: null }, s.note).open();
  }

  private openPath(path: string): void {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) void this.app.workspace.getLeaf(false).openFile(f);
  }
}

/** 選兩個練習輪流 */
class PairModal extends Modal {
  private picked: string[] = [];
  constructor(app: TodayView["app"], private ids: string[], private onPick: (a: string, b: string) => void) {
    super(app);
  }
  onOpen(): void {
    this.setTitle(`選兩個練習輪流（各 ${PAIR_SECONDS / 60} 分鐘）`);
    const list = this.contentEl.createDiv({ cls: "rpd-choice rpd-choice-wrap" });
    const btns = this.ids.map((id) => {
      const b = list.createEl("button", { text: `${id} ${exerciseById(id)?.name ?? ""}` });
      b.onclick = () => {
        this.picked = this.picked.includes(id) ? this.picked.filter((x) => x !== id) : [...this.picked, id].slice(-2);
        btns.forEach((x, i) => x.toggleClass("mod-cta", this.picked.includes(this.ids[i])));
      };
      return b;
    });
    const go = this.contentEl.createEl("button", { cls: "mod-cta rpd-wide", text: "開始" });
    go.onclick = () => {
      if (this.picked.length !== 2) {
        new Notice("請選兩個練習");
        return;
      }
      this.close();
      this.onPick(this.picked[0], this.picked[1]);
    };
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function defaultPlace(id: string): Place {
  const ex = EXERCISES.find((e) => e.id === id);
  if (ex?.progressPlaces?.length) return ex.progressPlaces[0];
  return ex?.group === "C" ? "大腿" : "打擊墊";
}

function fmtDate(d: Date): string {
  const k = dayKey(d).slice(5).replace("-", "/");
  return `${k} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
