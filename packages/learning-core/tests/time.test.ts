import { describe, it, expect } from "vitest";
import { fileStamp, localIsoMinute } from "../src/time";

describe("time", () => {
  const d = new Date(2026, 10, 8, 9, 5);
  it("fileStamp", () => expect(fileStamp(d)).toBe("2026-11-08-0905"));
  it("localIsoMinute", () => expect(localIsoMinute(d)).toBe("2026-11-08T09:05"));
});
