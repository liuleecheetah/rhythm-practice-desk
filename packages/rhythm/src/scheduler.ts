// 節拍器前瞻排程的純邏輯（不碰 Web Audio，可單元測試）。
// 呼叫端每 ~25 ms 用 AudioContext.currentTime 呼叫一次 collectDue，
// 把回傳的事件用 Web Audio 排在各自的 time 上發聲。

export interface ClickState {
  /** 下一個要排程的拍點時間（AudioContext 秒） */
  nextTime: number;
  /** 下一個拍點的總序號（從 0 開始） */
  beatIndex: number;
}

export interface ClickEvent {
  time: number;
  beatIndex: number;
  /** 小節內第幾拍（0 起算） */
  beatInBar: number;
  /** 第幾小節（0 起算） */
  bar: number;
}

export interface CollectResult {
  events: ClickEvent[];
  state: ClickState;
  /** 因為計時器停擺而跳過、沒有發聲的拍數 */
  skipped: number;
}

/**
 * 收集 [now, now + horizon) 之間該排程的拍點。
 * 若計時器停擺太久（nextTime 落後 now 超過一拍），
 * 不補發過去的拍，而是沿著原本的格線往前跳，維持拍點對齊。
 */
export function collectDue(
  state: ClickState,
  now: number,
  horizon: number,
  secondsPerBeat: number,
  beatsPerBar: number,
): CollectResult {
  if (!(secondsPerBeat > 0)) throw new Error("secondsPerBeat 必須大於 0");
  if (!(beatsPerBar >= 1)) throw new Error("beatsPerBar 必須至少為 1");
  let { nextTime, beatIndex } = state;
  let skipped = 0;
  if (nextTime < now - secondsPerBeat) {
    const missed = Math.ceil((now - nextTime) / secondsPerBeat);
    nextTime += missed * secondsPerBeat;
    beatIndex += missed;
    skipped = missed;
  }
  const events: ClickEvent[] = [];
  const end = now + horizon;
  while (nextTime < end) {
    events.push({
      time: nextTime,
      beatIndex,
      beatInBar: beatIndex % beatsPerBar,
      bar: Math.floor(beatIndex / beatsPerBar),
    });
    beatIndex += 1;
    // 用起點＋序號計算，避免浮點累加誤差
    nextTime = state.nextTime + (beatIndex - state.beatIndex) * secondsPerBeat;
  }
  return { events, state: { nextTime, beatIndex }, skipped };
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}
