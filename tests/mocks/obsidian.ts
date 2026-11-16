// 測試用的最小 Obsidian 替身：記憶體裡的 vault 與 metadataCache。
import { parse, stringify } from "yaml";

export class TAbstractFile { constructor(public path: string) {} }
export class TFile extends TAbstractFile {
  get basename() { return this.path.split("/").pop()!.replace(/\.md$/, ""); }
  get extension() { return "md"; }
}
export class TFolder extends TAbstractFile {}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}
export function stringifyYaml(o: unknown): string { return stringify(o); }

export class MockApp {
  files = new Map<string, string>();
  folders = new Set<string>();
  vault = {
    getAbstractFileByPath: (p: string) =>
      this.files.has(p) ? new TFile(p) : this.folders.has(p) ? new TFolder(p) : null,
    createFolder: async (p: string) => { this.folders.add(p); },
    create: async (p: string, c: string) => {
      if (this.files.has(p)) throw new Error("exists");
      this.files.set(p, c);
      return new TFile(p);
    },
    getMarkdownFiles: () => [...this.files.keys()].filter((p) => p.endsWith(".md")).map((p) => new TFile(p)),
    cachedRead: async (f: TFile) => this.files.get(f.path) ?? "",
    on: () => ({}),
  };
  metadataCache = {
    getFileCache: (f: TFile) => {
      const c = this.files.get(f.path) ?? "";
      const m = c.match(/^---\n([\s\S]*?)\n?---/);
      if (!m) return {};
      try {
        const fm = parse(m[1]);
        return fm && typeof fm === "object" ? { frontmatter: fm } : {};
      } catch {
        return {}; // 跟 Obsidian 一樣：YAML 壞掉時沒有 frontmatter
      }
    },
    on: () => ({}),
  };
}
export type App = MockApp;
export type EventRef = object;
