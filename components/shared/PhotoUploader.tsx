"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/shared/LoadingState";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { removeProfilePhoto, uploadProfilePhoto } from "@/lib/services/photo-service";

/** The person's photo with buttons to change or remove it. Shows initials until a photo is uploaded. */
export function PhotoUploader({ name, photo }: { name: string; photo?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const result = await uploadProfilePhoto(file);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (!result.ok) toast.error("Couldn't update your photo", { description: result.error });
    else toast.success("Photo updated");
  };

  const remove = async () => {
    setBusy(true);
    const result = await removeProfilePhoto();
    setBusy(false);
    if (!result.ok) toast.error("Couldn't remove your photo", { description: result.error });
    else toast.success("Photo removed");
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <UserAvatar name={name} photo={photo} size="xl" className="size-24 text-3xl" />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Upload profile photo"
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Spinner /> : <Camera className="size-3.5" aria-hidden />}
          {photo ? "Change" : "Add photo"}
        </Button>
        {photo && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void remove()} aria-label="Remove photo">
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
