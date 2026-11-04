import type { ProfileContent } from "@/types/profile";

/** Tidy what the person typed before it is stored. Pure, so the server applies it on every save. */
export function normalizeProfile(content: ProfileContent): ProfileContent {
  const next = structuredClone(content);
  next.bank.ifsc = next.bank.ifsc.trim().toUpperCase();
  next.bank.pan = next.bank.pan.trim().toUpperCase();
  next.bank.accountNumber = next.bank.accountNumber.trim();
  next.experience.skills = [...new Set(next.experience.skills.map((s) => s.trim()).filter(Boolean))];
  next.experience.entries = next.experience.isFresher ? [] : next.experience.entries;
  next.experience.entries = next.experience.entries.map((e) => (e.current ? { ...e, to: "" } : e));
  if (next.personal.permanentSameAsCurrent) {
    next.personal.permanentAddress = { line1: "", city: "", state: "", pincode: "" };
  }
  return next;
}
