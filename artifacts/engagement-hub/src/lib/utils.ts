import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Supabase RPC/query errors (PostgrestError) carry a `.message` but aren't
// always a true `instanceof Error` depending on version, so a plain
// `err instanceof Error` check can silently swallow the real reason. This
// checks for a usable message on any error shape before falling back.
export function getErrorMessage(err: unknown, fallback = "Something went wrong") {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) {
    return err.message;
  }
  if (typeof err === "string" && err) return err;
  return fallback;
}
