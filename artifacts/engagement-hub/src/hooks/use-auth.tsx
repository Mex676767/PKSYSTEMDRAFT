import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  email: string;
  username: string | null;
  points: number;
  badges: string[];
  current_streak: number;
  longest_streak: number;
  active_title: string | null;
  unlocked_titles: string[];
  active_accessory: string | null;
  unlocked_accessories: string[];
  is_admin: boolean;
  permissions: string[];
  department: string | null;
  role: string | null;
  is_deleted: boolean;
  birthday: string | null;
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-pink-500",
  "bg-emerald-500", "bg-amber-500", "bg-indigo-500", "bg-rose-500",
];

export function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initialsForUsername(username: string) {
  return username.slice(0, 2).toUpperCase() || "?";
}

// 3-20 chars, letters/numbers/underscore only.
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  claimUsername: (username: string) => Promise<{ error: string | null }>;
  refetchProfile: () => Promise<void>;
  isAdmin: boolean;
  hasPermission: (perm: string) => boolean;
  deactivatedNotice: boolean;
  dismissDeactivatedNotice: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivatedNotice, setDeactivatedNotice] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Failed to load profile", error);
      return null;
    }
    return data as Profile;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    setLoading(true);

    fetchProfile(session.user.id).then((p) => {
      if (cancelled) return;
      if (p?.is_deleted) {
        // Deactivated accounts can't meaningfully be blocked at the RLS
        // level without touching every table's policies, so this is the
        // primary enforcement: sign them straight back out client-side.
        setDeactivatedNotice(true);
        setProfile(null);
        setLoading(false);
        supabase.auth.signOut();
        return;
      }
      setProfile(p);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [session, fetchProfile]);

  // Once per session, try to claim today's login bonus. The RPC itself is
  // idempotent (safe to call repeatedly -- it just returns false if today's
  // bonus is already claimed), but we still only bother calling it once
  // per browser session rather than on every mount.
  useEffect(() => {
    if (!session || !profile?.username) return;

    let cancelled = false;
    supabase.rpc("claim_daily_login_bonus").then(({ data: claimed, error }) => {
      if (cancelled || error) return;
      if (claimed) {
        fetchProfile(session.user.id).then((p) => {
          if (!cancelled && p) setProfile(p);
        });
        queryClient.invalidateQueries({ queryKey: ["point-history", session.user.id] });
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, !!profile?.username]);

  const refetchProfile = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    if (p) setProfile(p);
  }, [session, fetchProfile]);

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    return { error: error?.message ?? null };
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const claimUsername = async (username: string) => {
    if (!session) return { error: "Not signed in." };
    if (!USERNAME_PATTERN.test(username)) {
      return { error: "Username must be 3-20 characters: letters, numbers, or underscore only." };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ username })
      .eq("id", session.user.id)
      .select()
      .single();

    if (error) {
      // Postgres unique_violation
      if (error.code === "23505") {
        return { error: "That username is already taken. Try another." };
      }
      return { error: error.message };
    }

    setProfile(data as Profile);
    return { error: null };
  };

  const isAdmin = profile?.is_admin ?? false;
  const hasPermission = useCallback(
    (perm: string) => isAdmin || (profile?.permissions?.includes(perm) ?? false),
    [isAdmin, profile]
  );
  const dismissDeactivatedNotice = useCallback(() => setDeactivatedNotice(false), []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signInWithEmail,
        signInWithPassword,
        signOut,
        claimUsername,
        refetchProfile,
        isAdmin,
        hasPermission,
        deactivatedNotice,
        dismissDeactivatedNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
