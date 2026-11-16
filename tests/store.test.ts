import { describe, it, expect } from "vitest";
import { MockApp } from "./mocks/obsidian";
import { RecordStore, computeProgress } from "@rpd/learning-core";
import { SCHEMA, CURRICULUM } from "../src/curriculum";

const DIR = "節奏練習台/練習日誌";
const log = (date: string, passed: boolean, exercise = "T2") =>
  `---\ntype: practice-log\ndate: ${date}\nplace: 打擊墊\nexercise: ${exercise}\nbpm: 70\npassed: ${passed}\n---\n\n我的筆記\n`;

function setup() {
  const app = new MockApp();
  const store = new RecordStore(app as never, () => DIR, SCHEMA);
  return { app, store };
}

describe("RecordStore（模擬 vault）", () => {
  it("手改一則記錄的 passed，重新掃描後進度跟著變", async () => {
    const { app, store } = setup();
    app.files.set(`${DIR}/a.md`, log("2026-11-16T20:00", true));
    app.files.set(`${DIR}/b.md`, log("2026-11-17T20:00", true));
    app.files.set(`${DIR}/c.md`, log("2026-11-18T20:00", true));
    let p = computeProgress((await store.scan()).records, CURRICULUM);
    expect(p.items.T2.cells).toBe(3);
    expect(p.level).toBe(2);

    app.files.set(`${DIR}/c.md`, log("2026-11-18T20:00", false)); // 使用者在 Obsidian 手改
    p = computeProgress((await store.scan()).records, CURRICULUM);
    expect(p.items.T2.cells).toBe(0);
    expect(p.level).toBe(1);
  });

  it("frontmatter 壞掉的筆記被列出，內容完全不變", async () => {
    const { app, store } = setup();
    const broken = "---\ntype: practice-log\ndate: [2026-11-18\n---\n\n內文\n";
    const badField = log("2026-11-18T20:00", true).replace("passed: true", "passed: 是");
    app.files.set(`${DIR}/broken.md`, broken);
    app.files.set(`${DIR}/badfield.md`, badField);
    app.files.set(`${DIR}/plain.md`, "只是一則筆記\n");
    const snap = await store.scan();
    expect(snap.records).toHaveLength(0);
    expect(snap.unreadable.map((u) => u.path.split("/").pop()).sort()).toEqual(["badfield.md", "broken.md", "plain.md"]);
    expect(app.files.get(`${DIR}/broken.md`)).toBe(broken);
    expect(app.files.get(`${DIR}/badfield.md`)).toBe(badField);
  });

  it("資料夾外的筆記不讀；其他 type 的筆記不列為錯誤", async () => {
    const { app, store } = setup();
    app.files.set("其他/x.md", log("2026-11-18T20:00", true));
    app.files.set(`${DIR}/card.md`, "---\ntype: rhythm-card\n---\n");
    const snap = await store.scan();
    expect(snap.records).toHaveLength(0);
    expect(snap.unreadable).toHaveLength(0);
  });

  it("新增記錄只寫 frontmatter 與一行空白；檔名重複時加序號，不覆寫", async () => {
    const { app, store } = setup();
    const fm = { type: "practice-log", date: "2026-11-18T21:10", place: "打擊墊", exercise: "T2", setting: "響1靜3", bpm: 70, passed: true, duration_min: 6, dropped_at: "" };
    const a = await store.create("2026-11-18-2110-T2", fm);
    const b = await store.create("2026-11-18-2110-T2", fm);
    expect(a.path).toBe(`${DIR}/2026-11-18-2110-T2.md`);
    expect(b.path).toBe(`${DIR}/2026-11-18-2110-T2-2.md`);
    const content = app.files.get(a.path)!;
    expect(content.startsWith("---\n")).toBe(true);
    expect(content.endsWith("---\n\n")).toBe(true);
    const snap = await store.scan();
    expect(snap.records).toHaveLength(2);
    expect(snap.records[0].raw.setting).toBe("響1靜3");
  });
});
