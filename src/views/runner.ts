// 練習執行器：說明 → 預備拍 → 計時執行 → 問結果 → 寫成練習記錄。
// 所有 29 個練習都由 @rpd/rhythm 的腳本驅動；也支援「兩個練習輪流，各 3 分鐘」。

import { ItemView, MarkdownRenderer, Notice, Setting, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { computeProgress, findSection, fileStamp, localIsoMinute, type LearningRecord, type Progress } from "@rpd/learning-core";
import {
  GROUPS, PLACES, PASS_STREAK, effectiveSubdivision, exerciseById, scriptFor, defaultBpmFor,
  type ClickConfig, type Exercise, type ExerciseScript, type MuteLevel, type Place, type ScriptOptions, type StepEvent,
} from "@rpd/rhythm";
import type RhythmPracticeDesk from "../main";
import { CURRICULUM } from "../curriculum";
import { suggestNext } from "../suggest";
import { renderCells } from "./cells";
import { Ring } from "./ring";
import { Player } from "./player";
import { bpmControl, choice } from "./controls";
import { backBar, trackBottomOffset } from "./layout";

export const RUNNER_VIEW = "rpd-runner";
export const PAIR_SECONDS = 180;

export function hasScript(id: string): boolean {
  return !!scriptFor(id);
}

type Phase = "intro" | "running" | "result" | "saved";

interface Item {
  id: string;
  bpm: number;
  opts: ScriptOptions;
  levelIdx: number;
}

interface RunResult {
  id: string;
  bpm: number;
  seconds: number;
  setting: string;
  completed: boolean;
  passed: boolean | null;
  droppedAt: string;
}

export interface RunnerState {
  exercise: string;
  /** 輪流模式的第二個練習 */
  pair?: string;
  /** 覆寫結束時間（秒），例如暖手 T1 兩分鐘 */
  duration?: number;
  place?: Place;
}

export class RunnerView extends ItemView {
  private state: RunnerState = { exercise: "T2" };
  private items: Item[] = [];
  private current = 0;
  private phase: Phase = "intro";
  private place: Place = "打擊墊";
  private player: Player | null = null;
  private results: RunResult[] = [];
  private saved: string[] = [];
  private before: Progress | null = null;
  private renderSeq = 0;
  private untrack: (() => void) | null = null;
  private timerHandle = 0;

  constructor(leaf: WorkspaceLeaf, private plugin: RhythmPracticeDesk) {
    super(leaf);
  }

  getViewType(): string { return RUNNER_VIEW; }
  getDisplayText(): string { return "練習"; }
  getIcon(): string { return "drum"; }

  getState(): Record<string, unknown> {
    return { ...this.state };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = state as RunnerState | undefined;
    if (s?.exercise && hasScript(s.exercise)) this.state = { ...s, pair: s.pair && hasScript(s.pair) ? s.pair : undefined };
    this.reset();
    await super.setState(state, result);
    this.render();
  }

  async onOpen(): Promise<void> {
    this.untrack = trackBottomOffset(this.contentEl);
    this.reset();
    this.render();
  }

  async onClose(): Promise<void> {
    this.stopAll();
    this.untrack?.();
  }

  private stopAll(): void {
    this.player?.stop();
    this.player = null;
    window.clearInterval(this.timerHandle);
    void this.plugin.audio.keepAwake(false);
  }

  private progress(): Progress {
    return computeProgress(this.plugin.store.snapshot.records, CURRICULUM);
  }

  private recordsOf(id: string): { records: LearningRecord[]; cells: number } {
    const ip = this.progress().items[id];
    return { records: ip.records, cells: ip.cells };
  }

  private makeItem(id: string): Item {
    const ex = exerciseById(id)!;
    const script = scriptFor(id)!;
    const { records, cells } = this.recordsOf(id);
    const bpm = suggestNext(ex, records, cells).bpm ?? defaultBpmFor(id);
    const last = String(records[records.length - 1]?.raw.setting ?? "");
    const lv = script.levels?.findIndex((l) => l.label === last) ?? -1;
    return { id, bpm, opts: { ...(script.defaults ?? {}) }, levelIdx: lv >= 0 ? lv : 0 };
  }

  private reset(): void {
    this.stopAll();
    this.phase = "intro";
    this.results = [];
    this.saved = [];
    this.current = 0;
    const ids = [this.state.exercise, ...(this.state.pair ? [this.state.pair] : [])];
    this.items = ids.map((id) => this.makeItem(id));
    const ex = exerciseById(this.state.exercise)!;
    this.place = this.state.place ?? (ex.progressPlaces?.[0] ?? (ex.group === "C" ? "大腿" : "打擊墊"));
  }

  private goHome(): void {
    this.reset();
    this.render();
    void this.plugin.openToday();
  }

  private render(): void {
    this.renderSeq++;
    const root = this.contentEl;
    root.empty();
    root.removeClass("is-running");
    root.addClass("rpd-root");
    backBar(root, () => this.goHome(), this.phase === "running" ? "停止並回今日頁" : "今日頁");
    if (this.phase === "intro") void this.renderIntro(root);
    else if (this.phase === "running") void this.renderRunning(root);
    else if (this.phase === "result") this.renderResult(root);
    else this.renderSaved(root);
  }

  private get pairMode(): boolean {
    return this.items.length > 1;
  }

  // ---------- 1. 說明 ----------

  private async renderIntro(root: HTMLElement): Promise<void> {
    const seq = this.renderSeq;
    if (this.pairMode) {
      const h = root.createDiv({ cls: "rpd-section" });
      h.createEl("h2", { text: "兩個練習輪流" });
      h.createDiv({ cls: "rpd-desc", text: `${this.items.map((i) => i.id).join(" → ")}，每個 ${PAIR_SECONDS / 60} 分鐘，中間自動換。結束後分別記錄。` });
      h.createDiv({ cls: "rpd-desc", text: "依據：Carter 與 Grahn（2016）。COURSE.md 註明這是可以試的做法，不是確定有效的做法。" });
    }
    const md = await this.plugin.readCourse();
    if (seq !== this.renderSeq) return;
    for (const item of this.items) await this.introFor(root, item, md, seq);
    if (seq !== this.renderSeq) return;

    const set = root.createDiv({ cls: "rpd-section" });
    new Setting(set).setName("場地").addDropdown((dd) => {
      for (const p of PLACES) dd.addOption(p, p);
      dd.setValue(this.place).onChange((v) => (this.place = v as Place));
    });

    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const start = bottom.createEl("button", { cls: "mod-cta rpd-wide", text: scriptFor(this.items[0].id)!.clicks ? "開始（先一小節預備拍）" : "開始計時" });
    start.onclick = () => {
      this.before = this.progress();
      this.phase = "running";
      this.render();
    };
  }

  private async introFor(root: HTMLElement, item: Item, md: string | null, seq: number): Promise<void> {
    const ex = exerciseById(item.id)!;
    const script = scriptFor(item.id)!;
    const group = GROUPS.find((g) => g.id === ex.group)?.name ?? "";
    const head = root.createDiv({ cls: "rpd-section" });
    head.createEl("h2", { text: `${ex.id} ${ex.name}` });
    head.createDiv({ cls: "rpd-desc", text: `項目：${group}｜預設：${ex.preset}` });
    const ev = head.createDiv({ cls: "rpd-tags" });
    for (const e of ex.evidence) ev.createSpan({ cls: "rpd-tag", text: e });
    if (ex.evidenceNote) head.createDiv({ cls: "rpd-desc", text: `依據：${ex.evidenceNote}` });

    const pass = head.createDiv({ cls: "rpd-pass-box" });
    pass.createDiv({ cls: "rpd-label", text: "過關標準" });
    pass.createDiv({ text: ex.pass });
    pass.createDiv({ cls: "rpd-desc", text: `同一個練習連續 ${PASS_STREAK} 次達到標準才算過關。` });

    const { records, cells } = this.recordsOf(item.id);
    const last = records[records.length - 1];
    const row = head.createDiv({ cls: "rpd-ex-main" });
    row.createSpan({ cls: "rpd-label", text: "目前進度" });
    renderCells(row, { cells } as never);
    if (last) head.createDiv({ cls: "rpd-desc", text: `上次：${localIsoMinute(last.date).replace("T", " ")}，${last.raw.bpm ? `${last.raw.bpm} BPM，` : ""}${last.raw.setting ? `${last.raw.setting}，` : ""}${last.passed ? "達到" : "沒達到"}` });
    const s = suggestNext(ex, records, cells);
    if (s.note) head.createDiv({ cls: s.backtrack ? "rpd-desc rpd-warn-text" : "rpd-desc", text: s.note });

    const details = head.createEl("details", { cls: "rpd-course" });
    details.createEl("summary", { text: "做法、檢查方法、常見錯誤（COURSE.md 原文）" });
    const body = details.createDiv();
    const section = md ? findSection(md, ex.id) : null;
    if (section) await MarkdownRenderer.render(this.app, section, body, this.plugin.coursePath(), this);
    else body.createDiv({ cls: "rpd-desc", text: md ? `COURSE.md 裡找不到 ${ex.id} 的段落。` : `找不到 ${this.plugin.coursePath()}。請把課程檔放在這裡，或到設定改路徑。` });
    if (seq !== this.renderSeq) return;

    if (script.clicks) {
      bpmControl(head, () => item.bpm, (v) => (item.bpm = v));
      if (ex.bpm === null && script.fallbackBpm) head.createDiv({ cls: "rpd-desc", text: `課程沒有指定速度，先用 ${script.fallbackBpm} BPM。` });
    } else {
      head.createDiv({ cls: "rpd-desc", text: `這個練習不用節拍器，只計時。${script.instructions ?? ""}` });
    }
    for (const opt of script.options ?? []) {
      head.createDiv({ cls: "rpd-label", text: opt.label });
      if (opt.multi) {
        const rowEl = head.createDiv({ cls: "rpd-choice rpd-choice-wrap" });
        const btns = opt.choices.map((c) => {
          const b = rowEl.createEl("button", { text: c.label });
          b.onclick = () => {
            const cur = new Set((item.opts[opt.key] as number[] | undefined) ?? []);
            if (cur.has(c.value as number)) { if (cur.size > 1) cur.delete(c.value as number); } else cur.add(c.value as number);
            (item.opts as Record<string, unknown>)[opt.key] = [...cur].sort((a, b) => a - b);
            sync();
          };
          return b;
        });
        const sync = () => btns.forEach((b, i) => b.toggleClass("mod-cta", ((item.opts[opt.key] as number[] | undefined) ?? []).includes(opt.choices[i].value as number)));
        sync();
      } else {
        choice(head, opt.choices.map((c) => ({ value: String(c.value), label: c.label })),
          () => String(item.opts[opt.key]),
          (v) => {
            const c = opt.choices.find((x) => String(x.value) === v)!;
            (item.opts as Record<string, unknown>)[opt.key] = c.value;
          });
      }
    }
    if (script.levels) {
      head.createDiv({ cls: "rpd-label", text: "從哪一級開始" });
      choice(head, script.levels.map((l, i) => ({ value: i, label: l.optional ? `${l.label}（選配）` : l.label })), () => item.levelIdx, (v) => (item.levelIdx = v));
      const pl = script.levels.find((l) => l.passLevel);
      if (pl && script.target?.kind === "seconds") head.createDiv({ cls: "rpd-desc", text: `「${pl.label}」連續 ${Math.round(script.target.value / 60)} 分鐘後自動結束。其他級別請自己按「結束」。` });
    }
    const target = this.targetFor(item);
    if (target && !script.levels) head.createDiv({ cls: "rpd-desc", text: target.kind === "seconds" ? `${fmt(target.value)} 後自動結束。` : `${target.value} 小節後自動結束。` });
  }

  private targetFor(item: Item): ExerciseScript["target"] {
    if (this.pairMode) return { kind: "seconds", value: PAIR_SECONDS };
    if (this.state.duration) return { kind: "seconds", value: this.state.duration };
    return scriptFor(item.id)!.target;
  }

  // ---------- 2. 執行 ----------

  private async renderRunning(root: HTMLElement): Promise<void> {
    const item = this.items[this.current];
    const ex = exerciseById(item.id)!;
    const script = scriptFor(item.id)!;
    const target = this.targetFor(item);
    root.addClass("is-running");
    root.createEl("h2", { text: `${ex.id} ${ex.name}${this.pairMode ? `（${this.current + 1}/${this.items.length}）` : ""}` });

    let finished = false;
    let lastBar = -1;
    // 目前經過的秒數；只計時模式會換成自己的計時
    let secsNow = () => this.player?.met?.elapsed() ?? 0;
    let levelStart = 0;
    const levels = script.levels;
    const level = (): MuteLevel | undefined => levels?.[item.levelIdx];

    const bottom = () => {
      const b = root.createDiv({ cls: "rpd-bottom" });
      const stop = b.createEl("button", { cls: "rpd-wide", text: this.pairMode && this.current < this.items.length - 1 ? "結束這一個，換下一個" : "結束" });
      stop.onclick = () => finish(false);
    };

    const finish = (completed: boolean, seconds?: number) => {
      if (finished) return;
      finished = true;
      const secs = Math.max(0, seconds ?? secsNow());
      this.stopAll();
      this.results.push({ id: item.id, bpm: item.bpm, seconds: secs, setting: script.setting(item.opts, lastBar, level()), completed, passed: null, droppedAt: "" });
      if (this.current < this.items.length - 1) this.current++;
      else this.phase = "result";
      this.render();
    };

    // 只計時
    if (!script.clicks) {
      root.createDiv({ cls: "rpd-section", text: script.instructions ?? "" });
      const timer = root.createDiv({ cls: "rpd-run-timer", text: "0:00" });
      const t0 = performance.now();
      secsNow = () => (performance.now() - t0) / 1000;
      void this.plugin.audio.keepAwake(true);
      this.timerHandle = window.setInterval(() => {
        const s = (performance.now() - t0) / 1000;
        timer.setText(target?.kind === "seconds" ? `${fmt(s)} / ${fmt(target.value)}` : fmt(s));
        if (target?.kind === "seconds" && s >= target.value) finish(true, s);
      }, 250);
      bottom();
      return;
    }

    const ring = new Ring(root);
    const meter = root.createDiv({ cls: "rpd-meter" });
    const meterFill = meter.createDiv({ cls: "rpd-meter-fill" });
    meter.hide();
    const detail = root.createDiv({ cls: "rpd-run-detail" });
    const info = root.createDiv({ cls: "rpd-run-info" });
    const timer = root.createDiv({ cls: "rpd-run-timer", text: "預備" });
    const controls = root.createDiv();
    bottom();

    const cfg: ClickConfig = script.config(item.bpm, item.opts);
    if (levels) {
      const lv = levels[item.levelIdx];
      cfg.muteOn = lv.on;
      cfg.muteOff = lv.off;
      controls.createDiv({ cls: "rpd-label", text: "換級（從下一小節起生效）" });
      choice(controls, levels.map((l, i) => ({ value: i, label: l.label })), () => item.levelIdx, (i) => {
        item.levelIdx = i;
        this.player?.met?.setMute(levels[i].on, levels[i].off);
        levelStart = Math.max(0, this.player?.met?.elapsed() ?? 0);
      });
    }

    const player = new Player(this.plugin, ring);
    this.player = player;
    // handSteps 回傳的是格的序號（與 StepEvent.step 相同）
    const hand = (bar: number) => (script.handSteps ? new Set(script.handSteps(bar, player.met?.config ?? cfg, item.opts)) : undefined);
    player.layout(cfg, hand(0));
    const elapsed = () => player.met?.elapsed() ?? 0;

    const started = player.start(cfg, {
      onBar: (bar) => {
        const up = script.barUpdate?.(bar, item.opts);
        if (up?.grouping7) player.met?.setGrouping7(up.grouping7);
        if (target?.kind === "bars" && bar >= target.value) window.setTimeout(() => finish(true), 0);
        if (target?.kind === "seconds") {
          const gate = levels ? !!level()?.passLevel : true;
          const since = levels ? elapsed() - levelStart : elapsed();
          if (gate && since >= target.value) window.setTimeout(() => finish(true), 0);
        }
      },
      onHeard: (e: StepEvent) => {
        const c = player.met?.config ?? cfg;
        const sub = effectiveSubdivision(c);
        ring.setCenter(String(Math.floor(e.step / sub) + 1));
        if (e.countIn) {
          ring.setLabel("預備");
          detail.setText("");
          return;
        }
        if (e.bar !== lastBar) {
          lastBar = e.bar;
          player.layout(c, hand(e.bar));
        }
        const cue = script.cue({ bar: e.bar, step: e.step, cfg: c, muted: e.muted, opts: item.opts, level: level() });
        ring.setLabel(cue.text, cue.kind ?? "");
        detail.setText(cue.detail ?? "");
        if (cue.meter !== undefined) {
          meter.show();
          meterFill.style.width = `${Math.round(Math.max(0.05, cue.meter) * 100)}%`;
        }
        info.setText([script.progress?.(e.bar, item.opts) ?? `第 ${e.bar + 1} 小節`, `${item.bpm} BPM`].join("｜"));
        if (target?.kind === "seconds") {
          const shown = levels ? (level()?.passLevel ? elapsed() - levelStart : elapsed()) : elapsed();
          timer.setText(levels && !level()?.passLevel ? fmt(shown) : `${fmt(shown)} / ${fmt(target.value)}`);
        } else timer.setText(fmt(elapsed()));
      },
    });
    try {
      await started;
    } catch (e) {
      new Notice((e as Error).message, 8000);
      timer.setText("聲音沒有啟動");
      this.stopAll();
      finished = true;
      const back = controls.createEl("button", { cls: "mod-cta rpd-wide", text: "回到說明，再試一次" });
      back.onclick = () => { this.reset(); this.render(); };
    }
  }

  // ---------- 3. 問結果 ----------

  private renderResult(root: HTMLElement): void {
    root.createEl("h2", { text: "練習結束" });
    for (const r of this.results) {
      const ex = exerciseById(r.id)!;
      const box = root.createDiv({ cls: "rpd-section" });
      box.createEl("h3", { text: `${ex.id} ${ex.name}` });
      box.createDiv({ cls: "rpd-desc", text: `${fmt(r.seconds)}｜${scriptFor(r.id)!.clicks ? `${r.bpm} BPM｜` : ""}${r.setting}${r.completed ? "｜已完成腳本" : ""}` });
      const pass = box.createDiv({ cls: "rpd-pass-box" });
      pass.createDiv({ cls: "rpd-label", text: "過關標準" });
      pass.createDiv({ text: ex.pass });
      const lv = scriptFor(r.id)!.levels;
      if (lv && !lv.find((l) => l.label === r.setting)?.passLevel) {
        pass.createDiv({ cls: "rpd-desc", text: `提醒：${ex.id} 只有「${lv.find((l) => l.passLevel)?.label}」那一級才算過關判定。` });
      }
      box.createDiv({ cls: "rpd-label", text: "達到過關標準了嗎？" });
      const row = box.createDiv({ cls: "rpd-choice" });
      const yes = row.createEl("button", { text: "達到" });
      const no = row.createEl("button", { text: "沒達到" });
      const sync = () => {
        yes.toggleClass("mod-cta", r.passed === true);
        no.toggleClass("mod-warning", r.passed === false);
      };
      yes.onclick = () => { r.passed = true; sync(); };
      no.onclick = () => { r.passed = false; sync(); };
      sync();
      new Setting(box).setName("哪裡出錯").setDesc("選填，一句話").addText((t) => t.setValue(r.droppedAt).onChange((v) => (r.droppedAt = v.trim())));
    }

    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const save = bottom.createEl("button", { cls: "mod-cta rpd-wide", text: this.results.length > 1 ? "儲存兩則記錄" : "儲存記錄" });
    save.onclick = () => void this.save();
    const discard = bottom.createEl("button", { cls: "rpd-wide rpd-secondary", text: "不記錄，回到說明" });
    discard.onclick = () => { this.reset(); this.render(); };
  }

  private async save(): Promise<void> {
    if (this.results.some((r) => r.passed === null)) {
      new Notice("請選「達到」或「沒達到」");
      return;
    }
    try {
      for (const r of this.results) {
        const now = new Date();
        const clicks = scriptFor(r.id)!.clicks;
        const f = await this.plugin.store.create(`${fileStamp(now)}-${r.id}`, {
          type: "practice-log",
          date: localIsoMinute(now),
          place: this.place,
          exercise: r.id,
          setting: r.setting,
          bpm: clicks ? r.bpm : "",
          passed: r.passed,
          duration_min: Math.max(1, Math.round(r.seconds / 60)),
          dropped_at: r.droppedAt,
        });
        this.saved.push(f.path);
      }
      await this.plugin.store.scan();
      this.phase = "saved";
      this.render();
    } catch (e) {
      new Notice(`建立失敗：${(e as Error).message}`);
    }
  }

  // ---------- 4. 結果 ----------

  private renderSaved(root: HTMLElement): void {
    const after = this.progress();
    const before = this.before;
    const game = this.plugin.settings.showGamification;
    root.createEl("h2", { text: this.saved.length > 1 ? "已記錄兩則" : "已記錄" });
    for (const r of this.results) {
      const ex = exerciseById(r.id) as Exercise;
      const ip = after.items[r.id];
      const box = root.createDiv({ cls: "rpd-section" });
      const row = box.createDiv({ cls: "rpd-ex-main" });
      row.createSpan({ cls: "rpd-label", text: `${ex.id} ${r.passed ? "達到" : "沒達到"}` });
      renderCells(row, ip);
      const newlyPassed = !!ip.passedAt && !before?.items[r.id].passedAt;
      if (r.passed && ip.cells >= PASS_STREAK) box.createDiv({ cls: "rpd-big", text: "這個練習過關了" });
      if (game && newlyPassed) box.createDiv({ cls: "rpd-desc", text: `取得徽章：${ex.id} ${ex.name}` });
      const s = suggestNext(ex, ip.records, ip.cells);
      if (s.note) box.createDiv({ cls: s.backtrack ? "rpd-warn-text" : "rpd-desc", text: s.bpm && !r.passed ? `${s.note}：下次 ${s.bpm} BPM` : s.note });
    }
    if (game && before) {
      if (after.level > before.level || (after.allDone && !before.allDone)) {
        root.createDiv({ cls: "rpd-section rpd-big", text: after.allDone ? "六期都已完成" : `升到等級 ${after.level}` });
      }
      for (const g of after.groupBadges) {
        if (!before.groupBadges.some((b) => b.id === g.id)) {
          root.createDiv({ cls: "rpd-section", text: `取得「項目完成」徽章：${GROUPS.find((x) => x.id === g.id)?.name}` });
        }
      }
    }
    root.createDiv({ cls: "rpd-desc", text: this.saved.join("、") });

    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const again = bottom.createEl("button", { cls: "mod-cta rpd-wide", text: "再練一次" });
    again.onclick = () => { this.reset(); this.render(); };
    const home = bottom.createEl("button", { cls: "rpd-wide rpd-secondary", text: "回今日頁" });
    home.onclick = () => this.goHome();
  }
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
