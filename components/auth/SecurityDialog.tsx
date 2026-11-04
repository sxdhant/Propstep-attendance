"use client";

import { Copy, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChangePasswordForm } from "@/components/auth/PasswordForms";
import { Spinner } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSessionState } from "@/hooks/use-store";
import { formatDateTime } from "@/lib/format";
import {
  beginTotpSetup,
  disableTotp,
  enableTotp,
  listDevices,
  signOutDevice,
  type DeviceSession,
} from "@/lib/services/session-service";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function TwoFactor() {
  const session = useSessionState();
  const enabled = session?.totpEnabled ?? false;
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const result = await beginTotpSetup();
    setBusy(false);
    if (result.ok) setSetup(result.data);
    else toast.error("Couldn't start setup", { description: result.error });
  };

  const confirm = async () => {
    setBusy(true);
    const result = await enableTotp(code);
    setBusy(false);
    if (!result.ok) return toast.error("Couldn't turn on two-factor", { description: result.error });
    setSetup(null);
    setCode("");
    setRecovery(result.data.recoveryCodes);
  };

  const turnOff = async () => {
    setBusy(true);
    const result = await disableTotp(password, code);
    setBusy(false);
    if (!result.ok) return toast.error("Couldn't turn off two-factor", { description: result.error });
    setCode("");
    setPassword("");
    toast.success("Two-factor sign-in turned off");
  };

  if (recovery) {
    return (
      <div className="grid gap-3 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-medium">Two-factor sign-in is on. Save your recovery codes.</p>
        <p className="text-sm text-muted-foreground">Each code works once if you lose your phone. They are shown only now.</p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
          {recovery.map((c) => (
            <li key={c} className="rounded bg-background px-2 py-1">{c}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard?.writeText(recovery.join("\n"))}>
            <Copy className="size-4" aria-hidden /> Copy codes
          </Button>
          <Button type="button" size="sm" onClick={() => setRecovery(null)}>I&apos;ve saved them</Button>
        </div>
      </div>
    );
  }

  if (setup) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">Scan this with an authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit code it shows.</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded-lg bg-white p-2"><QRCodeSVG value={setup.uri} size={140} /></div>
          <div className="min-w-0 text-sm">
            <p className="text-muted-foreground">Can&apos;t scan? Enter this key manually:</p>
            <p className="mt-1 font-mono text-xs break-all">{setup.secret}</p>
          </div>
        </div>
        <Field>
          <FieldLabel htmlFor="totp-confirm">6-digit code</FieldLabel>
          <Input id="totp-confirm" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="w-40 tracking-widest" />
        </Field>
        <div className="flex gap-2">
          <Button type="button" onClick={confirm} disabled={busy || code.length !== 6}>{busy && <Spinner />}Turn on</Button>
          <Button type="button" variant="ghost" onClick={() => { setSetup(null); setCode(""); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-sm text-green-700"><ShieldCheck className="size-4" aria-hidden /> Two-factor sign-in is on.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="totp-off-pw">Password</FieldLabel>
            <Input id="totp-off-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field>
            <FieldLabel htmlFor="totp-off-code">Current code</FieldLabel>
            <Input id="totp-off-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
          </Field>
        </div>
        <Button type="button" variant="outline" className="justify-self-start" onClick={turnOff} disabled={busy || !password || code.length !== 6}>
          {busy ? <Spinner /> : <ShieldOff className="size-4" aria-hidden />}Turn off
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <FieldDescription>Adds a code from your phone to every sign-in. Strongly recommended for administrators.</FieldDescription>
      <Button type="button" onClick={start} disabled={busy} className="justify-self-start">
        {busy ? <Spinner /> : <Smartphone className="size-4" aria-hidden />}Set up two-factor
      </Button>
    </div>
  );
}

function Devices() {
  const [devices, setDevices] = useState<DeviceSession[] | null>(null);

  const load = useCallback(async () => {
    const result = await listDevices();
    if (result.ok) setDevices(result.data);
  }, []);

  useEffect(() => {
    let active = true;
    void listDevices().then((result) => {
      if (active && result.ok) setDevices(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const revoke = async (id: string) => {
    const result = await signOutDevice(id);
    if (result.ok) {
      toast.success("Device signed out");
      void load();
    } else toast.error("Couldn't sign the device out", { description: result.error });
  };

  if (!devices) return <p className="text-sm text-muted-foreground">Loading devices…</p>;
  return (
    <ul className="grid gap-2">
      {devices.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{d.userAgent?.split(")")[0]?.replace("Mozilla/5.0 (", "") || "Unknown device"}{d.current && " (this device)"}</p>
            <p className="text-xs text-muted-foreground">Last active {formatDateTime(d.lastSeenAt)}{d.ip && d.ip !== "unknown" ? `, ${d.ip}` : ""}</p>
          </div>
          {!d.current && <Button type="button" size="sm" variant="outline" onClick={() => revoke(d.id)}>Sign out</Button>}
        </li>
      ))}
    </ul>
  );
}

export function SecurityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Security</DialogTitle>
          <DialogDescription>Manage your password, two-factor sign-in and signed-in devices.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <Section title="Change password" description="Changing it signs you out on your other devices.">
            <ChangePasswordForm onDone={() => toast.success("Password changed", { description: "You were signed out on your other devices." })} />
          </Section>
          <Section title="Two-factor sign-in">
            <TwoFactor />
          </Section>
          <Section title="Signed-in devices">
            <Devices />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
