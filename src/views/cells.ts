import type { ItemProgress } from "@rpd/learning-core";
import { PASS_STREAK } from "@rpd/rhythm";

/** 三格進度。 */
export function renderCells(parent: HTMLElement, ip: ItemProgress | undefined): HTMLElement {
  const box = parent.createSpan({ cls: "rpd-cells" });
  const n = ip?.cells ?? 0;
  for (let i = 0; i < PASS_STREAK; i++) box.createSpan({ cls: i < n ? "rpd-cell is-filled" : "rpd-cell" });
  box.setAttr("aria-label", `進度 ${n}/${PASS_STREAK}`);
  return box;
}
