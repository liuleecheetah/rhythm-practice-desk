// 鼓譜編輯器：手機上 Obsidian 的屬性面板不能改巢狀欄位（pattern、variations），所以在卡片上提供表單。
// 每一軌：軌名、樂器預設、音名、鼓譜文字；預覽格子可以點，每點一下換到下一個音。

import { Notice, Setting } from "obsidian";
import { INSTRUMENT_PRESETS, cleanHits, cycleCell, formatHits, parseNotation, type Notation } from "@rpd/rhythm";

export interface DraftTrack {
  track: string;
  voices: [string, string][];
  /** 去掉空白與 | 的鼓譜 */
  hits: string;
}

export interface Draft {
  meter: string;
  subdivision: number | null;
  /** 例如 "2+2+3"；空白＝不分組 */
  groups: string;
  tracks: DraftTrack[];
  /** 變形才有 */
  variation?: { label: string; evidence: string; source: string };
}

export const METER_CHOICES = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8"];
export const SUBDIVISION_CHOICES: [number, string][] = [[1, "每拍 1 格"], [2, "每拍 2 格（八分）"], [3, "每拍 3 格（三連音）"], [4, "每拍 4 格（十六分）"], [6, "每拍 6 格"]];

export function parseGroups(s: string): number[] | null {
  const t = s.trim();
  if (!t) return [];
  const parts = t.split(/[+,\s]+/).filter(Boolean).map(Number);
  return parts.every((n) => Number.isInteger(n) && n > 0) ? parts : null;
}

export function draftToInput(d: Draft): Record<string, unknown> {
  const groups = parseGroups(d.groups) ?? [];
  return {
    meter: d.meter,
    subdivision: d.subdivision ?? 1,
    groups,
    pattern: d.tracks.map((t) => ({ track: t.track, voices: Object.fromEntries(t.voices.filter(([k]) => k)), hits: t.hits })),
  };
}

/** 寫回 frontmatter 用的 pattern（鼓譜依分組加空白，方便閱讀） */
export function draftPattern(d: Draft, n: Notation | null): Record<string, unknown>[] {
  const groups = n?.groups ?? [];
  return d.tracks.map((t) => ({
    track: t.track,
    voices: Object.fromEntries(t.voices.filter(([k, v]) => k && v).map(([k, v]) => [k.toUpperCase(), v])),
    hits: formatHits(t.hits, groups),
  }));
}

export function draftFromFm(fm: Record<string, unknown>, pattern: unknown, variation?: Record<string, unknown>): Draft {
  const cardVoices = fm.voices && typeof fm.voices === "object" ? (fm.voices as Record<string, unknown>) : {};
  const tracks = (Array.isArray(pattern) ? pattern : []).map((t: Record<string, unknown>) => {
    const own = t?.voices && typeof t.voices === "object" ? (t.voices as Record<string, unknown>) : {};
    const voices = Object.entries({ ...cardVoices, ...own }).map(([k, v]) => [k, String(v)] as [string, string]);
    return { track: String(t?.track ?? ""), voices, hits: cleanHits(String(t?.hits ?? "")) };
  });
  const sub = Number(fm.subdivision);
  return {
    meter: typeof fm.meter === "string" ? fm.meter : "",
    subdivision: Number.isInteger(sub) && sub > 0 ? sub : null,
    groups: Array.isArray(fm.groups) ? fm.groups.join("+") : "",
    tracks: tracks.length ? tracks : [{ track: "", voices: [], hits: "" }],
    variation: variation ? { label: String(variation.label ?? ""), evidence: String(variation.evidence ?? ""), source: String(variation.source ?? "") } : undefined,
  };
}

export interface EditorOptions {
  /** 變形共用卡片的拍號與分組，只能改軌 */
  isVariation: boolean;
  evidenceLevels: readonly string[];
  onSave: (d: Draft, n: Notation | null) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

export function renderEditor(parent: HTMLElement, d: Draft, o: EditorOptions): void {
  const box = parent.createDiv({ cls: "rpd-editor" });
  const errBox = box.createDiv();
  const previews: (() => void)[] = [];
  const parse = () => parseNotation(draftToInput(d), d.variation?.label || "基本型");
  const refresh = () => {
    const n = parse();
    errBox.empty();
    const errs = [...(n?.errors ?? [])];
    if (!d.meter) errs.unshift("請選擇拍號");
    if (d.subdivision === null) errs.unshift("請選擇每拍幾格");
    if (parseGroups(d.groups) === null) errs.push("分組請寫成用 + 分隔的正整數");
    if (errs.length) {
      const ul = errBox.createEl("ul", { cls: "rpd-warn-text" });
      for (const e of errs) ul.createEl("li", { text: e });
    }
    previews.forEach((f) => f());
  };

  if (d.variation) {
    const v = d.variation;
    new Setting(box).setName("變形名稱").addText((t) => t.setPlaceholder("填入名稱").setValue(v.label).onChange((x) => { v.label = x.trim(); }));
    new Setting(box).setName("依據分級").addDropdown((dd) => {
      dd.addOption("", "請選擇");
      for (const e of o.evidenceLevels) dd.addOption(e, e);
      dd.setValue(v.evidence).onChange((x) => (v.evidence = x));
    });
    new Setting(box).setName("出處").addText((t) => t.setPlaceholder("填入出處").setValue(v.source).onChange((x) => (v.source = x.trim())));
  }

  if (!o.isVariation) {
    new Setting(box).setName("拍號").addDropdown((dd) => {
      dd.addOption("", "請選擇");
      for (const m of METER_CHOICES) dd.addOption(m, m);
      if (d.meter && !METER_CHOICES.includes(d.meter)) dd.addOption(d.meter, d.meter);
      dd.setValue(d.meter).onChange((x) => { d.meter = x; refresh(); });
    });
    new Setting(box).setName("每拍幾格").addDropdown((dd) => {
      dd.addOption("", "請選擇");
      for (const [n, l] of SUBDIVISION_CHOICES) dd.addOption(String(n), l);
      dd.setValue(d.subdivision ? String(d.subdivision) : "").onChange((x) => { d.subdivision = x ? Number(x) : null; refresh(); });
    });
    new Setting(box).setName("分組").setDesc("選填。加法拍子用，以格為單位、用 + 分隔；填了之後總格數＝分組的總和").addText((t) =>
      t.setPlaceholder("填入分組").setValue(d.groups).onChange((x) => { d.groups = x; refresh(); }),
    );
  } else {
    box.createDiv({ cls: "rpd-desc", text: `拍號與分組沿用基本型：${d.meter || "（未設定）"}${d.subdivision ? `，每拍 ${d.subdivision} 格` : ""}${d.groups ? `，分組 ${d.groups}` : ""}` });
  }

  const tracksEl = box.createDiv();
  const renderTracks = () => {
    tracksEl.empty();
    previews.length = 0;
    d.tracks.forEach((t, ti) => trackEditor(tracksEl, d, t, ti, refresh, renderTracks, previews));
    const add = tracksEl.createEl("button", { text: "新增一軌" });
    add.onclick = () => { d.tracks.push({ track: "", voices: [], hits: "" }); renderTracks(); refresh(); };
  };
  renderTracks();
  refresh();

  const actions = box.createDiv({ cls: "rpd-choice" });
  const cancel = actions.createEl("button", { text: "取消" });
  cancel.onclick = () => o.onCancel();
  const save = actions.createEl("button", { cls: "mod-cta", text: "儲存" });
  save.onclick = async () => {
    if (!o.isVariation && (!d.meter || d.subdivision === null)) return void new Notice("請先選擇拍號與每拍幾格");
    if (parseGroups(d.groups) === null) return void new Notice("分組格式不對");
    await o.onSave(d, parse());
  };
  if (o.onDelete) {
    const del = box.createEl("button", { cls: "rpd-wide rpd-secondary", text: "刪除這個變形" });
    let armed = false;
    del.onclick = async () => {
      if (!armed) { armed = true; del.setText("再按一次確認刪除"); return; }
      await o.onDelete!();
    };
  }
}

function trackEditor(parent: HTMLElement, d: Draft, t: DraftTrack, ti: number, refresh: () => void, rerender: () => void, previews: (() => void)[]): void {
  const box = parent.createDiv({ cls: "rpd-track-edit" });
  box.createDiv({ cls: "rpd-label", text: `第 ${ti + 1} 軌` });
  new Setting(box).setName("軌名").addText((x) => x.setPlaceholder("填入軌名").setValue(t.track).onChange((v) => { t.track = v.trim(); }));
  new Setting(box).setName("樂器預設").setDesc("選了會換掉這一軌的音名；之後可以再改").addDropdown((dd) => {
    dd.addOption("", "請選擇");
    for (const p of INSTRUMENT_PRESETS) dd.addOption(p.id, p.label);
    dd.addOption("custom", "自訂（清空）");
    dd.onChange((id) => {
      if (!id) return;
      const p = INSTRUMENT_PRESETS.find((x) => x.id === id);
      t.voices = p ? Object.entries(p.voices) : [];
      if (p) new Notice(`${p.label}：${p.note}`, 6000);
      rerender();
      refresh();
    });
  });

  const vbox = box.createDiv({ cls: "rpd-voices" });
  vbox.createDiv({ cls: "rpd-desc", text: "音名：代號是一個字元，鼓譜裡大寫＝重音或骨架音、小寫＝輕音或裝飾音" });
  t.voices.forEach((pair, vi) => {
    const row = vbox.createDiv({ cls: "rpd-voice-row" });
    const k = row.createEl("input", { type: "text" });
    k.maxLength = 1;
    k.placeholder = "代號";
    k.value = pair[0];
    k.oninput = () => { pair[0] = k.value.toUpperCase(); refresh(); };
    const n = row.createEl("input", { type: "text" });
    n.placeholder = "填入音名";
    n.value = pair[1];
    n.oninput = () => { pair[1] = n.value.trim(); refresh(); };
    const del = row.createEl("button", { cls: "rpd-small", text: "移除" });
    del.onclick = () => { t.voices.splice(vi, 1); rerender(); refresh(); };
  });
  const addV = vbox.createEl("button", { cls: "rpd-small", text: "新增音名" });
  addV.onclick = () => { t.voices.push(["", ""]); rerender(); };

  box.createDiv({ cls: "rpd-desc", text: "鼓譜：一格一個字元，「.」是休止；空白只用來分隔。也可以直接點下方格子換音。" });
  const input = box.createEl("textarea", { cls: "rpd-hits" });
  input.placeholder = "填入鼓譜";
  input.rows = 2;
  input.setAttr("autocapitalize", "off");
  input.setAttr("autocorrect", "off");
  input.setAttr("spellcheck", "false");
  input.value = t.hits;
  input.oninput = () => { t.hits = cleanHits(input.value); refresh(); };

  const preview = box.createDiv({ cls: "rpd-tap-grid" });
  const draw = () => {
    preview.empty();
    const n = parseNotation(draftToInput(d));
    const total = n?.total ?? Math.max(t.hits.length, 1);
    const groups = n?.groups ?? [];
    const starts = new Set<number>();
    let acc = 0;
    for (const g of groups) { starts.add(acc); acc += g; }
    const keys = t.voices.map(([k]) => k).filter(Boolean);
    // 一個分組一塊，整塊換行，格子才夠大好點
    let cluster = preview.createDiv({ cls: "rpd-tap-group" });
    for (let i = 0; i < total; i++) {
      if (starts.has(i) && i > 0) cluster = preview.createDiv({ cls: "rpd-tap-group" });
      const ch = t.hits[i] ?? ".";
      const up = ch.toUpperCase();
      const known = ch !== "." && keys.map((x) => x.toUpperCase()).includes(up);
      const accent = known && ch === up && ch !== ch.toLowerCase();
      const cell = cluster.createEl("button", {
        cls: `rpd-gcell${ch === "." ? "" : known ? (accent ? " is-accent" : " is-light") : " is-bad"}${starts.has(i) ? " is-start" : ""}`,
        text: ch === "." ? "·" : ch,
      });
      cell.onclick = () => {
        if (!keys.length) return void new Notice("請先設定這一軌的音名");
        t.hits = cycleCell(t.hits, i, keys, total);
        input.value = formatHits(t.hits, groups);
        refresh();
      };
    }
  };
  previews.push(draw);

  if (d.tracks.length > 1) {
    const rm = box.createEl("button", { cls: "rpd-small", text: "刪除這一軌" });
    rm.onclick = () => { d.tracks.splice(ti, 1); rerender(); refresh(); };
  }
}
