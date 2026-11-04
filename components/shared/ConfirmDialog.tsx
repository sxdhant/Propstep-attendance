"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Spinner } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Details or form fields shown between the description and the buttons. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive" | "success";
  icon?: LucideIcon;
  pending?: boolean;
  confirmDisabled?: boolean;
  /** Set when the body contains a `<form id=…>`; the confirm button then submits that form. */
  formId?: string;
  onConfirm?: () => void | Promise<void>;
  className?: string;
}

const ICON_TONE = {
  default: "bg-accent text-accent-foreground",
  success: "bg-green-50 text-green-700",
  destructive: "bg-red-50 text-red-700",
} as const;

/** One confirmation pattern for every irreversible or consequential action. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  icon: Icon,
  pending = false,
  confirmDisabled = false,
  formId,
  onConfirm,
  className,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className={cn("gap-5 sm:max-w-md", className)}>
        <DialogHeader className="gap-3">
          {Icon && (
            <span className={cn("grid size-10 place-items-center rounded-full", ICON_TONE[tone])}>
              <Icon className="size-5" aria-hidden />
            </span>
          )}
          <div className="space-y-1.5">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            {description && <DialogDescription className="text-sm">{description}</DialogDescription>}
          </div>
        </DialogHeader>

        {children}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type={formId ? "submit" : "button"}
            form={formId}
            variant={tone === "destructive" ? "destructive" : "default"}
            className={cn(
              tone === "destructive" && "bg-red-600 text-white hover:bg-red-700",
              tone === "success" && "bg-green-600 text-white hover:bg-green-700",
            )}
            disabled={pending || confirmDisabled}
            onClick={formId ? undefined : () => void onConfirm?.()}
          >
            {pending && <Spinner />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
