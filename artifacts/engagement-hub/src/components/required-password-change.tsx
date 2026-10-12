import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
export function RequiredPasswordChange() {
 const { refetchProfile } = useAuth();
 const [password, setPassword] = useState("");
 const [confirmation, setConfirmation] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [busy, setBusy] = useState(false);
 const changePassword = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault(); setError(null);
  if (password !== confirmation) { setError("The passwords do not match."); return; }
  setBusy(true);
  try { await apiRequest("/auth/password/change", { method: "POST", body: JSON.stringify({ new_password: password }) }); await refetchProfile(); }
  catch (err) { setError(err instanceof Error ? err.message : "Could not update your password."); }
  finally { setBusy(false); }
 };
 return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-4" role="dialog" aria-modal="true" aria-labelledby="required-password-title">
  <form onSubmit={changePassword} className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-xl">
   <h1 id="required-password-title" className="text-xl font-semibold">Change your temporary password</h1>
   <p className="text-sm text-muted-foreground">An administrator reset your password. Choose a new password to continue.</p>
   <label className="block space-y-2 text-sm font-medium"><span>New password</span><input autoFocus type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><span className="text-xs text-muted-foreground font-normal">Use at least 12 characters.</span></label>
   <label className="block space-y-2 text-sm font-medium"><span>Confirm new password</span><input type="password" required minLength={12} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>
   {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
   <Button type="submit" disabled={busy} className="w-full">{busy ? "Updating password…" : "Update password and continue"}</Button>
  </form></div>;
}
