// YouTube 內嵌播放器與 player.html 中繼頁的訊息解析（純邏輯）。

export type YtMsg =
  | { kind: "ready" }
  | { kind: "error"; code: number }
  | { kind: "state"; playerState: number }
  | { kind: "info"; currentTime?: number; playerState?: number; playbackRate?: number };

/** 解析 YouTube iframe（enablejsapi=1）用 postMessage 送出的 JSON 字串。 */
export function parseYtMessage(data: unknown): YtMsg | null {
  let obj: unknown = data;
  if (typeof data === "string") {
    try {
      obj = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  switch (o.event) {
    case "onReady":
      return { kind: "ready" };
    case "onError":
      return { kind: "error", code: Number(o.info) };
    case "onStateChange":
      return { kind: "state", playerState: Number(o.info) };
    case "infoDelivery": {
      const info = (o.info ?? {}) as Record<string, unknown>;
      const r: YtMsg = { kind: "info" };
      if (typeof info.currentTime === "number") r.currentTime = info.currentTime;
      if (typeof info.playerState === "number") r.playerState = info.playerState;
      if (typeof info.playbackRate === "number") r.playbackRate = info.playbackRate;
      return r;
    }
    default:
      return null;
  }
}

/** player.html 中繼頁送回的訊息。 */
export type BridgeMsg =
  | { kind: "ready" }
  | { kind: "error"; code: number }
  | { kind: "status"; currentTime: number; playerState: number; playbackRate: number; loopCount: number }
  | { kind: "log"; text: string };

export function parseBridgeMessage(data: unknown): BridgeMsg | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (o.source !== "rpd-player") return null;
  switch (o.type) {
    case "ready":
      return { kind: "ready" };
    case "error":
      return { kind: "error", code: Number(o.code) };
    case "status":
      return {
        kind: "status",
        currentTime: Number(o.currentTime) || 0,
        playerState: Number(o.playerState),
        playbackRate: Number(o.playbackRate) || 1,
        loopCount: Number(o.loopCount) || 0,
      };
    case "log":
      return { kind: "log", text: String(o.text ?? "") };
    default:
      return null;
  }
}

/** 需要自動降到「在 YouTube 開啟」的錯誤碼。 */
export const FALLBACK_ERROR_CODES = [153, 101, 150];

export function describeYtError(code: number): string {
  switch (code) {
    case 2: return "影片 ID 格式不正確（錯誤 2）";
    case 5: return "HTML5 播放器發生錯誤（錯誤 5）";
    case 100: return "找不到影片，可能已移除或設為私人（錯誤 100）";
    case 101:
    case 150: return `上傳者不允許這部影片內嵌播放（錯誤 ${code}）`;
    case 153: return "播放器設定錯誤：請求缺少 HTTP Referer 或等效的客戶端識別（錯誤 153）";
    default: return `未知錯誤（${code}）`;
  }
}

/** 從網址或 ID 取出 11 碼影片 ID；取不到回傳 null。 */
export function extractVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return null;
}

export function youtubeWatchUrl(id: string, startSec?: number): string {
  const t = startSec && startSec > 0 ? `&t=${Math.floor(startSec)}s` : "";
  return `https://www.youtube.com/watch?v=${id}${t}`;
}
