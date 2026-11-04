"use client";

import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SecurityDialog } from "@/components/auth/SecurityDialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppData } from "@/hooks/use-app-data";
import { reloadTo, ROLE_LABEL } from "@/lib/navigation";
import { signOut } from "@/lib/services/session-service";

export function ProfileMenu() {
  const { user, role } = useAppData();
  const router = useRouter();
  const [securityOpen, setSecurityOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    reloadTo("/login");
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The accessible name starts with the visible text (name and role) so voice-control users can say what they see. */}
        <Button
          variant="ghost"
          className="h-10 gap-2 px-1.5 sm:pr-2"
          aria-label={`${user.name} ${ROLE_LABEL[role]}, open profile menu`}
        >
          <UserAvatar name={user.name} photo={user.photoUrl} size="md" />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block max-w-32 truncate text-sm leading-tight font-medium">{user.name}</span>{" "}
            <span className="block text-xs leading-tight text-muted-foreground">{ROLE_LABEL[role]}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5 font-normal">
          <p className="text-sm font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">{user.subtitle}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(`/${role}/profile`)}>
          <UserRound aria-hidden />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setSecurityOpen(true)}>
          <ShieldCheck aria-hidden />
          Security
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <SecurityDialog open={securityOpen} onOpenChange={setSecurityOpen} />
    </>
  );
}
