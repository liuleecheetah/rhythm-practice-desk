import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// rhythm 模組不得依賴 Obsidian，才能在別的環境重複使用。
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("rhythm 模組邊界", () => {
  it("沒有任何檔案 import obsidian", () => {
    const files = walk(join(__dirname, "../src")).filter((f) => f.endsWith(".ts"));
    const offenders = files.filter((f) => /from\s+["']obsidian["']|require\(["']obsidian["']\)/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
