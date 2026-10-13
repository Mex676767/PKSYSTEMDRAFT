export type SignalEnvelope<T> = { id: string; payload: T };

/** Keep acknowledgments until the next exchange succeeds, including lost responses. */
export function createSignalInbox<T>(
  exchange: (ack: string[], signal: AbortSignal) => Promise<SignalEnvelope<T>[]>,
  handle: (payload: T) => Promise<void>,
  onError: (error: unknown) => void,
) {
  let acknowledged: string[] = [];
  return async (signal: AbortSignal) => {
    const rows = await exchange(acknowledged, signal);
    if (signal.aborted) return;
    const previous = new Set(acknowledged);
    acknowledged = [];
    for (const row of rows) {
      if (signal.aborted) return;
      if (!previous.has(row.id)) {
        try { await handle(row.payload); }
        catch (error) { onError(error); }
      }
      // A malformed/stale signal must not starve later ICE candidates. Failed
      // peer negotiations recover through the connection retry mechanism.
      acknowledged.push(row.id);
    }
  };
}

/** One in-flight poll at a time, with cancellation and bounded outage backoff. */
export function startVoicePolling(
  poll: (signal: AbortSignal) => Promise<void>,
  delay: () => number,
  onError: (error: unknown) => void,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  const tick = async () => {
    try {
      await poll(controller.signal);
      failures = 0;
    } catch (error) {
      if (!controller.signal.aborted) {
        failures = Math.min(failures + 1, 4);
        onError(error);
      }
    } finally {
      if (!controller.signal.aborted) {
        timer = setTimeout(() => void tick(), Math.min(delay() * 2 ** failures, 10_000));
      }
    }
  };
  void tick();
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
}
