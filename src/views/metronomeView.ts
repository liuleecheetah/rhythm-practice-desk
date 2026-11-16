// 獨立的節拍器（規格 6.1）：拍號、分組、細分、重音、靜音小節、預備拍。
// 設定只存在這個畫面裡，不寫入任何檔案。

import { ItemView, Notice, Setting, WorkspaceLeaf } from "obsidian";
import {
  DEFAULT_CLICK, GROUPING_7_IDS, METERS, SUBDIVISION_LABELS, effectiveSubdivision,
  type ClickConfig, type Grouping7, type MeterId, type Subdivision,
} from "@rpd/rhythm";
import type RhythmPracticeDesk from "../main";
import { Ring } from "./ring";
import { Player } from "./player";
import { bpmControl, choice } from "./controls";
import { backBar, trackBottomOffset } from "./layout";

export const METRONOME_VIEW = "rpd-metronome";

const MUTE_PRESETS: { on: number; off: number }[] = [
  { on: 0, off: 0 }, { on: 2, off: 2 }, { on: 1, off: 3 }, { on: 1, off: 7 },
];

export class MetronomeView extends ItemView {
  private cfg: ClickConfig = { ...DEFAULT_CLICK };
  private player: Player | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: RhythmPracticeDesk) {
    super(leaf);
  }

  getViewType(): string { return METRONOME_VIEW; }
  getDisplayText(): string { return "節拍器"; }
  getIcon(): string { return "timer"; }

  private untrack: (() => void) | null = null;

  async onOpen(): Promise<void> {
    this.untrack = trackBottomOffset(this.contentEl);
    this.render();
  }

  async onClose(): Promise<void> {
    this.player?.stop();
    this.untrack?.();
  }

  private render(): void {
    this.player?.stop();
    const root = this.contentEl;
    root.empty();
    root.addClass("rpd-root");
    backBar(root, () => { this.player?.stop(); void this.plugin.openToday(); });
    const c = this.cfg;

    const ring = new Ring(root);
    const player = new Player(this.plugin, ring);
    this.player = player;
    player.layout(c);
    ring.setCenter("—");
    const info = root.createDiv({ cls: "rpd-run-info" });

    const set = root.createDiv({ cls: "rpd-section" });
    bpmControl(set, () => c.bpm, (v) => { c.bpm = v; player.met?.setBpm(v); });

    set.createDiv({ cls: "rpd-label", text: "拍號" });
    choice(set, METERS.map((m) => ({ value: m, label: m })), () => c.meter, (v: MeterId) => { c.meter = v; this.render(); });
    if (c.meter === "7/8") {
      set.createDiv({ cls: "rpd-label", text: "分組" });
      choice(set, GROUPING_7_IDS.map((g) => ({ value: g, label: g })), () => c.grouping7, (v: Grouping7) => { c.grouping7 = v; this.render(); });
      new Setting(set).setName("分組起點重音").addToggle((t) => t.setValue(c.accentGroups).onChange((v) => { c.accentGroups = v; this.render(); }));
    } else {
      set.createDiv({ cls: "rpd-label", text: "細分" });
      choice(set, ([1, 2, 3, 4] as Subdivision[]).map((s) => ({ value: s, label: SUBDIVISION_LABELS[s] })), () => c.subdivision, (v: Subdivision) => { c.subdivision = v; this.render(); });
    }
    new Setting(set).setName("第 1 拍重音").addToggle((t) => t.setValue(c.accentFirst).onChange((v) => { c.accentFirst = v; this.render(); }));
    new Setting(set).setName("預備拍一小節").addToggle((t) => t.setValue(c.countIn).onChange((v) => (c.countIn = v)));

    set.createDiv({ cls: "rpd-label", text: "靜音小節" });
    let onInput: HTMLInputElement | null = null;
    let offInput: HTMLInputElement | null = null;
    const applyMute = () => player.met?.setMute(c.muteOn, c.muteOff);
    choice(set, MUTE_PRESETS.map((m) => ({ value: `${m.on}/${m.off}`, label: m.off ? `響${m.on}靜${m.off}` : "不靜音" })),
      () => `${c.muteOn}/${c.muteOff}`,
      (v: string) => {
        [c.muteOn, c.muteOff] = v.split("/").map(Number);
        if (onInput) onInput.value = String(c.muteOn);
        if (offInput) offInput.value = String(c.muteOff);
        applyMute();
      });
    new Setting(set).setName("自訂：響 N 靜 M").addText((t) => {
      onInput = t.inputEl;
      t.inputEl.type = "number";
      t.setPlaceholder("N").setValue(String(c.muteOn)).onChange((v) => { c.muteOn = Math.max(0, Number(v) || 0); applyMute(); });
    }).addText((t) => {
      offInput = t.inputEl;
      t.inputEl.type = "number";
      t.setPlaceholder("M").setValue(String(c.muteOff)).onChange((v) => { c.muteOff = Math.max(0, Number(v) || 0); applyMute(); });
    });

    const bottom = root.createDiv({ cls: "rpd-bottom" });
    const btn = bottom.createEl("button", { cls: "mod-cta rpd-wide", text: "開始" });
    btn.onclick = async () => {
      if (player.running) {
        player.stop();
        btn.setText("開始");
        ring.setCenter("—");
        ring.setLabel("");
        info.setText("");
        return;
      }
      btn.setText("停止");
      await player.start({ ...c }, {
        onHeard: (e) => {
          const sub = effectiveSubdivision(c);
          ring.setCenter(String(Math.floor(e.step / sub) + 1));
          ring.setLabel(e.countIn ? "預備" : e.muted ? "靜" : "", e.muted ? "rest" : "");
          if (!e.countIn) info.setText(`第 ${e.bar + 1} 小節${e.muted ? "（靜音）" : ""}`);
        },
      }).catch((e: Error) => {
        new Notice(e.message, 8000);
        btn.setText("開始");
      });
    };
  }
}
