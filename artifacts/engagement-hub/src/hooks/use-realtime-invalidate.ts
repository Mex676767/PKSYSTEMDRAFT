import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

// Temporary cross-backend refresh mechanism while the app moves off Supabase
// Realtime. TanStack only refetches active queries, and the interval is modest
// to avoid multiplying requests across mounted pages.
export function useRealtimeInvalidate(_table: string, queryKeys: QueryKey[]) {
  const qc = useQueryClient();
  useEffect(() => {
    const timer = window.setInterval(() => {
        for (const key of queryKeys) qc.invalidateQueries({ queryKey: key });
    }, 30_000);
    return () => {
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_table, qc]);
}
