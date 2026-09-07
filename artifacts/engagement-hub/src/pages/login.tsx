import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Trophy, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function Login() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError(null);
    const { error } = await signInWithEmail(email.trim());
    if (error) {
      setError(error);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 app-gradient-bg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="bg-primary text-primary-foreground w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Engagement Hub</h1>
          <p className="text-muted-foreground mt-1">Goals, challenges, and bragging rights.</p>
        </div>

        <Card className="border-primary/20 shadow-lg bg-gradient-to-br from-primary/10 via-card to-secondary/10">
          <CardContent className="pt-8 pb-8">
            {status === "sent" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-3"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="font-bold text-lg">Check your inbox</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a sign-in link to <strong className="text-foreground">{email}</strong>.
                  Click it to log in — first time here creates your account automatically.
                </p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => { setStatus("idle"); setEmail(""); }}
                >
                  Use a different email
                </Button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <p className="text-xs text-muted-foreground">
                    No account yet? No problem — signing in with a new email creates one.
                  </p>
                </div>

                {status === "error" && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full h-11" disabled={status === "sending"}>
                  {status === "sending" ? (
                    "Sending link..."
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" /> Send sign-in link
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
