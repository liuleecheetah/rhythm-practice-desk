// 手機版：Obsidian 的浮動導覽列蓋在畫面最下方，把底部按鈕抬到它上面。
// 導覽列沒有公開 API，所以在執行時量它的位置；量不到時用固定的間距。

const FALLBACK_PX = 96;

function navbarOffset(): number {
  if (!document.body.classList.contains("is-mobile")) return 0;
  for (const sel of [".mobile-navbar", ".mobile-toolbar"]) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.top < window.innerHeight) return Math.max(0, Math.round(window.innerHeight - r.top) + 8);
  }
  return FALLBACK_PX;
}

/** 設定 --rpd-bottom-offset；畫面尺寸改變時重新量。回傳清理函式。 */
export function trackBottomOffset(root: HTMLElement): () => void {
  const apply = () => root.style.setProperty("--rpd-bottom-offset", `${navbarOffset()}px`);
  apply();
  window.setTimeout(apply, 500); // 導覽列可能比畫面晚出現
  window.addEventListener("resize", apply);
  return () => window.removeEventListener("resize", apply);
}

/** 頁首：回今日頁 */
export function backBar(parent: HTMLElement, onBack: () => void, label = "今日頁"): void {
  const bar = parent.createDiv({ cls: "rpd-topbar" });
  const b = bar.createEl("button", { cls: "rpd-back", text: `‹ ${label}` });
  b.onclick = onBack;
}
