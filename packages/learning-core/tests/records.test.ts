import { describe, it, expect } from "vitest";
import { parseRecord, parseLocalDate, type RecordSchema } from "../src/core";

const schema: RecordSchema = {
  fields: { type: "practice-log", date: "date", context: "place", item: "exercise", passed: "passed" },
  contexts: ["打擊墊", "大腿", "橋下", "鼓課", "合奏"],
  knownItems: ["T1", "T2"],
  freeItems: ["即興"],
};
const ok = { type: "practice-log", date: "2026-11-18T21:10", place: "打擊墊", exercise: "T2", passed: true, bpm: 70 };

describe("parseLocalDate", () => {
  it("接受常見格式並當本地時間", () => {
    expect(parseLocalDate("2026-11-18T21:10")?.getHours()).toBe(21);
    expect(parseLocalDate("2026-11-18 21:10")?.getMinutes()).toBe(10);
    expect(parseLocalDate("2026-11-18")?.getDate()).toBe(18);
  });
  it("拒絕不存在的日期與亂碼", () => {
    expect(parseLocalDate("2026-02-31")).toBeNull();
    expect(parseLocalDate("昨天")).toBeNull();
    expect(parseLocalDate(20261118)).toBeNull();
  });
});

describe("parseRecord", () => {
  it("合法記錄", () => {
    const r = parseRecord("a.md", ok, schema);
    expect(r && r.ok && r.record.item).toBe("T2");
    expect(r && r.ok && r.record.raw.bpm).toBe(70);
  });
  it("不是這種記錄時回傳 null", () => {
    expect(parseRecord("a.md", { type: "rhythm-card" }, schema)).toBeNull();
  });
  it.each([
    [{ date: "下週" }, "date"],
    [{ place: "廚房" }, "place"],
    [{ exercise: "T9" }, "T9"],
    [{ passed: "是" }, "passed"],
    [{ passed: "" }, "passed"],
  ])("讀不懂的欄位：%o", (patch, word) => {
    const r = parseRecord("a.md", { ...ok, ...patch }, schema);
    expect(r && !r.ok && r.reason).toContain(word);
  });
  it("沒有代號、即興的記錄可以不填 passed", () => {
    const a = parseRecord("a.md", { ...ok, exercise: "", passed: null, place: "橋下" }, schema);
    const b = parseRecord("b.md", { ...ok, exercise: "即興", passed: undefined }, schema);
    expect(a?.ok && b?.ok).toBe(true);
  });
  it("passed 接受字串 true/false", () => {
    const r = parseRecord("a.md", { ...ok, passed: "false" }, schema);
    expect(r && r.ok && r.record.passed).toBe(false);
  });
});
