"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { LogoMark } from "@/components/layout/Logo";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { SidebarContent } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu">
            <Menu className="size-5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" showCloseButton={false} className="gap-0 p-0 data-[side=left]:w-72">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation links</SheetDescription>
          <SidebarContent onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <LogoMark className="size-8 lg:hidden" />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
