import { useEffect, useRef } from "react";
import { registerSW } from "virtual:pwa-register";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function SwUpdatePrompt() {
  const notified = useRef(false);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        if (notified.current) return;
        notified.current = true;
        toast({
          title: "Update available",
          description: "A new version of the app is ready. Your unsaved drafts are safe either way.",
          action: (
            <ToastAction altText="Reload now" onClick={() => updateSW(true)}>
              Reload
            </ToastAction>
          ),
        });
      },
    });
  }, []);

  return null;
}
