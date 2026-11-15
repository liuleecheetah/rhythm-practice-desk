import { describe, it, expect } from "vitest";
import { parseYtMessage, parseBridgeMessage, extractVideoId, youtubeWatchUrl } from "../src/materials/youtube";

describe("parseYtMessage", () => {
  it("解析 onError", () => {
    expect(parseYtMessage('{"event":"onError","info":153}')).toEqual({ kind: "error", code: 153 });
  });
  it("解析 infoDelivery", () => {
    expect(parseYtMessage('{"event":"infoDelivery","info":{"currentTime":12.5,"playbackRate":0.75}}'))
      .toEqual({ kind: "info", currentTime: 12.5, playbackRate: 0.75 });
  });
  it("忽略非 JSON 與無關事件", () => {
    expect(parseYtMessage("hello")).toBeNull();
    expect(parseYtMessage('{"event":"other"}')).toBeNull();
  });
});

describe("parseBridgeMessage", () => {
  it("只接受 rpd-player 來源", () => {
    expect(parseBridgeMessage({ source: "x", type: "ready" })).toBeNull();
    expect(parseBridgeMessage({ source: "rpd-player", type: "error", code: 150 })).toEqual({ kind: "error", code: 150 });
  });
});

describe("extractVideoId", () => {
  it.each([
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["not a url", null],
  ])("%s", (input, id) => {
    expect(extractVideoId(input)).toBe(id);
  });
  it("外部連結帶時間參數", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ", 83.4)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83s");
  });
});
