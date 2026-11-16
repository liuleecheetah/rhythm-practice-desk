import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { computeProgress, dayKey, summarizeWeek, addDays, sortRecords, type Progress, type StoreSnapshot, type LearningRecord } from "@rpd/learning-core";
import { EXERCISES, GROUPS, STAGES, WEEKLY_GOALS, exerciseById, type Place } from "@rpd/rhythm";
import type RhythmPracticeDesk from "../main";
import { CURRICULUM } from "../curriculum";
import { suggestNext } from "../suggest";
import { renderCells } from "./cells";
import { NewRecordModal } from "./newRecord";
import { hasScript } from "./runner";
import { METRONOME_VIEW } from "./metronomeView";

export const TODAY_VIEW = "rpd-today";

export class TodayView extends ItemView {
  private off: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: RhythmPracticeDesk) {
    super(leaf);
  }

  getViewType(): string { return TODAY_VIEW; }
  getDisplayText(): string { return "節奏練習台"; }
  getIcon(): string { return "drum"; }

  async onOpen(): Promise<void> {
    this.off = this.plugin.store.onChange((s) => this.render(s));
    this.render(this.plugin.store.snapshot);
  }

  async onClose(): Promise<void> {
    this.off?.();
  }

  private render(snap: StoreSnapshot): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("rpd-root");
    const p = computeProgress(snap.records, CURRICULUM);
    const stage = STAGES.find((s) => s.level === p.level)!;

    // 目前在第幾期
    const head = root.createDiv({ cls: "rpd-section" });
    head.createEl("h2", { text: p.allDone ? "六期都已完成" : `第 ${stage.level} 期（等級 ${stage.level}）` });
    head.createDiv({ cls: "rpd-desc", text: `參考進度：最快第 ${stage.weeks} 週。這只是參考，不是期限。` });
    head.createDiv({ cls: "rpd-label", text: `必做：${stage.requiredText}` });
    const st = p.stages[stage.level - 1];
    for (const id of stage.required) {
      const extra = stage.mode === "recheck" ? (st.rechecked[id] ? "已重新檢查" : "尚未重新檢查") : "";
      this.exerciseRow(head, id, p, defaultPlace(id), extra);
    }

    // 本週目標
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

    // 本期可選練習
    const opt = root.createDiv({ cls: "rpd-section" });
    opt.createEl("h3", { text: "這一期的練習" });
    opt.createDiv({ cls: "rpd-label", text: `打擊墊${stage.padNote ? `（${stage.padNote}）` : ""}` });
    for (const id of stage.pad) this.exerciseRow(opt, id, p, "打擊墊");
    opt.createDiv({ cls: "rpd-label", text: `大腿加腳跟${stage.thighNote ? `（另外：${stage.thighNote}）` : ""}` });
    for (const id of stage.thigh) this.exerciseRow(opt, id, p, "大腿");
    opt.createDiv({ cls: "rpd-label", text: "橋下" });
    opt.createDiv({ text: stage.bridge });

    // 全部練習：不限這一期，任何代號都能開啟
    const all = root.createEl("details", { cls: "rpd-section rpd-all" });
    all.createEl("summary", { text: `全部練習（${EXERCISES.length} 個）` });
    for (const g of GROUPS) {
      all.createDiv({ cls: "rpd-label", text: g.name });
      for (const e of EXERCISES.filter((x) => x.group === g.id)) this.exerciseRow(all, e.id, p, defaultPlace(e.id));
    }

    // 最近 7 天
    const since = addDays(new Date(new Date().setHours(0, 0, 0, 0)), -6);
    const recent = sortRecords(snap.records.filter((r) => r.date >= since)).reverse();
    const rc = root.createDiv({ cls: "rpd-section" });
    rc.createEl("h3", { text: "最近 7 天的記錄" });
    if (!recent.length) rc.createDiv({ cls: "rpd-desc", text: "還沒有記錄。" });
    for (const r of recent) this.recordRow(rc, r);

    // 讀不懂的筆記
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

    // 主要按鈕在下方，單手可按
    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const row2 = bottom.createDiv({ cls: "rpd-choice" });
    const met = row2.createEl("button", { text: "節拍器" });
    met.onclick = () => void this.plugin.openView(METRONOME_VIEW);
    const add = row2.createEl("button", { cls: "mod-cta", text: "新增練習記錄" });
    add.onclick = () => this.openNew(stage.required[0], defaultPlace(stage.required[0]), p);
  }

  private exerciseRow(parent: HTMLElement, id: string, p: Progress, place: Place, extra = ""): void {
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
    if (ip.passedAt) sub.push("已過關");
    if (extra) sub.push(extra);
    if (last) sub.push(`上次 ${fmtDate(last.date)} ${last.raw.bpm ? `${last.raw.bpm} BPM ` : ""}${last.passed ? "達到" : "沒達到"}`);
    const s = suggestNext(ex, ip.records, ip.cells);
    if (s.note && ip.records.length) sub.push(s.note); // 沒有記錄時不重複顯示「課程的預設速度」
    if (ip.otherRecords.length) sub.push(`鼓上 ${ip.otherRecords.length} 則`);
    if (sub.length) row.createDiv({ cls: "rpd-desc", text: sub.join("｜") });
    if (hasScript(id)) row.createDiv({ cls: "rpd-desc rpd-accent-text", text: "點這裡開始練習（有節拍器腳本）" });
    row.onclick = () => (hasScript(id) ? void this.plugin.openRunner(id) : this.openNew(id, place, p));
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
    new NewRecordModal(this.app, this.plugin.store, {
      place,
      exercise: id,
      setting: "",
      bpm: s.bpm,
      durationMin: null,
    }, s.note).open();
  }

  private openPath(path: string): void {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) void this.app.workspace.getLeaf(false).openFile(f);
  }
}

function defaultPlace(id: string): Place {
  const ex = EXERCISES.find((e) => e.id === id);
  if (ex?.progressPlaces?.length) return ex.progressPlaces[0];
  return ex?.group === "C" ? "大腿" : "打擊墊";
}

function fmtDate(d: Date): string {
  const k = dayKey(d).slice(5).replace("-", "/");
  return `${k} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}


