import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function GooglePasswordSetup() {
  const { session, refetchProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasGoogle = session?.user.identities.some((identity) => identity.provider === "google");
  const hasPassword = session?.user.identities.some((identity) => identity.provider === "email");
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("google-password-setup-dismissed") === "1");
  if (!hasGoogle || hasPassword || dismissed) return null;
  return <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="google-password-title">
    <form onSubmit={async (event) => {
      event.preventDefault(); setError(null);
      if (password !== confirm) { setError("The passwords do not match."); return; }
      setBusy(true);
      try { await apiRequest("/auth/password/setup", { method: "POST", body: JSON.stringify({ password }) }); await refetchProfile(); }
      catch (err) { setError(err instanceof Error ? err.message : "Could not set your password."); }
      finally { setBusy(false); }
    }} className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4">
      <h2 id="google-password-title" className="text-xl font-semibold">Add a password for easier sign-in</h2>
      <p className="text-sm text-muted-foreground">Your Google account will keep working. You can also sign in with your username or email and this password.</p>
      <label className="block space-y-2 text-sm font-medium"><span>New password</span><input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>
      <label className="block space-y-2 text-sm font-medium"><span>Confirm password</span><input type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Add password"}</Button><Button type="button" variant="ghost" onClick={() => { sessionStorage.setItem("google-password-setup-dismissed", "1"); setDismissed(true); }}>Not now</Button></div>
    </form>
  </div>;
}
