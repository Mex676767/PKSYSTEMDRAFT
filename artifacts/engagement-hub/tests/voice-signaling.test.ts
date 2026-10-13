import assert from "node:assert/strict";
import { test } from "node:test";
import { createSignalInbox, startVoicePolling } from "../src/lib/voice-signaling.ts";

test("lost exchange response preserves acknowledgments and subsequent delivery", async () => {
  const sent: string[][] = [];
  const handled: string[] = [];
  let call = 0;
  const poll = createSignalInbox<string>(async (ack) => {
    sent.push([...ack]);
    call++;
    if (call === 2) throw new Error("connection reset");
    return call === 1 ? [{ id: "8", payload: "offer" }] : [{ id: "9", payload: "candidate" }];
  }, async (payload) => { handled.push(payload); }, assert.fail);
  const signal = new AbortController().signal;
  await poll(signal);
  await assert.rejects(poll(signal));
  await poll(signal);
  assert.deepEqual(sent, [[], ["8"], ["8"]]);
  assert.deepEqual(handled, ["offer", "candidate"]);
});

test("a bad signal does not discard the remainder of the batch", async () => {
  const handled: string[] = [];
  const errors: unknown[] = [];
  const poll = createSignalInbox<string>(async () => [
    { id: "1", payload: "bad offer" }, { id: "2", payload: "candidate" },
  ], async (payload) => {
    if (payload === "bad offer") throw new Error("stale SDP");
    handled.push(payload);
  }, (error) => errors.push(error));
  await poll(new AbortController().signal);
  assert.equal(errors.length, 1);
  assert.deepEqual(handled, ["candidate"]);
});

test("leaving during a request prevents handling stale signals", async () => {
  const controller = new AbortController();
  const poll = createSignalInbox(async () => {
    controller.abort();
    return [{ id: "1", payload: "stale" }];
  }, async () => assert.fail("handled after leaving"), assert.fail);
  await poll(controller.signal);
});

test("slow polls cannot overlap, and cancellation prevents rescheduling", async () => {
  let calls = 0;
  let finish!: () => void;
  let requestSignal!: AbortSignal;
  const stop = startVoicePolling(async (signal) => {
    calls++;
    requestSignal = signal;
    await new Promise<void>((resolve) => { finish = resolve; });
  }, () => 1, assert.fail);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(calls, 1);
  stop();
  assert.equal(requestSignal.aborted, true);
  finish();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(calls, 1);
});
