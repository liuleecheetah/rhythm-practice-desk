// 從 vault 讀取學習記錄。只讀不寫；frontmatter 讀不懂的筆記列出來，不修、不覆寫。

import { App, EventRef, TAbstractFile, TFile, normalizePath, stringifyYaml } from "obsidian";
import { parseRecord, type LearningRecord, type RecordSchema } from "../core/records";
import { createNewNote } from "./notes";

export interface Unreadable {
  path: string;
  reason: string;
}

export interface StoreSnapshot {
  records: LearningRecord[];
  unreadable: Unreadable[];
}

export class RecordStore {
  snapshot: StoreSnapshot = { records: [], unreadable: [] };
  private listeners = new Set<(s: StoreSnapshot) => void>();
  private timer: number | null = null;

  constructor(
    private app: App,
    /** 記錄資料夾（相對於 vault 根目錄） */
    private getFolder: () => string,
    private schema: RecordSchema,
  ) {}

  /** 註冊 vault 事件。register 傳入 Plugin.registerEvent，外掛停用時自動解除。 */
  watch(register: (ref: EventRef) => void): void {
    const touch = (f: TAbstractFile, oldPath?: string) => {
      if (this.inFolder(f.path) || (oldPath && this.inFolder(oldPath))) this.scheduleScan();
    };
    register(this.app.metadataCache.on("changed", (f) => touch(f)));
    register(this.app.vault.on("create", (f) => touch(f)));
    register(this.app.vault.on("modify", (f) => touch(f)));
    register(this.app.vault.on("delete", (f) => touch(f)));
    register(this.app.vault.on("rename", (f, oldPath) => touch(f, oldPath)));
  }

  onChange(fn: (s: StoreSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  folderPath(): string {
    return normalizePath(this.getFolder());
  }

  inFolder(path: string): boolean {
    const folder = this.folderPath();
    return path.startsWith(folder + "/") && path.endsWith(".md");
  }

  scheduleScan(delayMs = 250): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.scan();
    }, delayMs);
  }

  async scan(): Promise<StoreSnapshot> {
    const records: LearningRecord[] = [];
    const unreadable: Unreadable[] = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!this.inFolder(f.path)) continue;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (fm) {
        const r = parseRecord(f.path, { ...fm }, this.schema);
        if (!r) continue; // 不是這種記錄
        if (r.ok) records.push(r.record);
        else unreadable.push({ path: r.path, reason: r.reason });
      } else {
        const head = (await this.app.vault.cachedRead(f)).slice(0, 4);
        unreadable.push({ path: f.path, reason: head.startsWith("---") ? "frontmatter 的 YAML 格式讀不懂" : "沒有 frontmatter" });
      }
    }
    this.snapshot = { records, unreadable };
    this.listeners.forEach((fn) => fn(this.snapshot));
    return this.snapshot;
  }

  /** 建立新記錄：只寫 frontmatter 與一行空白，內文留給使用者。檔名重複時加序號，不覆寫。 */
  async create(baseName: string, frontmatter: Record<string, unknown>): Promise<TFile> {
    const content = `---\n${stringifyYaml(frontmatter)}---\n\n`;
    return createNewNote(this.app, this.folderPath(), baseName, content);
  }
}
