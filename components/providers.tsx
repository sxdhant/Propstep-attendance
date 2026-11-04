"use client";

import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      {children}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
