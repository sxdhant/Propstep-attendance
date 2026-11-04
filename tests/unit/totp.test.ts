import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, codeAtStep, currentStep, generateSecret, verifyCode } from "@/lib/server/totp";

// RFC 6238 appendix B: secret "12345678901234567890", SHA-1.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("matches the RFC 6238 test vectors (last 6 digits of the 8-digit codes)", () => {
    expect(codeAtStep(RFC_SECRET, Math.floor(59 / 30))).toBe("287082"); // 94287082
    expect(codeAtStep(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804"); // 07081804
    expect(codeAtStep(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037"); // 69279037
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from("hello totp world");
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(generateSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts the current code and one step of clock drift either way", () => {
    const now = 1_700_000_000_000;
    const step = currentStep(now);
    expect(verifyCode(RFC_SECRET, codeAtStep(RFC_SECRET, step), null, now)).toBe(step);
    expect(verifyCode(RFC_SECRET, codeAtStep(RFC_SECRET, step - 1), null, now)).toBe(step - 1);
    expect(verifyCode(RFC_SECRET, codeAtStep(RFC_SECRET, step + 1), null, now)).toBe(step + 1);
  });

  it("rejects codes two steps away, wrong codes and malformed input", () => {
    const now = 1_700_000_000_000;
    const step = currentStep(now);
    expect(verifyCode(RFC_SECRET, codeAtStep(RFC_SECRET, step + 2), null, now)).toBeNull();
    expect(verifyCode(RFC_SECRET, "000000", null, now)).toBeNull();
    expect(verifyCode(RFC_SECRET, "12345", null, now)).toBeNull();
    expect(verifyCode(RFC_SECRET, "abcdef", null, now)).toBeNull();
  });

  it("refuses a step that was already used (replay protection)", () => {
    const now = 1_700_000_000_000;
    const step = currentStep(now);
    expect(verifyCode(RFC_SECRET, codeAtStep(RFC_SECRET, step), step, now)).toBeNull();
    expect(verifyCode(RFC_SECRET, codeAtStep(RFC_SECRET, step - 1), step, now)).toBeNull();
    expect(verifyCode(RFC_SECRET, codeAtStep(RFC_SECRET, step + 1), step, now)).toBe(step + 1);
  });
});
