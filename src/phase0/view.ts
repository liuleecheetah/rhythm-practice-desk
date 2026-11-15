import { ItemView, Notice, Platform, WorkspaceLeaf, apiVersion, normalizePath, TFolder } from "obsidian";
import { createNewNote, fileStamp, localIsoMinute } from "@rpd/learning-core";
import type RhythmPracticeDesk from "../main";
import { Report } from "./report";
import { section, button, verdictRow } from "./ui";
import { defineMetronomeItems, renderMetronomeTest } from "./metronomeTest";

export const PHASE0_VIEW = "rpd-phase0";

export class Phase0View extends ItemView {
  private report = new Report();
  private cleanups: (() => void)[] = [];
  private notes = "";

  constructor(leaf: WorkspaceLeaf, private plugin: RhythmPracticeDesk) {
    super(leaf);
  }

  getViewType(): string { return PHASE0_VIEW; }
  getDisplayText(): string { return "階段 0 測試"; }
  getIcon(): string { return "drum"; }

  async onOpen(): Promise<void> {
    const r = this.report;
    const platform = Platform.isIosApp ? "iOS App" : Platform.isAndroidApp ? "Android App"
      : Platform.isMacOS ? "macOS 桌機" : Platform.isDesktopApp ? "桌機" : "其他";
    r.env["平台"] = `${platform}${Platform.isMobile ? "（行動版介面）" : ""}`;
    r.env["Obsidian API 版本"] = apiVersion;
    r.env["外掛版本"] = this.plugin.manifest.version;
    r.env["設定資料夾"] = this.app.vault.configDir;
    r.env["頁面來源"] = window.location.origin;

    r.define("install.load", "安裝與同步", "外掛透過 BRAT 安裝並在這台裝置上開啟");
    r.define("install.sync", "安裝與同步", "在 iPhone 寫入的結果筆記，有同步出現在 Mac 上");
    r.setDetail("install.load", platform);
    defineMetronomeItems(r);

    const root = this.contentEl;
    root.empty();
    root.addClass("rpd-root");
    root.createEl("h2", { text: "節奏練習台：階段 0 測試" });
    root.createEl("p", {
      cls: "rpd-desc",
      text: "這一版只用來測試 iPhone 上能不能用，不會建立練習記錄。只有按「寫入結果筆記」時，才會在設定的資料夾裡建立一則筆記。",
    });

    const tabs = root.createDiv({ cls: "rpd-tabs" });
    const body = root.createDiv();
    const pages: Record<string, (el: HTMLElement) => void> = {
      "1 安裝": (el) => this.renderInstall(el),
      "2 節拍器": (el) => this.cleanups.push(renderMetronomeTest(el, r, () => this.plugin.settings.volume)),
      "3 結果": (el) => this.renderResults(el),
    };
    const show = (name: string) => {
      this.runCleanups();
      body.empty();
      tabs.querySelectorAll("button").forEach((b) => b.toggleClass("mod-cta", b.textContent === name));
      pages[name](body);
    };
    for (const name of Object.keys(pages)) button(tabs, name, () => show(name));
    show("1 安裝");
  }

  private renderInstall(el: HTMLElement): void {
    const s = section(el, "這台裝置");
    const ul = s.createEl("ul");
    for (const [k, v] of Object.entries(this.report.env)) ul.createEl("li", { text: `${k}：${v}` });

    const folder = normalizePath(this.plugin.settings.folder);
    const exists = this.app.vault.getAbstractFileByPath(folder) instanceof TFolder;
    s.createEl("p", { text: `筆記資料夾：${folder}（${exists ? "已存在" : "目前不存在，寫入時會建立"}）` });
    s.createEl("p", {
      cls: "rpd-desc",
      text: "如果資料夾顯示「不存在」，但你確定它在，請到外掛設定確認路徑（相對於 vault 根目錄）。",
    });

    const v = section(el, "你的判斷");
    verdictRow(v, this.report, "install.load");
    verdictRow(v, this.report, "install.sync");
    v.createEl("p", { cls: "rpd-desc", text: "第二項請在「3 結果」寫入筆記後，到 Mac 上確認。" });
  }

  private renderResults(el: HTMLElement): void {
    const s = section(el, "備註", "其他觀察，例如電腦和手機結果不同、聽起來哪裡怪。");
    const ta = s.createEl("textarea", { cls: "rpd-notes" });
    ta.value = this.notes;
    const pre = el.createEl("pre", { cls: "rpd-report" });
    const md = () => {
      const base = this.report.toMarkdown(localIsoMinute(new Date()));
      return this.notes.trim() ? `${base}\n## 備註\n\n${this.notes.trim()}\n` : base;
    };
    const refresh = () => pre.setText(md());
    ta.oninput = () => { this.notes = ta.value; refresh(); };
    refresh();
    this.cleanups.push(this.report.onChange(refresh));

    const row = el.createDiv({ cls: "rpd-row rpd-bottom" });
    button(row, "複製結果", async () => {
      await navigator.clipboard.writeText(md());
      new Notice("已複製");
    });
    button(row, "寫入結果筆記", async () => {
      try {
        const f = await createNewNote(this.app, this.plugin.settings.folder, `階段0測試結果-${fileStamp(new Date())}`, md());
        new Notice(`已建立 ${f.path}`);
      } catch (e) {
        new Notice(`寫入失敗：${(e as Error).message}`);
      }
    }, true);
  }

  private runCleanups(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  async onClose(): Promise<void> {
    this.runCleanups();
  }
}
