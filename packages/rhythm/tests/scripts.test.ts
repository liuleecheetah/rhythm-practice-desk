import { describe, it, expect } from "vitest";
import { h5Bar, h5Cue, h5ShouldStop, h5Config, T2_LEVELS, t2Config } from "../src/scripts";
import { isMutedBar } from "../src/clicks";

describe("T2", () => {
  it("四級依序：全開 → 響2靜2 → 響1靜3 → 響1靜7（選配）", () => {
    expect(T2_LEVELS.map((l) => l.label)).toEqual(["全開", "響2靜2", "響1靜3", "響1靜7"]);
    expect(T2_LEVELS.filter((l) => l.passLevel).map((l) => l.label)).toEqual(["響1靜3"]);
  });
  it("節拍器每拍一下、只有第 1 拍重音、有預備拍", () => {
    const c = t2Config(70);
    expect([c.subdivision, c.accentFirst, c.countIn, c.meter]).toEqual([1, true, true, "4/4"]);
  });
});

describe("H5", () => {
  it("節拍器只在 fill 之後的那一小節響", () => {
    const c = h5Config(70);
    const sounding = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((b) => !isMutedBar(b, c.muteOn, c.muteOff));
    expect(sounding).toEqual([0, 4, 8]);
    expect(sounding.every((b) => h5Bar(b).cycleBar === 1)).toBe(true);
    expect(h5Bar(3).isFillBar).toBe(true);
  });
  it("計數：每次回到第 1 拍加一", () => {
    expect([0, 3, 4, 7, 8, 40].map((b) => h5Bar(b).completed)).toEqual([0, 0, 1, 1, 2, 10]);
  });
  it("fill 位置的提示", () => {
    expect(h5Cue("H5a", 3, 2).kind).toBe("ready");
    expect(h5Cue("H5a", 3, 3).text).toBe("fill：十六分 4 下");
    expect(h5Cue("H5c", 3, 0).kind).toBe("fill");
    expect(h5Cue("H5d", 7, 2).text).toBe("fill：三連音 6 下");
    expect(h5Cue("H5b", 4, 0).kind).toBe("return");
    expect(h5Cue("H5b", 0, 0).kind).toBe("groove");
  });
  it("第 10 次回到 1 的那一小節打完才結束", () => {
    expect(h5ShouldStop(40)).toBe(false);
    expect(h5ShouldStop(41)).toBe(true);
  });
});
