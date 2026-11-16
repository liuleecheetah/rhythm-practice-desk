// 環形視覺（沿用節奏練習台.html）：一圈是一小節，每一格一個點。
// 金＝時間參照（節拍器），皮＝手（要打不同內容的位置，例如 fill）。

const NS = "http://www.w3.org/2000/svg";

export interface RingLayout {
  steps: number;
  /** 每拍格數 */
  sub: number;
  /** 要標示的分組起點（以拍為單位）；只有 7/8 需要，其他拍號給空陣列 */
  groupStarts: number[];
  /** 標成「皮」的格（例如 fill 的位置） */
  handSteps?: Set<number>;
}

export class Ring {
  readonly el: HTMLElement;
  private svg: SVGSVGElement;
  private dots: SVGCircleElement[] = [];
  private centerEl: HTMLElement;
  private labelEl: HTMLElement;
  private active = -1;
  private sig = "";

  constructor(parent: HTMLElement) {
    this.el = parent.createDiv({ cls: "rpd-ring" });
    this.svg = document.createElementNS(NS, "svg");
    this.svg.setAttribute("viewBox", "0 0 200 200");
    this.el.appendChild(this.svg);
    const mid = this.el.createDiv({ cls: "rpd-ring-mid" });
    this.centerEl = mid.createDiv({ cls: "rpd-ring-center", text: "—" });
    this.labelEl = mid.createDiv({ cls: "rpd-ring-label" });
  }

  layout(l: RingLayout): void {
    const sig = `${l.steps}/${l.sub}/${l.groupStarts.join(",")}/${[...(l.handSteps ?? [])].join(",")}`;
    if (sig === this.sig) return;
    this.sig = sig;
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    const track = document.createElementNS(NS, "circle");
    track.setAttribute("cx", "100");
    track.setAttribute("cy", "100");
    track.setAttribute("r", "80");
    track.setAttribute("class", "rpd-ring-track");
    this.svg.appendChild(track);
    this.dots = [];
    for (let i = 0; i < l.steps; i++) {
      const a = (i / l.steps) * 2 * Math.PI - Math.PI / 2;
      const onBeat = i % l.sub === 0;
      const beat = i / l.sub;
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", String(100 + 80 * Math.cos(a)));
      c.setAttribute("cy", String(100 + 80 * Math.sin(a)));
      const isGroup = onBeat && i !== 0 && l.groupStarts.includes(beat);
      c.setAttribute("r", i === 0 ? "11" : isGroup ? "9.5" : onBeat ? "8" : "4.5");
      const cls = ["rpd-dot"];
      if (i === 0) cls.push("is-one");
      if (isGroup) cls.push("is-group");
      if (!onBeat) cls.push("is-sub");
      if (l.handSteps?.has(i)) cls.push("is-hand");
      c.setAttribute("class", cls.join(" "));
      this.svg.appendChild(c);
      this.dots.push(c);
    }
    this.active = -1;
  }

  setActive(step: number, sounded: boolean): void {
    if (this.active >= 0) this.dots[this.active]?.classList.remove("is-on", "is-silent");
    this.active = step;
    this.dots[step]?.classList.add(sounded ? "is-on" : "is-silent");
  }

  clear(): void {
    if (this.active >= 0) this.dots[this.active]?.classList.remove("is-on", "is-silent");
    this.active = -1;
  }

  setMuted(m: boolean): void {
    this.el.toggleClass("is-muted", m);
  }

  setCenter(t: string): void {
    this.centerEl.setText(t);
  }

  setLabel(t: string, kind = ""): void {
    this.labelEl.setText(t);
    this.labelEl.className = `rpd-ring-label${kind ? ` is-${kind}` : ""}`;
  }
}
