// 樂器的音名預設（只有音的代號與名稱，不含任何節奏譜例）。使用者可以在每一軌自行增減、改名。

export interface InstrumentPreset {
  id: string;
  label: string;
  voices: Record<string, string>;
  note: string;
}

export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  { id: "djembe", label: "Djembe", voices: { B: "Bass", T: "Tone", S: "Slap" }, note: "三個音出自 COURSE.md（Dworsky 與 Sansby《How to Play Djembe》）" },
  { id: "darbuka", label: "Darbuka", voices: { D: "Dum", T: "Tak", K: "Ka" }, note: "常見記法；注意 Wikipedia「Dumbek rhythms」條目的字母用法與此相反（它寫 K＝Tak、T＝Ka）" },
  { id: "drumset", label: "爵士鼓組", voices: { B: "大鼓", S: "小鼓", H: "Hi-hat", T: "Tom" }, note: "常見寫法，請依老師的寫法修改" },
  { id: "bell", label: "鈴", voices: { X: "鈴" }, note: "時間參照用" },
];
