import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import { cn } from "@/lib/utils";

const isIos = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

/** Per-device switch for browser push notifications, shown in the bell dropdown. */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("off"));
  }, []);

  if (state === null) return null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      setState(state === "on" ? await disablePush() : await enablePush());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change push notifications.");
    } finally {
      setBusy(false);
    }
  };

  let hint: string;
  if (state === "unsupported") {
    hint = isIos
      ? "On iPhone/iPad, add the hub to your Home Screen first (Share → Add to Home Screen)."
      : "This browser doesn't support push notifications.";
  } else if (state === "denied") {
    hint = "Blocked in your browser's site settings. Allow notifications there to turn this on.";
  } else if (state === "on") {
    hint = "You'll get alerts on this device even when the hub is closed.";
  } else {
    hint = "Get alerts on this device even when the hub is closed.";
  }

  return (
    <div className="px-3 py-2.5 border-b border-border bg-muted/20">
      <div className="flex items-center gap-2">
        {state === "on" ? (
          <BellRing className="w-3.5 h-3.5 text-primary shrink-0" />
        ) : (
          <BellOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-medium flex-1">Push notifications</span>
        {(state === "on" || state === "off") && (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50",
              state === "on" ? "bg-muted text-foreground hover:bg-muted/70" : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {busy ? "..." : state === "on" ? "Turn off" : "Turn on"}
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{error ?? hint}</p>
    </div>
  );
}
