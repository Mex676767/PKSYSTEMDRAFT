import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, KeyRound, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { BRAND_FULL_NAME, BRAND_LOGO } from "@/lib/brand";
import { apiRequest } from "@/lib/api";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11C3.25 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.27a12 12 0 0 0 0 10.76l4-3.11z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.62l4 3.11C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

export default function Login() {
  const { signInWithPassword, signInWithGoogle, deactivatedNotice, dismissDeactivatedNotice } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const resetToken = new URLSearchParams(window.location.search).get("token");
  const [screen, setScreen] = useState<"login" | "forgot" | "reset">(resetToken ? "reset" : "login");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleError(error);
      setGoogleLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setStatus("sending");
    setError(null);
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) {
      setError(error);
      setStatus("error");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    setNotice(null);
    try {
      const result = await apiRequest<{ message: string }>("/auth/password/forgot", {
        method: "POST", body: JSON.stringify({ email: email.trim() }),
      });
      setNotice(result.message);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a password reset.");
      setStatus("error");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) { setError("This reset link is missing or invalid."); return; }
    if (newPassword !== confirmPassword) { setError("The passwords do not match."); return; }
    setStatus("sending");
    setError(null);
    try {
      await apiRequest("/auth/password/reset", {
        method: "POST", body: JSON.stringify({ token: resetToken, password: newPassword }),
      });
      window.history.replaceState({}, "", window.location.pathname);
      setScreen("login");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password updated. Sign in with your new password.");
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The reset link could not be used.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 app-gradient-bg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {deactivatedNotice && (
          <div className="mb-4 flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1">This account has been deactivated.</p>
            <button onClick={dismissDeactivatedNotice} className="shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="w-24 h-24 flex items-center justify-center mx-auto mb-4">
            <img src={BRAND_LOGO} alt="" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{BRAND_FULL_NAME}</h1>
          <p className="text-muted-foreground mt-1">Goals, challenges, and bragging rights.</p>
        </div>

        <Card className="border-primary/20 shadow-lg bg-gradient-to-br from-primary/10 via-card to-secondary/10">
          <CardContent className="pt-8 pb-8">
            {screen === "login" && <>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 bg-background"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              <GoogleIcon className="w-4 h-4 mr-2" />
              {googleLoading ? "Redirecting..." : "Continue with Google"}
            </Button>
            {googleError && <p className="text-sm text-destructive mt-2">{googleError}</p>}

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" /> Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  required
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" /> Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={status === "sending"}>
                {status === "sending" ? "Signing in..." : "Sign in"}
              </Button>

              <button type="button" className="block mx-auto text-xs text-primary hover:underline" onClick={() => { setScreen("forgot"); setError(null); setNotice(null); }}>Forgot password?</button>

              <p className="text-center text-xs text-muted-foreground">
                No account yet? Use Google above. Password sign-in is for existing accounts only.
              </p>
            </form>
            </>}
            {screen === "forgot" && <form onSubmit={handleForgotPassword} className="space-y-4">
              <h2 className="text-xl font-semibold text-center">Reset your password</h2>
              <p className="text-sm text-center text-muted-foreground">We’ll email a secure reset link if an account matches.</p>
              <label className="block space-y-2 text-sm font-medium"><span>Email address</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>
              <Button type="submit" className="w-full" disabled={status === "sending"}>{status === "sending" ? "Sending..." : "Send reset link"}</Button>
              <button type="button" className="block mx-auto text-xs text-primary hover:underline" onClick={() => setScreen("login")}>Back to sign in</button>
            </form>}
            {screen === "reset" && <form onSubmit={handleResetPassword} className="space-y-4">
              <h2 className="text-xl font-semibold text-center">Choose a new password</h2>
              <label className="block space-y-2 text-sm font-medium"><span>New password</span><input type="password" required minLength={12} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>
              <label className="block space-y-2 text-sm font-medium"><span>Confirm password</span><input type="password" required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>
              <Button type="submit" className="w-full" disabled={status === "sending"}>{status === "sending" ? "Updating..." : "Set new password"}</Button>
            </form>}
            {notice && <p role="status" className="mt-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
