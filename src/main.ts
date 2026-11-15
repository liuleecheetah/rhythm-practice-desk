import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, RpdSettingTab, type RpdSettings } from "./settings";
import { Phase0View, PHASE0_VIEW } from "./phase0/view";

export default class RhythmPracticeDesk extends Plugin {
  settings: RpdSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerView(PHASE0_VIEW, (leaf) => new Phase0View(leaf, this));
    this.addRibbonIcon("drum", "節奏練習台：階段 0 測試", () => this.openPhase0());
    this.addCommand({ id: "open-phase0", name: "開啟階段 0 測試", callback: () => this.openPhase0() });
    this.addSettingTab(new RpdSettingTab(this.app, this));
  }

  async openPhase0(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(PHASE0_VIEW);
    let leaf: WorkspaceLeaf;
    if (existing.length > 0) leaf = existing[0];
    else {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: PHASE0_VIEW, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
