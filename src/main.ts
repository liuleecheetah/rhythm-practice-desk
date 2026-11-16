import { Plugin, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import { RecordStore } from "@rpd/learning-core";
import { DEFAULT_SETTINGS, RpdSettingTab, type RpdSettings } from "./settings";
import { SCHEMA, LOG_SUBFOLDER } from "./curriculum";
import { TodayView, TODAY_VIEW } from "./views/today";
import { NewRecordModal } from "./views/newRecord";
import { RunnerView, RUNNER_VIEW } from "./views/runner";
import { MetronomeView, METRONOME_VIEW } from "./views/metronomeView";
import { AudioHost } from "./audio";
import { BadgesView, BADGES_VIEW } from "./views/badges";
import { StatsView, STATS_VIEW } from "./views/stats";
import type { RunnerState } from "./views/runner";

export default class RhythmPracticeDesk extends Plugin {
  settings: RpdSettings = { ...DEFAULT_SETTINGS };
  store!: RecordStore;
  audio = new AudioHost();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new RecordStore(this.app, () => this.logFolder(), SCHEMA);
    this.store.watch((ref) => this.registerEvent(ref));
    this.app.workspace.onLayoutReady(() => void this.store.scan());

    this.registerView(TODAY_VIEW, (leaf) => new TodayView(leaf, this));
    this.registerView(RUNNER_VIEW, (leaf) => new RunnerView(leaf, this));
    this.registerView(METRONOME_VIEW, (leaf) => new MetronomeView(leaf, this));
    this.registerView(BADGES_VIEW, (leaf) => new BadgesView(leaf, this));
    this.registerView(STATS_VIEW, (leaf) => new StatsView(leaf, this));
    this.addRibbonIcon("drum", "節奏練習台：今日頁", () => void this.openToday());
    this.addCommand({ id: "open-today", name: "開啟今日頁", callback: () => void this.openToday() });
    this.addCommand({
      id: "new-record",
      name: "新增練習記錄",
      callback: () => new NewRecordModal(this.app, this.store, { place: "打擊墊", exercise: "", setting: "", bpm: null, durationMin: null }).open(),
    });
    this.addCommand({ id: "open-metronome", name: "開啟節拍器", callback: () => void this.openView(METRONOME_VIEW) });
    this.addCommand({ id: "open-badges", name: "開啟徽章頁", callback: () => void this.openView(BADGES_VIEW) });
    this.addCommand({ id: "open-stats", name: "開啟成效頁", callback: () => void this.openView(STATS_VIEW) });
    this.addSettingTab(new RpdSettingTab(this.app, this));
  }

  onunload(): void {
    this.audio.dispose();
  }

  coursePath(): string {
    return normalizePath(this.settings.coursePath || `${this.settings.folder}/COURSE.md`);
  }

  async readCourse(): Promise<string | null> {
    const f = this.app.vault.getAbstractFileByPath(this.coursePath());
    return f instanceof TFile ? this.app.vault.cachedRead(f) : null;
  }

  async openRunner(exercise: string, extra: Omit<RunnerState, "exercise"> = {}): Promise<void> {
    await this.openView(RUNNER_VIEW, { exercise, ...extra });
  }

  logFolder(): string {
    return normalizePath(`${this.settings.folder}/${LOG_SUBFOLDER}`);
  }

  async openToday(): Promise<void> {
    await this.openView(TODAY_VIEW);
  }

  /** 同一種畫面只開一個分頁；已經開著就切過去。 */
  async openView(type: string, state?: Record<string, unknown>): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(type);
    let leaf: WorkspaceLeaf;
    if (existing.length > 0) {
      leaf = existing[0];
      if (state) await leaf.setViewState({ type, active: true, state });
    } else {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type, active: true, state });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // 重新掃描會通知所有畫面重畫（例如關閉「顯示等級與徽章」後）
    this.store?.scheduleScan(0);
  }
}
