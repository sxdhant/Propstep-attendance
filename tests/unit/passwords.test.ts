import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/server/passwords";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("Sunrise-Harbor-42");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("Sunrise-Harbor-42", hash)).toBe(true);
    expect(await verifyPassword("sunrise-harbor-42", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("Same-Password-1!")).not.toBe(await hashPassword("Same-Password-1!"));
  });

  it("treats a malformed stored hash as a failed check, not a crash", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("dummy verification resolves without throwing", async () => {
    await expect(verifyAgainstDummy("whatever")).resolves.toBeUndefined();
  });
});

describe("password policy", () => {
  it("only requires 6 to 128 characters", () => {
    expect(checkPasswordPolicy("abcde")).toContain("at least 6");
    expect(checkPasswordPolicy("abcdef")).toBeNull();
    expect(checkPasswordPolicy("ankit@123", { email: "ankit@propstep.in" })).toBeNull();
    expect(checkPasswordPolicy("Sunrise-Harbor-42")).toBeNull();
  });

  it("caps the length", () => {
    expect(checkPasswordPolicy("Aa1!".repeat(40))).toContain("at most 128");
  });
});
