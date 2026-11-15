import { App, TFile, TFolder, normalizePath } from "obsidian";

/** 確保資料夾存在（逐層建立）。路徑是相對於 vault 根目錄。 */
export async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const path = normalizePath(folderPath);
  if (path === "/" || path === "") return;
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFolder) return;
  if (existing) throw new Error(`「${path}」已存在，但不是資料夾`);
  const parts = path.split("/");
  let cur = "";
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p;
    const f = app.vault.getAbstractFileByPath(cur);
    if (!f) await app.vault.createFolder(cur);
    else if (!(f instanceof TFolder)) throw new Error(`「${cur}」已存在，但不是資料夾`);
  }
}

/**
 * 在資料夾內建立新筆記。檔名重複時加 -2、-3…，絕不覆寫既有檔案。
 */
export async function createNewNote(app: App, folderPath: string, baseName: string, content: string): Promise<TFile> {
  await ensureFolder(app, folderPath);
  const folder = normalizePath(folderPath);
  for (let i = 1; i < 1000; i++) {
    const name = i === 1 ? baseName : `${baseName}-${i}`;
    const path = normalizePath(`${folder}/${name}.md`);
    if (!app.vault.getAbstractFileByPath(path)) return app.vault.create(path, content);
  }
  throw new Error("找不到可用的檔名");
}
