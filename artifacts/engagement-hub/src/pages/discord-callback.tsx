import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export default function DiscordCallback() {
  const { refetchProfile } = useAuth();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setStatus("error");
      setError("No authorization code from Discord.");
      return;
    }

    supabase.functions.invoke("discord-oauth", { body: { code } }).then(async ({ error }) => {
      if (error) {
        setStatus("error");
        setError(error.message);
        return;
      }
      await refetchProfile();
      navigate("/");
    });
  }, [navigate, refetchProfile]);

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 app-gradient-bg">
      <div className="text-center max-w-sm">
        <div className="bg-primary text-primary-foreground w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-7 h-7" />
        </div>
        {status === "working" ? (
          <>
            <h1 className="text-xl font-bold">Connecting Discord...</h1>
            <p className="text-muted-foreground mt-1 text-sm">Hang tight, this only takes a second.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Couldn't connect Discord</h1>
            <p className="text-muted-foreground mt-1 text-sm">{error}</p>
            <Button className="mt-4" onClick={() => navigate("/")}>Back to app</Button>
          </>
        )}
      </div>
    </div>
  );
}
