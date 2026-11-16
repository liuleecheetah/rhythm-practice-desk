// 練習執行器：說明 → 預備拍 → 計時執行 → 問結果 → 寫成一則練習記錄。
// 這個階段有腳本的練習：T2、H5a–d。

import { ItemView, MarkdownRenderer, Notice, Setting, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { computeProgress, findSection, fileStamp, localIsoMinute, type LearningRecord } from "@rpd/learning-core";
import {
  GROUPS, PLACES, PASS_STREAK, T2_LEVELS, T2_PASS_SECONDS, H5_FILLS, H5_TARGET,
  exerciseById, h5Bar, h5Config, h5Cue, h5ShouldStop, isH5, t2Config,
  type Exercise, type H5Variant, type Place, type StepEvent,
} from "@rpd/rhythm";
import type RhythmPracticeDesk from "../main";
import { CURRICULUM } from "../curriculum";
import { suggestNext } from "../suggest";
import { renderCells } from "./cells";
import { Ring } from "./ring";
import { Player } from "./player";
import { bpmControl } from "./controls";
import { backBar, trackBottomOffset } from "./layout";

export const RUNNER_VIEW = "rpd-runner";

export function hasScript(id: string): boolean {
  return id === "T2" || isH5(id);
}

type Phase = "intro" | "running" | "result" | "saved";

interface RunResult {
  seconds: number;
  setting: string;
  /** 腳本自動結束（達到時間或次數） */
  completed: boolean;
}

export class RunnerView extends ItemView {
  private exId = "T2";
  private phase: Phase = "intro";
  private bpm = 70;
  private place: Place = "打擊墊";
  private levelIdx = 0;
  private player: Player | null = null;
  private result: RunResult | null = null;
  private passed: boolean | null = null;
  private droppedAt = "";
  private savedPath = "";
  /** 每次重畫加一；非同步的部分完成時若已不是最新一次就放棄 */
  private renderSeq = 0;

  constructor(leaf: WorkspaceLeaf, private plugin: RhythmPracticeDesk) {
    super(leaf);
  }

  getViewType(): string { return RUNNER_VIEW; }
  getDisplayText(): string { return "練習"; }
  getIcon(): string { return "drum"; }

  getState(): Record<string, unknown> {
    return { exercise: this.exId };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const id = (state as { exercise?: string })?.exercise;
    if (id && hasScript(id)) this.exId = id;
    this.resetForExercise();
    await super.setState(state, result);
    this.render();
  }

  private untrack: (() => void) | null = null;

  async onOpen(): Promise<void> {
    this.untrack = trackBottomOffset(this.contentEl);
    this.resetForExercise();
    this.render();
  }

  async onClose(): Promise<void> {
    this.player?.stop();
    this.untrack?.();
  }

  private goHome(): void {
    this.player?.stop();
    this.resetForExercise();
    this.render();
    void this.plugin.openToday();
  }

  private get ex(): Exercise {
    return exerciseById(this.exId)!;
  }

  private records(): { records: LearningRecord[]; cells: number } {
    const p = computeProgress(this.plugin.store.snapshot.records, CURRICULUM);
    const ip = p.items[this.exId];
    return { records: ip.records, cells: ip.cells };
  }

  private resetForExercise(): void {
    this.player?.stop();
    this.phase = "intro";
    this.result = null;
    this.passed = null;
    this.droppedAt = "";
    const { records, cells } = this.records();
    this.bpm = suggestNext(this.ex, records, cells).bpm ?? this.ex.bpm ?? 70;
    this.place = this.ex.group === "C" ? "大腿" : "打擊墊";
    // T2 從上次記錄的那一級開始；沒有記錄時從「全開」
    const lastSetting = String(records[records.length - 1]?.raw.setting ?? "");
    const idx = T2_LEVELS.findIndex((l) => l.label === lastSetting);
    this.levelIdx = idx >= 0 ? idx : 0;
  }

  private render(): void {
    this.renderSeq++;
    const root = this.contentEl;
    root.empty();
    root.addClass("rpd-root");
    backBar(root, () => this.goHome(), this.phase === "running" ? "停止並回今日頁" : "今日頁");
    if (this.phase === "intro") void this.renderIntro(root);
    else if (this.phase === "running") void this.renderRunning(root);
    else if (this.phase === "result") this.renderResult(root);
    else this.renderSaved(root);
  }

  // ---------- 1. 說明 ----------

  private async renderIntro(root: HTMLElement): Promise<void> {
    const ex = this.ex;
    const group = GROUPS.find((g) => g.id === ex.group)?.name ?? "";
    const head = root.createDiv({ cls: "rpd-section" });
    head.createEl("h2", { text: `${ex.id} ${ex.name}` });
    head.createDiv({ cls: "rpd-desc", text: `項目：${group}｜預設：${ex.preset}` });
    const ev = head.createDiv({ cls: "rpd-tags" });
    for (const e of ex.evidence) ev.createSpan({ cls: "rpd-tag", text: e });
    if (ex.evidenceNote) head.createDiv({ cls: "rpd-desc", text: `依據：${ex.evidenceNote}` });

    const pass = root.createDiv({ cls: "rpd-section rpd-pass" });
    pass.createDiv({ cls: "rpd-label", text: "過關標準" });
    pass.createDiv({ text: ex.pass });
    pass.createDiv({ cls: "rpd-desc", text: `同一個練習連續 ${PASS_STREAK} 次達到標準才算過關。` });
    if (isH5(ex.id)) {
      const f = H5_FILLS[ex.id];
      pass.createDiv({ cls: "rpd-desc", text: `fill 的位置：第 4 小節${f.where}，${f.kind} ${f.hits} 下，右手開始、左右輪流。節拍器只在 fill 之後的那一小節響。自動計數到 ${H5_TARGET} 次。` });
    }

    const { records, cells } = this.records();
    const last = records[records.length - 1];
    const st = root.createDiv({ cls: "rpd-section" });
    const row = st.createDiv({ cls: "rpd-ex-main" });
    row.createSpan({ cls: "rpd-label", text: "目前進度" });
    renderCells(row, { cells } as never);
    if (last) st.createDiv({ cls: "rpd-desc", text: `上次：${localIsoMinute(last.date).replace("T", " ")}，${last.raw.bpm ? `${last.raw.bpm} BPM，` : ""}${last.raw.setting ? `${last.raw.setting}，` : ""}${last.passed ? "達到" : "沒達到"}` });
    const s = suggestNext(ex, records, cells);
    if (s.note) st.createDiv({ cls: s.backtrack ? "rpd-desc rpd-warn-text" : "rpd-desc", text: s.note });

    // 課程原文
    const details = root.createEl("details", { cls: "rpd-section rpd-course" });
    details.createEl("summary", { text: "做法、檢查方法、常見錯誤（COURSE.md 原文）" });
    const body = details.createDiv();
    const seq = this.renderSeq;
    const md = await this.plugin.readCourse();
    if (seq !== this.renderSeq) return; // 等待期間畫面已經重畫
    const section = md ? findSection(md, ex.id) : null;
    if (section) await MarkdownRenderer.render(this.app, section, body, this.plugin.coursePath(), this);
    else body.createDiv({ cls: "rpd-desc", text: md ? `COURSE.md 裡找不到 ${ex.id} 的段落。` : `找不到 ${this.plugin.coursePath()}。請把課程檔放在這裡，或到設定改路徑。` });

    // 設定
    const set = root.createDiv({ cls: "rpd-section" });
    new Setting(set).setName("場地").addDropdown((dd) => {
      for (const p of PLACES) dd.addOption(p, p);
      dd.setValue(this.place).onChange((v) => (this.place = v as Place));
    });
    this.bpmControl(set);
    if (ex.id === "T2") {
      set.createDiv({ cls: "rpd-label", text: "從哪一級開始" });
      const lv = set.createDiv({ cls: "rpd-choice rpd-choice-4" });
      T2_LEVELS.forEach((l, i) => {
        const b = lv.createEl("button", { text: l.optional ? `${l.label}（選配）` : l.label });
        if (i === this.levelIdx) b.addClass("mod-cta");
        b.onclick = () => { this.levelIdx = i; this.render(); };
      });
      set.createDiv({ cls: "rpd-desc", text: `「響1靜3」連續 ${T2_PASS_SECONDS / 60} 分鐘後自動結束。其他級別請自己按「結束」。` });
    }

    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const start = bottom.createEl("button", { cls: "mod-cta rpd-wide", text: "開始（先一小節預備拍）" });
    start.onclick = () => { this.phase = "running"; this.render(); };
  }

  private bpmControl(parent: HTMLElement): void {
    bpmControl(parent, () => this.bpm, (v) => (this.bpm = v));
  }

  // ---------- 2. 執行 ----------

  private async renderRunning(root: HTMLElement): Promise<void> {
    const ex = this.ex;
    root.createEl("h2", { text: `${ex.id} ${ex.name}` });
    const ring = new Ring(root);
    const info = root.createDiv({ cls: "rpd-run-info" });
    const timer = root.createDiv({ cls: "rpd-run-timer", text: "預備" });
    const controls = root.createDiv();
    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const stopBtn = bottom.createEl("button", { cls: "rpd-wide", text: "結束" });

    const player = new Player(this.plugin, ring);
    this.player = player;
    let finished = false;
    let curBar = -1;
    let levelStart = 0; // 目前這一級開始的練習秒數
    const finish = (completed: boolean) => {
      if (finished) return;
      finished = true;
      const seconds = Math.max(0, player.met?.elapsed() ?? 0);
      const setting = ex.id === "T2" ? T2_LEVELS[this.levelIdx].label : `${h5Bar(Math.max(0, curBar)).completed} 次`;
      player.stop();
      this.result = { seconds, setting, completed };
      this.phase = "result";
      this.render();
    };
    stopBtn.onclick = () => finish(false);
    const elapsed = () => player.met?.elapsed() ?? 0;

    if (ex.id === "T2") {
      const cfg = t2Config(this.bpm);
      const lv = T2_LEVELS[this.levelIdx];
      cfg.muteOn = lv.on;
      cfg.muteOff = lv.off;
      controls.createDiv({ cls: "rpd-label", text: "換級（從下一小節起生效）" });
      const row = controls.createDiv({ cls: "rpd-choice rpd-choice-4" });
      const btns = T2_LEVELS.map((l, i) => {
        const b = row.createEl("button", { text: l.label });
        b.onclick = () => {
          this.levelIdx = i;
          player.met?.setMute(l.on, l.off);
          levelStart = Math.max(0, elapsed());
          btns.forEach((x, j) => x.toggleClass("mod-cta", j === i));
        };
        return b;
      });
      btns[this.levelIdx].addClass("mod-cta");
      player.layout(cfg);
      await player.start(cfg, {
        onBar: () => {
          const lvNow = T2_LEVELS[this.levelIdx];
          if (lvNow.passLevel && elapsed() - levelStart >= T2_PASS_SECONDS) window.setTimeout(() => finish(true), 0);
        },
        onHeard: (e) => {
          curBar = e.bar;
          const lvNow = T2_LEVELS[this.levelIdx];
          if (e.countIn) {
            ring.setCenter(String(e.step + 1));
            ring.setLabel("預備");
            return;
          }
          ring.setCenter(String(e.step + 1));
          ring.setLabel(`${lvNow.label}｜${e.muted ? "靜" : "響"}`, e.muted ? "rest" : "");
          info.setText(`第 ${e.bar + 1} 小節｜${this.bpm} BPM`);
          const t = elapsed() - levelStart;
          timer.setText(lvNow.passLevel ? `${fmt(t)} / ${fmt(T2_PASS_SECONDS)}` : fmt(elapsed()));
        },
      });
    } else if (isH5(ex.id)) {
      const v = ex.id as H5Variant;
      const cfg = h5Config(this.bpm);
      const f = H5_FILLS[v];
      // 環上把 fill 的拍標成「皮」
      player.layout(cfg, new Set(Array.from({ length: 4 - f.fromBeat }, (_, i) => f.fromBeat + i)));
      await player.start(cfg, {
        onBar: (bar) => {
          if (h5ShouldStop(bar)) window.setTimeout(() => finish(true), 0);
        },
        onHeard: (e: StepEvent) => {
          curBar = e.bar;
          ring.setCenter(String(e.step + 1));
          if (e.countIn) {
            ring.setLabel("預備");
            return;
          }
          const b = h5Bar(e.bar);
          const cue = h5Cue(v, e.bar, e.step);
          ring.setLabel(cue.text, cue.kind);
          info.setText(`第 ${b.cycleBar} 小節（4 小節一輪）｜${this.bpm} BPM`);
          timer.setText(`已完成 ${b.completed} / ${H5_TARGET} 次`);
        },
      });
    }
  }

  // ---------- 3. 問結果 ----------

  private renderResult(root: HTMLElement): void {
    const r = this.result!;
    const ex = this.ex;
    root.createEl("h2", { text: `${ex.id} 結束` });
    root.createDiv({ cls: "rpd-desc", text: `練習 ${fmt(r.seconds)}｜${this.bpm} BPM｜${r.setting}${r.completed ? "｜已完成腳本" : ""}` });
    const pass = root.createDiv({ cls: "rpd-section rpd-pass" });
    pass.createDiv({ cls: "rpd-label", text: "過關標準" });
    pass.createDiv({ text: ex.pass });
    if (ex.id === "T2" && !T2_LEVELS.find((l) => l.label === r.setting)?.passLevel) {
      pass.createDiv({ cls: "rpd-desc", text: "提醒：T2 只有「響1靜3」那一級才算過關判定。" });
    }

    root.createDiv({ cls: "rpd-label", text: "達到過關標準了嗎？" });
    const row = root.createDiv({ cls: "rpd-choice" });
    const yes = row.createEl("button", { text: "達到" });
    const no = row.createEl("button", { text: "沒達到" });
    const sync = () => {
      yes.toggleClass("mod-cta", this.passed === true);
      no.toggleClass("mod-warning", this.passed === false);
    };
    yes.onclick = () => { this.passed = true; sync(); };
    no.onclick = () => { this.passed = false; sync(); };
    sync();
    new Setting(root).setName("哪裡出錯").setDesc("選填，一句話").addText((t) => t.setValue(this.droppedAt).onChange((v) => (this.droppedAt = v.trim())));

    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const save = bottom.createEl("button", { cls: "mod-cta rpd-wide", text: "儲存記錄" });
    save.onclick = () => void this.save();
    const discard = bottom.createEl("button", { cls: "rpd-wide rpd-secondary", text: "不記錄，回到說明" });
    discard.onclick = () => { this.resetForExercise(); this.render(); };
  }

  private async save(): Promise<void> {
    if (this.passed === null) {
      new Notice("請選「達到」或「沒達到」");
      return;
    }
    const r = this.result!;
    const now = new Date();
    const fm = {
      type: "practice-log",
      date: localIsoMinute(now),
      place: this.place,
      exercise: this.exId,
      setting: r.setting,
      bpm: this.bpm,
      passed: this.passed,
      duration_min: Math.max(1, Math.round(r.seconds / 60)),
      dropped_at: this.droppedAt,
    };
    try {
      const f = await this.plugin.store.create(`${fileStamp(now)}-${this.exId}`, fm);
      this.savedPath = f.path;
      await this.plugin.store.scan();
      this.phase = "saved";
      this.render();
    } catch (e) {
      new Notice(`建立失敗：${(e as Error).message}`);
    }
  }

  // ---------- 4. 結果 ----------

  private renderSaved(root: HTMLElement): void {
    const ex = this.ex;
    const { records, cells } = this.records();
    root.createEl("h2", { text: "已記錄" });
    root.createDiv({ cls: "rpd-desc", text: this.savedPath });
    const box = root.createDiv({ cls: "rpd-section" });
    const row = box.createDiv({ cls: "rpd-ex-main" });
    row.createSpan({ cls: "rpd-label", text: `${ex.id} 進度` });
    renderCells(row, { cells } as never);
    if (this.passed && cells >= PASS_STREAK) box.createDiv({ cls: "rpd-big", text: "這個練習過關了" });
    const s = suggestNext(ex, records, cells);
    if (s.note) box.createDiv({ cls: s.backtrack ? "rpd-warn-text" : "rpd-desc", text: s.bpm && !this.passed ? `${s.note}：下次 ${s.bpm} BPM` : s.note });

    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const again = bottom.createEl("button", { cls: "mod-cta rpd-wide", text: "再練一次" });
    again.onclick = () => { this.resetForExercise(); this.render(); };
    const home = bottom.createEl("button", { cls: "rpd-wide rpd-secondary", text: "回今日頁" });
    home.onclick = () => void this.plugin.openToday();
  }
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
