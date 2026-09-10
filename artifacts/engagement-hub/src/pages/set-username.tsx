import { useState } from "react";
import { motion } from "framer-motion";
import { AtSign, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

// Usernames only allow letters/numbers/underscore -- rather than let people
// type something like "96 Mexha" and only find out it's invalid on submit,
// sanitize as they type: spaces become underscores (keeps their intent
// readable), anything else disallowed is just dropped.
function sanitizeUsername(raw: string) {
  return raw.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
}

export default function SetUsername() {
  const { claimUsername } = useAuth();
  const [username, setUsernameInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error } = await claimUsername(username.trim());
    setSubmitting(false);
    if (error) setError(error);
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
            <AtSign className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Pick a username</h1>
          <p className="text-muted-foreground mt-1">This is how everyone will see you. Choose wisely.</p>
        </div>

        <Card className="border-primary/20 shadow-lg bg-gradient-to-br from-primary/10 via-card to-secondary/10">
          <CardContent className="pt-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-primary" /> Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsernameInput(sanitizeUsername(e.target.value))}
                  placeholder="e.g. code_ninja"
                  autoFocus
                  required
                  maxLength={20}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <p className="text-xs text-muted-foreground">
                  3-20 characters. Letters, numbers, and underscores only.
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full h-11" disabled={submitting}>
                {submitting ? "Checking..." : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" /> Claim username
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
