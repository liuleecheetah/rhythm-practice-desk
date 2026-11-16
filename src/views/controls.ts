import { BPM_MAX, BPM_MIN, clampBpm } from "@rpd/rhythm";

/** BPM：−5 −1 [數字] +1 +5 */
export function bpmControl(parent: HTMLElement, get: () => number, set: (v: number) => void): void {
  const row = parent.createDiv({ cls: "rpd-bpm" });
  const mk = (d: number) => {
    const b = row.createEl("button", { text: d > 0 ? `+${d}` : String(d) });
    b.onclick = () => { set(clampBpm(get() + d)); show(); };
  };
  mk(-5);
  mk(-1);
  const label = row.createDiv({ cls: "rpd-bpm-value" });
  mk(1);
  mk(5);
  const show = () => label.setText(`${get()} BPM`);
  show();
  parent.createDiv({ cls: "rpd-desc", text: `範圍 ${BPM_MIN}–${BPM_MAX}；7/8 以八分音符計` });
}

/** 一排互斥按鈕 */
export function choice<T extends string | number>(parent: HTMLElement, options: { value: T; label: string }[], get: () => T, set: (v: T) => void): void {
  const row = parent.createDiv({ cls: "rpd-choice rpd-choice-wrap" });
  const btns = options.map((o) => {
    const b = row.createEl("button", { text: o.label });
    b.onclick = () => { set(o.value); sync(); };
    return b;
  });
  const sync = () => btns.forEach((b, i) => b.toggleClass("mod-cta", options[i].value === get()));
  sync();
}
