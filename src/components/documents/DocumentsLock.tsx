import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Lock } from "@/components/icons";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

/** Shown instead of the library while it is locked. */
export function LockedNotice() {
  const [signingOut, setSigningOut] = useState(false);
  return (
    <div className="space-y-2 px-1 text-[13px] text-muted-foreground">
      <p>
        Forgot your passcode? Sign out and sign in again: Trip documents opens for a few minutes
        after you sign in, and you can turn its lock off there. Protected stays encrypted — a
        forgotten passcode cannot be recovered.
      </p>
      <button
        type="button"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          void supabase.auth.signOut().finally(() => {
            window.location.href = "/auth";
          });
        }}
        className="font-semibold text-primary underline"
      >
        Sign out
      </button>
    </div>
  );
}

/** The switch, and the warning that has to be read before it goes off. */
export function LockSetting({
  lockOn,
  onChange,
}: {
  lockOn: boolean;
  onChange: (on: boolean) => void;
}) {
  const [warning, setWarning] = useState(false);
  return (
    <>
      <label className="plain-card flex items-center gap-3 p-3">
        <span className="tile-fill-4 grid size-10 shrink-0 place-items-center rounded-xl border border-border/60 text-primary">
          <Lock className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Lock Trip documents</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {lockOn
              ? "Asks for Face ID, fingerprint or your passcode on this device."
              : "Off on this device. Anyone holding it unlocked can open your bookings."}
          </span>
        </span>
        <Switch
          checked={lockOn}
          onCheckedChange={(on) => (on ? onChange(true) : setWarning(true))}
          aria-label="Lock Trip documents"
        />
      </label>
      <Sheet
        open={warning}
        onClose={() => setWarning(false)}
        title="Turn off the lock?"
        width="sm"
        above
      >
        <div className="space-y-3">
          <p className="text-[14.5px]">
            Without the lock, anyone who picks up this device while it is unlocked can open your
            bookings, tickets and trip files, and download or share them.
          </p>
          <p className="text-[14px] text-muted-foreground">
            This changes this device only. Protected stays locked and encrypted either way.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setWarning(false)} className="btn-primary px-4">
              Keep it on
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(false);
                setWarning(false);
              }}
              className="h-[var(--h-button)] rounded-[var(--r-button)] border border-border bg-card text-[15px] font-semibold text-destructive"
            >
              Turn off
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
