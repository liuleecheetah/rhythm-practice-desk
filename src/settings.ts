import { App, PluginSettingTab, Setting } from "obsidian";
import type RhythmPracticeDesk from "./main";

// data.json 只放設定，不放進度與記錄（規格第 2 節）。
export interface RpdSettings {
  /** 外掛建立筆記的資料夾（相對於 vault 根目錄） */
  folder: string;
  /** COURSE.md 的路徑；空白時用「筆記資料夾/COURSE.md」 */
  coursePath: string;
  volume: number;
  /** 顯示等級、徽章與每週目標（COURSE.md：連續 4 週練習次數沒有增加就關閉） */
  showGamification: boolean;
}

export const DEFAULT_SETTINGS: RpdSettings = {
  folder: "節奏練習台",
  coursePath: "",
  volume: 0.8,
  showGamification: true,
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
      .setDesc("外掛只在這個資料夾內建立檔案。練習記錄放在其中的「練習日誌」子資料夾。路徑相對於 vault 根目錄。")
      .addText((t) =>
        t.setValue(this.plugin.settings.folder).onChange(async (v) => {
          this.plugin.settings.folder = v.trim();
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("課程檔 COURSE.md")
      .setDesc("練習說明頁從這個檔案顯示做法與檢查方法。空白時使用「筆記資料夾/COURSE.md」。")
      .addText((t) =>
        t.setPlaceholder(`${this.plugin.settings.folder}/COURSE.md`).setValue(this.plugin.settings.coursePath).onChange(async (v) => {
          this.plugin.settings.coursePath = v.trim();
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("顯示等級與徽章")
      .setDesc("關閉後只保留過關標準、進度格與練習記錄（等級、徽章、每週目標都不顯示）。可以到「成效」頁看最近 8 週的練習次數再決定。")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showGamification).onChange(async (v) => {
          this.plugin.settings.showGamification = v;
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
