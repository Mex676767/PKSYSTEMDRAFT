import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function ChangePasswordCard() {
  const { session } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Auth identities, not editable profile metadata or an email-domain heuristic.
  const hasEmailIdentity = session?.user.identities?.some(identity => identity.provider === "email");
  if (!hasEmailIdentity) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setSaved(false);
    if (password !== confirmation) {
      setError("New passwords do not match.");
      return;
    }
    if (password === currentPassword) {
      setError("Choose a different password from your current one.");
      return;
    }
    setPending(true);
    try {
      // Supabase verifies the current password and applies its password policy.
      // No reset email is needed, including for accounts with .local addresses.
      const { error: updateError } = await supabase.auth.updateUser({
        current_password: currentPassword,
        password,
      });
      if (updateError) {
        setError(updateError.code === "reauthentication_needed"
          ? "Please sign out and sign in again with your current password, then retry."
          : updateError.message);
        return;
      }
      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><LockKeyhole className="w-5 h-5 text-primary" /> Change password</CardTitle>
        <CardDescription>Update the password you use to sign in with your email address.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" onChange={() => { setSaved(false); setError(null); }}>
          <input type="hidden" name="username" autoComplete="username" value={session?.user.email ?? ""} />
          <fieldset disabled={pending} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" required minLength={8} aria-describedby="password-help" value={password} onChange={event => setPassword(event.target.value)} />
              <p id="password-help" className="text-xs text-muted-foreground">Use at least 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
            </div>
            <Button type="submit">{pending ? "Updating password…" : "Update password"}</Button>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {saved && <p role="status" className="text-sm text-muted-foreground">Password updated. Use your new password next time you sign in.</p>}
        </form>
      </CardContent>
    </Card>
  );
}
