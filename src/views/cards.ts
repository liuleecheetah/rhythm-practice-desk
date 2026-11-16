// 教材卡（節奏卡）：清單 → 單張卡片（鼓譜、變形、影片與段落）。
// 外掛只讀 vault 裡 type: rhythm-card 的筆記；只有在使用者新增或刪除段落、加影片時，
// 才用 processFrontMatter 改那一張卡片的 videos 欄位，其他欄位與內文都不動。

import { App, ItemView, Modal, Notice, Setting, TFile, ViewStateResult, WorkspaceLeaf, normalizePath } from "obsidian";
import { createNewNote, extractVideoId, formatTime, parseMaterialCard, parseTime, youtubeWatchUrl, type MaterialCard } from "@rpd/learning-core";
import { parseNotation, type Notation } from "@rpd/rhythm";
import type RhythmPracticeDesk from "../main";
import { backBar, trackBottomOffset } from "./layout";

export const CARDS_VIEW = "rpd-cards";
export const CARD_TYPE = "rhythm-card";
export const CARD_EVIDENCE = ["可查依據", "轉述", "推論重建"] as const;
const NS = "http://www.w3.org/2000/svg";

interface CardEntry {
  file: TFile;
  fm: Record<string, unknown>;
  card: MaterialCard;
}

export function listCards(app: App): CardEntry[] {
  const out: CardEntry[] = [];
  for (const f of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(f)?.frontmatter;
    if (fm?.type !== CARD_TYPE) continue;
    out.push({ file: f, fm: { ...fm }, card: parseMaterialCard(fm, CARD_EVIDENCE) });
  }
  return out.sort((a, b) => (a.card.title || a.file.basename).localeCompare(b.card.title || b.file.basename, "zh-Hant"));
}

export class CardsView extends ItemView {
  private path: string | null = null;
  private untrack: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: RhythmPracticeDesk) {
    super(leaf);
  }

  getViewType(): string { return CARDS_VIEW; }
  getDisplayText(): string { return "節奏卡"; }
  getIcon(): string { return "music"; }

  getState(): Record<string, unknown> {
    return { path: this.path };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    this.path = (state as { path?: string | null })?.path ?? null;
    await super.setState(state, result);
    this.render();
  }

  async onOpen(): Promise<void> {
    this.untrack = trackBottomOffset(this.contentEl);
    // 卡片在別處被修改（例如手改 YAML）時重畫
    this.registerEvent(this.app.metadataCache.on("changed", (f) => {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (f.path === this.path || (!this.path && fm?.type === CARD_TYPE)) this.render();
    }));
    this.render();
  }

  async onClose(): Promise<void> {
    this.untrack?.();
  }

  private show(path: string | null): void {
    this.path = path;
    this.render();
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("rpd-root");
    if (!this.path) this.renderList(root);
    else this.renderCard(root);
  }

  // ---------- 清單 ----------

  private renderList(root: HTMLElement): void {
    backBar(root, () => void this.plugin.openToday());
    root.createEl("h2", { text: "節奏卡" });
    root.createDiv({ cls: "rpd-desc", text: "vault 裡所有 type: rhythm-card 的筆記。外掛不內建任何傳統節奏的譜例或影片，內容都由你自己建立。" });
    const cards = listCards(this.app);
    if (!cards.length) root.createDiv({ cls: "rpd-section", text: "還沒有節奏卡。按下方「新增節奏卡」建立第一張。" });
    const list = root.createDiv({ cls: "rpd-section" });
    for (const c of cards) {
      const row = list.createDiv({ cls: "rpd-row-link" });
      row.createDiv({ text: c.card.title || c.file.basename });
      const sub = [String(c.fm.tradition ?? ""), c.card.evidence, `${c.card.videos.length} 部影片`].filter(Boolean);
      if (c.card.warnings.length) sub.push(`${c.card.warnings.length} 個警告`);
      row.createDiv({ cls: c.card.warnings.length ? "rpd-desc rpd-warn-text" : "rpd-desc", text: sub.join("｜") });
      row.onclick = () => this.show(c.file.path);
    }
    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const add = bottom.createEl("button", { cls: "mod-cta rpd-wide", text: "新增節奏卡" });
    add.onclick = () => new NewCardModal(this.app, this.plugin, (f) => this.show(f.path)).open();
  }

  // ---------- 單張卡片 ----------

  private renderCard(root: HTMLElement): void {
    backBar(root, () => this.show(null), "節奏卡清單");
    const f = this.app.vault.getAbstractFileByPath(this.path!);
    const fm = f instanceof TFile ? this.app.metadataCache.getFileCache(f)?.frontmatter : null;
    if (!(f instanceof TFile) || !fm || fm.type !== CARD_TYPE) {
      root.createDiv({ cls: "rpd-section rpd-warn", text: "找不到這張卡片，或它的 frontmatter 讀不懂（type 必須是 rhythm-card）。" });
      return;
    }
    const card = parseMaterialCard(fm, CARD_EVIDENCE);
    const head = root.createDiv({ cls: "rpd-section" });
    head.createEl("h2", { text: card.title || f.basename });
    const tags = head.createDiv({ cls: "rpd-tags" });
    if (card.evidence) tags.createSpan({ cls: "rpd-tag", text: card.evidence });
    if (fm.tradition) tags.createSpan({ cls: "rpd-tag", text: String(fm.tradition) });
    for (const s of Array.isArray(fm.structure) ? fm.structure : []) tags.createSpan({ cls: "rpd-tag", text: String(s) });
    head.createDiv({ cls: "rpd-desc", text: card.source ? `出處：${card.source}` : "出處：（空白）" });
    const open = head.createEl("button", { text: "打開筆記（文化脈絡、演奏說明）" });
    open.onclick = () => void this.app.workspace.getLeaf(false).openFile(f);

    // 鼓譜
    const main = parseNotation(fm, "基本型");
    const notationErrors: string[] = [];
    if (main) {
      const sec = root.createDiv({ cls: "rpd-section" });
      sec.createEl("h3", { text: "基本型" });
      if (main.errors.length) sec.createDiv({ cls: "rpd-desc rpd-warn-text", text: "鼓譜格式有錯，先不畫出來；原因見下方警告。" });
      else drawNotation(sec, main);
      notationErrors.push(...main.errors);
    }
    const variations = Array.isArray(fm.variations) ? fm.variations : [];
    variations.forEach((v: Record<string, unknown>, i: number) => {
      const label = String(v?.label ?? `變形 ${i + 1}`);
      const sec = root.createDiv({ cls: "rpd-section" });
      sec.createEl("h3", { text: `變形：${label}` });
      const t = sec.createDiv({ cls: "rpd-tags" });
      if (v?.evidence) t.createSpan({ cls: "rpd-tag", text: String(v.evidence) });
      else notationErrors.push(`變形「${label}」沒有標依據分級`);
      if (v?.evidence && !(CARD_EVIDENCE as readonly string[]).includes(String(v.evidence))) notationErrors.push(`變形「${label}」的依據分級「${v.evidence}」不是 ${CARD_EVIDENCE.join("｜")} 其中之一`);
      sec.createDiv({ cls: "rpd-desc", text: v?.source ? `出處：${v.source}` : "出處：（空白）" });
      const n = parseNotation({ ...fm, ...(v?.groups ? { groups: v.groups } : {}), pattern: v?.pattern }, `變形「${label}」`);
      if (n) {
        if (n.errors.length) sec.createDiv({ cls: "rpd-desc rpd-warn-text", text: "鼓譜格式有錯，先不畫出來；原因見下方警告。" });
        else drawNotation(sec, n);
        notationErrors.push(...n.errors);
      }
    });
    if (!main && !variations.length) root.createDiv({ cls: "rpd-desc", text: "這張卡還沒有鼓譜（pattern）。格式見 docs/資料格式.md 第 4 節。" });

    // 警告
    const warnings = [...card.warnings, ...notationErrors];
    if (warnings.length) {
      const w = root.createDiv({ cls: "rpd-section rpd-warn" });
      w.createEl("h3", { text: `${warnings.length} 個警告` });
      w.createDiv({ cls: "rpd-desc", text: "卡片照樣可以使用；請打開筆記修正 frontmatter。格式錯誤的鼓譜不會畫出來。" });
      const ul = w.createEl("ul");
      for (const x of warnings) ul.createEl("li", { text: x });
    }

    // 影片與段落
    const vs = root.createDiv({ cls: "rpd-section" });
    vs.createEl("h3", { text: "範例影片" });
    vs.createDiv({ cls: "rpd-desc", text: "按段落會從起點在 YouTube 開啟。目前不內嵌播放，所以沒有循環與變速。" });
    card.videos.forEach((v, vi) => {
      const box = vs.createDiv({ cls: "rpd-video" });
      const top = box.createDiv({ cls: "rpd-ex-main" });
      top.createSpan({ cls: "rpd-label", text: v.label });
      if (v.id) {
        const a = box.createEl("a", { text: "從頭開啟", href: youtubeWatchUrl(v.id) });
        a.setAttr("target", "_blank");
      }
      for (const [si, s] of v.segments.entries()) {
        const row = box.createDiv({ cls: "rpd-seg" });
        const txt = `${s.label}　${formatTime(s.start)}${s.end !== null ? `–${formatTime(s.end)}` : ""}${s.rate ? `（${s.rate} 倍）` : ""}`;
        if (v.id) {
          const a = row.createEl("a", { text: txt, href: youtubeWatchUrl(v.id, s.start) });
          a.setAttr("target", "_blank");
        } else row.createSpan({ text: txt });
        const del = row.createEl("button", { cls: "rpd-small", text: "刪除" });
        let armed = false;
        del.onclick = async () => {
          if (!armed) {
            armed = true;
            del.setText("再按一次確認刪除");
            return;
          }
          await this.editVideos(f, (videos) => {
            const segs = (videos[vi].segments as unknown[]) ?? [];
            segs.splice(si, 1);
            videos[vi].segments = segs;
          });
        };
      }
      this.segmentForm(box, f, vi);
    });
    this.videoForm(vs, f);
  }

  private segmentForm(parent: HTMLElement, f: TFile, vi: number): void {
    const d = parent.createEl("details", { cls: "rpd-form" });
    d.createEl("summary", { text: "新增段落" });
    let label = "", start = "", end = "", rate = "";
    new Setting(d).setName("名稱").addText((t) => t.setPlaceholder("基本型").onChange((v) => (label = v.trim())));
    new Setting(d).setName("起點").setDesc("例如 1:23 或 83（秒）").addText((t) => t.setPlaceholder("1:23").onChange((v) => (start = v)));
    new Setting(d).setName("終點").setDesc("選填").addText((t) => t.setPlaceholder("1:41").onChange((v) => (end = v)));
    new Setting(d).setName("速度").setDesc("選填，0.5／0.75／1；保留給日後的內嵌播放器").addDropdown((dd) => {
      dd.addOption("", "（不指定）").addOption("0.5", "0.5").addOption("0.75", "0.75").addOption("1", "1");
      dd.onChange((v) => (rate = v));
    });
    const save = d.createEl("button", { cls: "mod-cta", text: "加入段落" });
    save.onclick = async () => {
      const s = parseTime(start);
      const e = end.trim() ? parseTime(end) : null;
      if (s === null) return void new Notice("起點讀不懂，請寫成 1:23 或 83");
      if (end.trim() && (e === null || e <= s)) return void new Notice("終點讀不懂，或早於起點");
      await this.editVideos(f, (videos) => {
        const segs = Array.isArray(videos[vi].segments) ? (videos[vi].segments as unknown[]) : [];
        const seg: Record<string, unknown> = { label: label || `段落 ${segs.length + 1}`, start: s };
        if (e !== null) seg.end = e;
        if (rate) seg.rate = Number(rate);
        segs.push(seg);
        videos[vi].segments = segs;
      });
    };
  }

  private videoForm(parent: HTMLElement, f: TFile): void {
    const d = parent.createEl("details", { cls: "rpd-form" });
    d.createEl("summary", { text: "加一部影片" });
    let url = "", label = "";
    new Setting(d).setName("YouTube 網址").addText((t) => t.setPlaceholder("https://www.youtube.com/watch?v=…").onChange((v) => (url = v.trim())));
    new Setting(d).setName("名稱").addText((t) => t.setPlaceholder("範例演奏").onChange((v) => (label = v.trim())));
    const save = d.createEl("button", { cls: "mod-cta", text: "加入影片" });
    save.onclick = async () => {
      if (!extractVideoId(url)) return void new Notice("讀不出 YouTube 影片 ID，請貼完整網址");
      await this.editVideos(f, (videos) => {
        videos.push({ url, label: label || `影片 ${videos.length + 1}`, segments: [] });
      });
    };
  }

  /** 只改 videos 欄位 */
  private async editVideos(f: TFile, edit: (videos: Record<string, unknown>[]) => void): Promise<void> {
    try {
      await this.app.fileManager.processFrontMatter(f, (fm: Record<string, unknown>) => {
        const videos = Array.isArray(fm.videos) ? (fm.videos as Record<string, unknown>[]).map((v) => (v && typeof v === "object" ? v : { url: String(v) })) : [];
        edit(videos);
        fm.videos = videos;
      });
      new Notice("已寫入卡片");
    } catch (e) {
      new Notice(`寫入失敗：${(e as Error).message}`);
    }
  }
}

/** 鼓譜：環形（每軌一圈）＋格子 */
export function drawNotation(parent: HTMLElement, n: Notation): void {
  const wrap = parent.createDiv({ cls: "rpd-notation" });
  // 環形
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.classList.add("rpd-nring");
  const starts = new Set<number>();
  let acc = 0;
  for (const g of n.groups) { starts.add(acc); acc += g; }
  n.tracks.forEach((t, ti) => {
    const r = 84 - ti * 18;
    if (r < 20) return;
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "100"); c.setAttribute("cy", "100"); c.setAttribute("r", String(r));
    c.setAttribute("class", "rpd-ring-track");
    svg.appendChild(c);
    t.cells.forEach((cell, i) => {
      const a = (i / n.total) * 2 * Math.PI - Math.PI / 2;
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", String(100 + r * Math.cos(a)));
      dot.setAttribute("cy", String(100 + r * Math.sin(a)));
      dot.setAttribute("r", cell ? (cell.accent ? "6" : "4") : "2");
      dot.setAttribute("class", `rpd-ndot${cell ? (cell.accent ? " is-accent" : " is-light") : ""}${starts.has(i) ? " is-start" : ""}`);
      svg.appendChild(dot);
    });
  });
  wrap.appendChild(svg);

  // 格子
  const grid = wrap.createDiv({ cls: "rpd-grid" });
  for (const t of n.tracks) {
    const row = grid.createDiv({ cls: "rpd-grid-row" });
    row.createDiv({ cls: "rpd-grid-label", text: t.label });
    const cells = row.createDiv({ cls: "rpd-grid-cells" });
    t.cells.forEach((cell, i) => {
      const el = cells.createDiv({ cls: `rpd-gcell${cell ? (cell.accent ? " is-accent" : " is-light") : ""}${starts.has(i) ? " is-start" : ""}`, text: cell ? (cell.accent ? cell.voice : cell.voice.toLowerCase()) : "·" });
      if (cell) el.setAttr("title", cell.name);
    });
  }
  const names = new Map<string, string>();
  for (const t of n.tracks) for (const c of t.cells) if (c) names.set(c.voice, c.name);
  wrap.createDiv({ cls: "rpd-desc", text: `${n.meter}｜每拍 ${n.subdivision} 格｜共 ${n.total} 格${n.groups.some((g) => g !== n.subdivision) ? `｜分組 ${n.groups.join("+")}` : ""}｜${[...names].map(([k, v]) => `${k}＝${v}`).join("、")}；大寫＝重音或骨架音，小寫＝輕音或裝飾音` });
}

/** 新增節奏卡：只建立新檔案。frontmatter 不放註解（processFrontMatter 寫回時會移除註解）。 */
class NewCardModal extends Modal {
  private title = "";
  constructor(app: App, private plugin: RhythmPracticeDesk, private onDone: (f: TFile) => void) {
    super(app);
  }
  onOpen(): void {
    this.setTitle("新增節奏卡");
    new Setting(this.contentEl).setName("名稱").addText((t) => t.onChange((v) => (this.title = v.trim())));
    this.contentEl.createDiv({ cls: "rpd-desc", text: `建在：${this.plugin.cardFolder()}` });
    const go = this.contentEl.createEl("button", { cls: "mod-cta rpd-wide", text: "建立" });
    go.onclick = async () => {
      if (!this.title) return void new Notice("請填名稱");
      const fm = [
        "---",
        "type: rhythm-card",
        `title: ${JSON.stringify(this.title)}`,
        'source: ""',
        "evidence: 推論重建",
        'tradition: ""',
        "structure: []",
        "meter: 4/4",
        "subdivision: 4",
        "groups: []",
        "voices:",
        "  D: Dum",
        "  T: Tak",
        "pattern:",
        "  - track: 皮",
        '    hits: "D... T... D... T..."',
        "variations: []",
        "videos: []",
        "---",
        "",
        "## 文化脈絡",
        "",
        "（用在什麼場合、什麼曲式、哪些樂器。每一段結尾標依據分級，例如〔可查依據：出處〕〔轉述：出處〕〔推論重建〕。）",
        "",
        "## 演奏說明",
        "",
        "## 依據說明",
        "",
        "## 欄位說明",
        "",
        "- source：出處，必填。evidence：可查依據｜轉述｜推論重建。",
        "- hits：一個字元一格；「.」休止；大寫＝重音或骨架音，小寫＝輕音或裝飾音；空白與 | 只用來分隔。",
        "- 每一軌的格數＝拍號分子 × subdivision（有 groups 時＝groups 的總和）。",
        "- 鼓譜範例是預留的格子，請換成你查到的內容，並更新 evidence。",
        "",
      ].join("\n");
      try {
        const safe = this.title.replace(/[\\/:*?"<>|#^[\]]/g, " ").trim();
        const f = await createNewNote(this.app, this.plugin.cardFolder(), safe, fm);
        this.close();
        this.onDone(f);
      } catch (e) {
        new Notice(`建立失敗：${(e as Error).message}`);
      }
    };
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

export function cardFolderPath(folder: string, cardFolder: string): string {
  return normalizePath(cardFolder || `${folder}/節奏卡`);
}
