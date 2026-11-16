import { App, Modal, Notice, Setting } from "obsidian";
import { fileStamp, localIsoMinute, type RecordStore } from "@rpd/learning-core";
import { EXERCISES, GROUPS, PLACES, type Place } from "@rpd/rhythm";
import { MAX_BPM, MIN_BPM } from "../suggest";

export interface RecordDraft {
  place: Place;
  exercise: string;
  setting: string;
  bpm: number | null;
  durationMin: number | null;
}

/** 新增一則練習記錄。只建立新筆記，不改動任何既有檔案。 */
export class NewRecordModal extends Modal {
  private passed: boolean | null = null;
  private droppedAt = "";

  constructor(app: App, private store: RecordStore, private draft: RecordDraft, private hint = "") {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("rpd-modal");
    this.setTitle("新增練習記錄");
    const d = this.draft;

    new Setting(contentEl).setName("場地").addDropdown((dd) => {
      for (const p of PLACES) dd.addOption(p, p);
      dd.setValue(d.place).onChange((v) => (d.place = v as Place));
    });

    new Setting(contentEl).setName("練習").addDropdown((dd) => {
      dd.addOption("", "（沒有代號）");
      dd.addOption("即興", "即興");
      for (const g of GROUPS) {
        for (const e of EXERCISES.filter((x) => x.group === g.id)) dd.addOption(e.id, `${e.id} ${e.name}`);
      }
      dd.setValue(d.exercise).onChange((v) => {
        d.exercise = v;
        renderResult();
      });
    });

    new Setting(contentEl).setName("設定").setDesc("選填：做到哪一步，例如「響1靜3」").addText((t) =>
      t.setValue(d.setting).onChange((v) => (d.setting = v.trim())),
    );

    const bpmSetting = new Setting(contentEl).setName("速度（BPM）").addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.inputMode = "numeric";
      t.setValue(d.bpm === null ? "" : String(d.bpm)).onChange((v) => {
        const n = Number(v);
        d.bpm = v.trim() === "" || !Number.isFinite(n) ? null : n;
      });
    });
    if (this.hint) bpmSetting.setDesc(this.hint);

    new Setting(contentEl).setName("練習時間（分鐘）").addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.inputMode = "numeric";
      t.setValue(d.durationMin === null ? "" : String(d.durationMin)).onChange((v) => {
        const n = Number(v);
        d.durationMin = v.trim() === "" || !Number.isFinite(n) ? null : n;
      });
    });

    const resultEl = contentEl.createDiv();
    const renderResult = () => {
      resultEl.empty();
      const known = EXERCISES.some((e) => e.id === d.exercise);
      if (!known) {
        this.passed = null;
        return;
      }
      resultEl.createDiv({ cls: "rpd-label", text: "達到過關標準了嗎？" });
      const row = resultEl.createDiv({ cls: "rpd-choice" });
      const yes = row.createEl("button", { text: "達到" });
      const no = row.createEl("button", { text: "沒達到" });
      const sync = () => {
        yes.toggleClass("mod-cta", this.passed === true);
        no.toggleClass("mod-warning", this.passed === false);
      };
      yes.onclick = () => { this.passed = true; sync(); };
      no.onclick = () => { this.passed = false; sync(); };
      sync();
      new Setting(resultEl).setName("哪裡出錯").setDesc("選填，一句話").addText((t) =>
        t.setValue(this.droppedAt).onChange((v) => (this.droppedAt = v.trim())),
      );
    };
    renderResult();

    const footer = contentEl.createDiv({ cls: "rpd-bottom" });
    const save = footer.createEl("button", { cls: "mod-cta rpd-wide", text: "儲存記錄" });
    save.onclick = () => void this.save();
  }

  private async save(): Promise<void> {
    const d = this.draft;
    const known = EXERCISES.some((e) => e.id === d.exercise);
    if (known && this.passed === null) {
      new Notice("請選「達到」或「沒達到」");
      return;
    }
    if (d.bpm !== null && (d.bpm < MIN_BPM || d.bpm > MAX_BPM)) {
      new Notice(`速度請填 ${MIN_BPM}–${MAX_BPM}`);
      return;
    }
    const now = new Date();
    const fm: Record<string, unknown> = {
      type: "practice-log",
      date: localIsoMinute(now),
      place: d.place,
      exercise: d.exercise,
      setting: d.setting,
      bpm: d.bpm ?? "",
      passed: this.passed ?? "",
      duration_min: d.durationMin ?? "",
      dropped_at: this.droppedAt,
    };
    try {
      const f = await this.store.create(`${fileStamp(now)}-${d.exercise || d.place}`, fm);
      new Notice(`已建立 ${f.basename}`);
      this.close();
    } catch (e) {
      new Notice(`建立失敗：${(e as Error).message}`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
