import { useEffect, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ContactEmailCard() {
  const { profile, refetchProfile } = useAuth();
  const [email, setEmail] = useState(profile?.email ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setEmail(profile?.email ?? ""), [profile?.email]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      await apiRequest("/auth/email", { method: "PUT", body: JSON.stringify({ email: email.trim() || null }) });
      await refetchProfile(); setMessage("Email saved. Password recovery and birthday emails will use this address.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save your email."); }
    finally { setBusy(false); }
  }
  return <Card className="border-primary/20 shadow-sm">
    <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Mail className="w-5 h-5 text-primary" /> Recovery and birthday email</CardTitle><CardDescription>Add or change the address where you can reset your password and receive birthday emails. Leave it blank to remove it.</CardDescription></CardHeader>
    <CardContent><form onSubmit={submit} className="space-y-3"><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save email"}</Button>{message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form></CardContent>
  </Card>;
}
