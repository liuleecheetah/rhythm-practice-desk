import { describe, it, expect } from "vitest";
import { findSection } from "../src/core/sections";

const md = `# 課程
## 項目一：時間（T）
說明
### T1 每 2 小節更換細分
T1 內容
### T2 四拍的靜音測試（即階 0A-1）
T2 內容
### T3 慢速
## 項目二：手序（H）
### H1–H4 四種基本手序
手序內容
### H5 四個固定的 fill
fill 內容
| H5a | x |
## 項目四：四肢協調（C）
### C1–C5 腳固定，手逐步加難
協調內容
### C6 雙腳 3 對 2
## 項目五：樂句（P）
| P1 | 表格 |
## 把練習搬到不同樂器
`;

describe("findSection", () => {
  it("完全相同的代號，到下一個同級標題為止", () => {
    const s = findSection(md, "T2")!;
    expect(s.startsWith("### T2")).toBe(true);
    expect(s).toContain("T2 內容");
    expect(s).not.toContain("T3");
  });
  it("T1 不會誤配 T1x 以外的段落", () => expect(findSection(md, "T1")).toContain("T1 內容"));
  it("範圍：H3 → H1–H4；C5 → C1–C5；C6 → 自己", () => {
    expect(findSection(md, "H3")).toContain("手序內容");
    expect(findSection(md, "C5")).toContain("協調內容");
    expect(findSection(md, "C6")!.startsWith("### C6")).toBe(true);
  });
  it("前綴：H5b → H5", () => expect(findSection(md, "H5b")).toContain("fill 內容"));
  it("沒有單獨標題的退回項目段落：P3 → 項目五", () => {
    const s = findSection(md, "P3")!;
    expect(s).toContain("| P1 | 表格 |");
    expect(s).not.toContain("搬到不同樂器");
  });
  it("找不到時回傳 null", () => expect(findSection(md, "X1")).toBeNull());
});
