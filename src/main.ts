import { Plugin, WorkspaceLeaf, normalizePath } from "obsidian";
import { RecordStore } from "@rpd/learning-core";
import { DEFAULT_SETTINGS, RpdSettingTab, type RpdSettings } from "./settings";
import { SCHEMA, LOG_SUBFOLDER } from "./curriculum";
import { TodayView, TODAY_VIEW } from "./views/today";
import { NewRecordModal } from "./views/newRecord";

export default class RhythmPracticeDesk extends Plugin {
  settings: RpdSettings = { ...DEFAULT_SETTINGS };
  store!: RecordStore;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new RecordStore(this.app, () => this.logFolder(), SCHEMA);
    this.store.watch((ref) => this.registerEvent(ref));
    this.app.workspace.onLayoutReady(() => void this.store.scan());

    this.registerView(TODAY_VIEW, (leaf) => new TodayView(leaf, this));
    this.addRibbonIcon("drum", "節奏練習台：今日頁", () => void this.openToday());
    this.addCommand({ id: "open-today", name: "開啟今日頁", callback: () => void this.openToday() });
    this.addCommand({
      id: "new-record",
      name: "新增練習記錄",
      callback: () => new NewRecordModal(this.app, this.store, { place: "打擊墊", exercise: "", setting: "", bpm: null, durationMin: null }).open(),
    });
    this.addSettingTab(new RpdSettingTab(this.app, this));
  }

  logFolder(): string {
    return normalizePath(`${this.settings.folder}/${LOG_SUBFOLDER}`);
  }

  async openToday(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(TODAY_VIEW);
    let leaf: WorkspaceLeaf;
    if (existing.length > 0) leaf = existing[0];
    else {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: TODAY_VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.store?.scheduleScan(0);
  }
}
