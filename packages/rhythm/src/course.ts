// 《打擊基本功課程》的結構化資料（內建預設）。
// 來源：使用者 vault 裡的 COURSE.md。文字照錄；逐步做法、檢查方法等全文在執行時從 COURSE.md 讀取，不打包進外掛。

export type GroupId = "T" | "H" | "D" | "C" | "P";

export const GROUPS: { id: GroupId; name: string }[] = [
  { id: "T", name: "時間" },
  { id: "H", name: "手序" },
  { id: "D", name: "力度與音色" },
  { id: "C", name: "四肢協調" },
  { id: "P", name: "樂句" },
];

export const PLACES = ["打擊墊", "大腿", "橋下", "鼓課", "合奏"] as const;
export type Place = (typeof PLACES)[number];

/** 進度格預設只計這兩個場地（在打擊墊或大腿過關後才搬到鼓上） */
export const DEFAULT_PROGRESS_PLACES: readonly Place[] = ["打擊墊", "大腿"];

/** 不計入進度的自由項目 */
export const FREE_ITEMS = ["即興"] as const;

export type Evidence = "專案文件" | "研究文獻" | "一般教學常識" | "我的設計";

export interface Exercise {
  id: string;
  group: GroupId;
  name: string;
  /** 預設 BPM；課程沒有指定時為 null */
  bpm: number | null;
  /** 預設設定的簡述 */
  preset: string;
  /** 過關標準（照錄 COURSE.md） */
  pass: string;
  /** 依據標記；有分項時寫在 evidenceNote */
  evidence: Evidence[];
  evidenceNote?: string;
  /** 過關後的速度順序 */
  speeds?: number[];
  /** 只計這些場地的記錄（預設為打擊墊、大腿） */
  progressPlaces?: readonly Place[];
}

export const EXERCISES: Exercise[] = [
  { id: "T1", group: "T", name: "每 2 小節更換細分", bpm: 60, preset: "60 BPM，4/4，單擊，右手開始", pass: "連續 3 輪，每次更換細分都沒有太早或太晚。", evidence: ["我的設計"] },
  { id: "T2", group: "T", name: "四拍的靜音測試", bpm: 70, preset: "70 BPM，4/4，八分音符，每小節第一下打大聲，小聲數拍", pass: "第 4 步（響 1 靜 3）連續 3 分鐘，每次都同時出現。", evidence: ["專案文件"], evidenceNote: "交接文件", speeds: [70, 90, 110] },
  { id: "T3", group: "T", name: "慢速四分音符", bpm: 45, preset: "45 BPM，每拍只打一下", pass: "連續 2 分鐘都重疊。", evidence: ["我的設計"] },
  { id: "T4", group: "T", name: "三拍的靜音測試", bpm: 70, preset: "70 BPM，3/4，其餘與 T2 相同", pass: "與 T2 相同。", evidence: ["專案文件"], evidenceNote: "交接文件", speeds: [70, 90, 110] },
  { id: "T5", group: "T", name: "七拍的三種分組", bpm: 140, preset: "7/8，每個八分音符響一下，約 140", pass: "三種分組都換過一輪，你的第 1 下始終和節拍器的第 1 下同時出現。", evidence: ["專案文件"], evidenceNote: "交接文件" },
  { id: "T6", group: "T", name: "在指定的三連音位置發聲", bpm: 60, preset: "60 BPM，4/4，每拍數成三下", pass: "任一個指定位置，連續 8 小節都打在正確的位置。", evidence: ["專案文件", "我的設計"], evidenceNote: "做法：Galper《Forward Motion》第 10 章；過關標準：我的設計" },

  { id: "H1", group: "H", name: "單擊 RLRL", bpm: 70, preset: "70 BPM，八分音符，每一下一樣大聲，2 分鐘，錄音", pass: "錄音裡聽不出左手與右手的音量差別。", evidence: ["研究文獻", "我的設計"], evidenceNote: "手序：Percussive Arts Society 40 項國際標準基本技巧；速度與時間：我的設計", speeds: [70, 90, 110] },
  { id: "H2", group: "H", name: "單擊，左手開始 LRLR", bpm: 70, preset: "同 H1", pass: "錄音裡聽不出左手與右手的音量差別。", evidence: ["研究文獻", "我的設計"], evidenceNote: "同 H1", speeds: [70, 90, 110] },
  { id: "H3", group: "H", name: "雙擊 RRLL", bpm: 70, preset: "同 H1", pass: "錄音裡聽不出左手與右手的音量差別。", evidence: ["研究文獻", "我的設計"], evidenceNote: "同 H1", speeds: [70, 90, 110] },
  { id: "H4", group: "H", name: "Single paradiddle RLRR LRLL", bpm: 70, preset: "同 H1", pass: "錄音裡聽不出左手與右手的音量差別。", evidence: ["研究文獻", "我的設計"], evidenceNote: "同 H1", speeds: [70, 90, 110] },
  { id: "H5a", group: "H", name: "fill：第 4 拍十六分（4 下）", bpm: 70, preset: "70 BPM，4/4，3 小節八分音符＋第 4 小節 fill，響 1 靜 3", pass: "連續 10 次，fill 之後的第一下都和節拍器的第 1 拍同時出現。", evidence: ["專案文件", "我的設計"], evidenceNote: "做法：交接文件階 0A-3；fill 內容：我的設計" },
  { id: "H5b", group: "H", name: "fill：第 3、4 拍十六分（8 下）", bpm: 70, preset: "同 H5a", pass: "連續 10 次，fill 之後的第一下都和節拍器的第 1 拍同時出現。", evidence: ["專案文件", "我的設計"], evidenceNote: "同 H5a" },
  { id: "H5c", group: "H", name: "fill：整小節十六分（16 下）", bpm: 70, preset: "同 H5a", pass: "連續 10 次，fill 之後的第一下都和節拍器的第 1 拍同時出現。", evidence: ["專案文件", "我的設計"], evidenceNote: "同 H5a" },
  { id: "H5d", group: "H", name: "fill：第 3、4 拍三連音（6 下）", bpm: 70, preset: "同 H5a", pass: "連續 10 次，fill 之後的第一下都和節拍器的第 1 拍同時出現。", evidence: ["專案文件", "我的設計"], evidenceNote: "同 H5a" },

  { id: "D1", group: "D", name: "輕音與重音分開打", bpm: 70, preset: "70 BPM，八分音符單擊，4 小節輕音／4 小節重音", pass: "錄音裡兩段的音量差距明顯；同一段內每一下一樣大聲。", evidence: ["一般教學常識"] },
  { id: "D2", group: "D", name: "移動重音", bpm: 60, preset: "60 BPM，十六分音符單擊，每種 4 小節", pass: "四種不停下連續打完，每拍的第一下始終和節拍器同時出現；錄音裡輕音彼此一樣大聲。", evidence: ["研究文獻", "我的設計"], evidenceNote: "練習類型：Stone《Accents and Rebounds》（1961）；具體內容：我的設計" },
  { id: "D3", group: "D", name: "漸強與漸弱", bpm: 70, preset: "70 BPM，八分音符單擊，響 1 靜 3，2 小節漸強／2 小節漸弱", pass: "節拍器每次重新響起時，你的第 1 拍都和它同時出現。", evidence: ["我的設計"] },
  { id: "D4", group: "D", name: "Djembe 三個音的左右手一致", bpm: null, preset: "bass、tone、slap 各連打 8 下，左右手輪流，錄音（只在橋下做）", pass: "只聽錄音時，分辨不出哪一下是左手、哪一下是右手。", evidence: ["專案文件", "我的設計"], evidenceNote: "三個音的打法：Dworsky 與 Sansby《How to Play Djembe》；流程與過關標準：我的設計", progressPlaces: ["橋下"] },

  { id: "C1", group: "C", name: "腳每拍踩，手不動", bpm: 70, preset: "70 BPM", pass: "閉眼踩三分鐘，睁眼後仍和節拍器同時。", evidence: ["我的設計"], evidenceNote: "六階課程的階 0" },
  { id: "C2", group: "C", name: "腳每拍踩，手做 T1", bpm: 60, preset: "60 BPM", pass: "手更換細分時，腳的速度沒有改變。", evidence: ["我的設計"] },
  { id: "C3", group: "C", name: "腳踩第 2、4 拍，手打八分音符單擊", bpm: 70, preset: "70 BPM", pass: "連續 2 分鐘沒有踩錯拍。", evidence: ["一般教學常識", "我的設計"], evidenceNote: "左腳踩第 2、4 拍：鼓組常見的 hi-hat 踩法" },
  { id: "C4", group: "C", name: "腳每拍踩，手做 D2", bpm: 60, preset: "60 BPM", pass: "單獨聽腳的錄音，速度沒有變快、變慢或漏拍。", evidence: ["我的設計"] },
  { id: "C5", group: "C", name: "腳每拍踩，手做 H5", bpm: 70, preset: "70 BPM", pass: "打 fill 的那一小節，腳沒有漏拍。", evidence: ["我的設計"] },
  { id: "C6", group: "C", name: "雙腳 3 對 2（只能坐著做）", bpm: null, preset: "3/4，左腳每拍、右腳每兩拍", pass: "連續 2 分鐘。", evidence: ["專案文件", "我的設計"], evidenceNote: "做法：Galper《Forward Motion》第 10 章；過關標準：我的設計" },

  { id: "P1", group: "P", name: "4 小節為一句", bpm: 70, preset: "70 BPM，前 3 小節八分音符，第 4 小節加已過關的 fill，出聲數小節", pass: "連續 3 分鐘沒有數錯小節號。", evidence: ["專案文件"], evidenceNote: "交接文件階 0A-3" },
  { id: "P2", group: "P", name: "8 小節為一句", bpm: 70, preset: "70 BPM，前 7 小節八分音符，第 8 小節加 fill", pass: "連續 3 分鐘沒有數錯。", evidence: ["我的設計"] },
  { id: "P3", group: "P", name: "打 4 小節、停 4 小節", bpm: 70, preset: "70 BPM，響 1 靜 3，停的時候腳繼續每拍踩", pass: "連續 3 分鐘，每次重新開始打的第一下都和第 1 拍同時。", evidence: ["我的設計"] },
  { id: "P4", group: "P", name: "輪流演奏", bpm: null, preset: "與老師或一段錄音輪流，各 4 小節；速度依對方", pass: "你的 4 小節結束時，對方開始的第 1 拍和你預期的位置相同。", evidence: ["我的設計"], progressPlaces: ["鼓課", "橋下", "合奏"] },
  { id: "P5", group: "P", name: "七拍的 2 小節句", bpm: 140, preset: "八分音符 140，用 T5 任一種分組，打 1 小節、停 1 小節", pass: "連續 2 分鐘，每次重新開始都在第 1 下。", evidence: ["我的設計"] },
];

export interface Stage {
  level: number;
  /** 最快週數（只作參考，不是期限） */
  weeks: string;
  required: string[];
  mode: "pass" | "recheck";
  /** 必做的說明（照錄分期表） */
  requiredText: string;
  pad: string[];
  padNote?: string;
  thigh: string[];
  thighNote?: string;
  bridge: string;
}

export const STAGES: Stage[] = [
  { level: 1, weeks: "1", required: ["T2"], mode: "pass", requiredText: "T2：四拍靜音測試，響 1 靜 3，3 分鐘", pad: ["T1", "H1", "H2"], thigh: ["C1", "C2"], bridge: "D4；錄一段即興作為第 1 週的基準" },
  { level: 2, weeks: "2–3", required: ["H5a", "H5b"], mode: "pass", requiredText: "H5a 與 H5b：各連續 10 次準時回到第 1 拍", pad: ["T4", "D1", "D2"], thigh: ["C3", "P1"], bridge: "把 T2 搬到 djembe；D4" },
  { level: 3, weeks: "4–5", required: ["P3"], mode: "pass", requiredText: "P3：打 4 小節停 4 小節，3 分鐘", pad: ["H3", "H4", "D3", "H5c", "H5d"], thigh: ["C4", "P3"], bridge: "把 H5 搬到 djembe；用完整鼓組做 P3" },
  { level: 4, weeks: "6–7", required: ["T5"], mode: "pass", requiredText: "T5：七拍三種分組各 4 輪，連續換過一輪", pad: ["T3", "P2"], thigh: ["C5"], thighNote: "出聲念七拍分組", bridge: "把 D2 搬到 djembe；用 hi-hat 做 C4" },
  { level: 5, weeks: "8–9", required: ["C4"], mode: "pass", requiredText: "C4：單獨聽腳的錄音，速度沒有改變", pad: ["T6", "H4"], padNote: "H4 加速到 90 BPM", thigh: ["C5", "P5"], bridge: "把 H4 搬到混合鼓組；P4" },
  { level: 6, weeks: "10–11", required: ["T2", "H5a", "H5b", "H5c", "H5d", "D2", "C4", "P3"], mode: "recheck", requiredText: "T2、H5a–d、D2、C4、P3 全部重新檢查一次", pad: ["T2", "H5a", "H5b", "H5c", "H5d", "D2", "C4", "P3"], padNote: "重新檢查用", thigh: ["C6"], thighNote: "坐著做", bridge: "再錄一段即興，與第 1 週的錄音比較" },
];

/** 每週目標：大腿 5 天、打擊墊 2 次、橋下 1 次 */
export const WEEKLY_GOALS = [
  { context: "大腿", kind: "days" as const, target: 5, label: "大腿", unit: "天" },
  { context: "打擊墊", kind: "count" as const, target: 2, label: "打擊墊", unit: "次" },
  { context: "橋下", kind: "count" as const, target: 1, label: "橋下", unit: "次" },
];

export const PASS_STREAK = 3;
export const BPM_STEP_DOWN = 10;

export function exerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}
