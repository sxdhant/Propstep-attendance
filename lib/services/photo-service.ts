import { dataStore } from "@/lib/data-store";
import { prepareProfilePhoto } from "@/lib/image";
import { api } from "@/lib/api";
import type { ServiceResult } from "@/types/common";

/** Resizes the chosen photo, uploads it as the signed-in person's profile photo and refreshes the app data. */
export async function uploadProfilePhoto(file: File): Promise<ServiceResult<{ photoUrl: string }>> {
  const prepared = await prepareProfilePhoto(file);
  if (!prepared.ok) return { ok: false, error: prepared.error };
  try {
    const response = await fetch("/api/profile/photo", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": prepared.blob.type },
      body: prepared.blob,
    });
    const json = (await response.json().catch(() => null)) as { ok: boolean; data?: { photoUrl: string }; error?: string } | null;
    if (!json?.ok || !json.data) return { ok: false, error: json?.error ?? `The server returned an error (${response.status}).` };
    await dataStore.refresh();
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: "Can't reach the server. Check your connection and try again." };
  }
}

export async function removeProfilePhoto(): Promise<ServiceResult<null>> {
  const result = await api<null>("DELETE", "/api/profile/photo");
  if (result.ok) await dataStore.refresh();
  return result;
}
