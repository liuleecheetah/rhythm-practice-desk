import { App, PluginSettingTab, Setting } from "obsidian";
import type RhythmPracticeDesk from "./main";

// data.json 只放設定，不放進度與記錄（規格第 2 節）。
export interface RpdSettings {
  /** 外掛建立筆記的資料夾（相對於 vault 根目錄） */
  folder: string;
  volume: number;
}

export const DEFAULT_SETTINGS: RpdSettings = {
  folder: "節奏練習台",
  volume: 0.8,
};

export class RpdSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: RhythmPracticeDesk) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("筆記資料夾")
      .setDesc("外掛只在這個資料夾內建立與修改檔案。路徑相對於 vault 根目錄。")
      .addText((t) =>
        t.setValue(this.plugin.settings.folder).onChange(async (v) => {
          this.plugin.settings.folder = v.trim();
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("節拍器音量")
      .addSlider((s) =>
        s.setLimits(0, 1, 0.05).setValue(this.plugin.settings.volume).setDynamicTooltip().onChange(async (v) => {
          this.plugin.settings.volume = v;
          await this.plugin.saveSettings();
        }),
      );
  }
}
