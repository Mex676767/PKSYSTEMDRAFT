import { useEffect, useState } from "react";
import { Clock3, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { BRAND_FULL_NAME, BRAND_LOGO } from "@/lib/brand";

export default function ApprovalPending() {
  const { session, refetchProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    await refetchProfile();
    setChecking(false);
  };

  useEffect(() => {
    const interval = window.setInterval(() => void refetchProfile(), 20_000);
    const onFocus = () => void refetchProfile();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refetchProfile]);

  return (
    <main className="min-h-[100dvh] app-gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/25 bg-card/95 shadow-2xl">
        <CardContent className="p-7 text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <img src={BRAND_LOGO} alt="" className="h-12 w-12 rounded-xl" />
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Secure access</p>
              <h1 className="text-xl font-bold">{BRAND_FULL_NAME}</h1>
            </div>
          </div>

          <div className="mx-auto relative w-fit">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
            <span className="absolute -right-1 -bottom-1 h-8 w-8 rounded-full bg-amber-500 text-black flex items-center justify-center ring-4 ring-card">
              <Clock3 className="h-4 w-4" />
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Waiting for approval</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your account has been registered. An administrator must approve it before you can enter the employee hub.
            </p>
            {session?.user.email && <p className="text-sm font-medium break-all">{session.user.email}</p>}
          </div>

          <div className="space-y-2">
            <Button className="w-full" onClick={checkStatus} disabled={checking}>
              <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking..." : "Check approval status"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
