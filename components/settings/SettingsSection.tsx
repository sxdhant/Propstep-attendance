"use client";

import { RotateCcw, Save } from "lucide-react";
import type { ReactNode } from "react";
import { Spinner } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";

interface SettingsSectionProps {
  title: string;
  description: string;
  formId: string;
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  children: ReactNode;
}

/** Shared frame for a settings form: heading, fields, and a footer that only enables Save when something changed. */
export function SettingsSection({
  title,
  description,
  formId,
  dirty,
  saving,
  onDiscard,
  children,
}: SettingsSectionProps) {
  return (
    <section className="max-w-3xl overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <header className="border-b px-6 py-5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="px-6 py-6">{children}</div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDiscard} disabled={!dirty || saving}>
            <RotateCcw className="size-4" aria-hidden />
            Discard
          </Button>
          <Button type="submit" form={formId} disabled={!dirty || saving}>
            {saving ? <Spinner /> : <Save className="size-4" aria-hidden />}
            Save Settings
          </Button>
        </div>
      </footer>
    </section>
  );
}
