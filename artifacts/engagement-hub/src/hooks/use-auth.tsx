import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";

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
  avatar_url: string | null;
  unlocked_borders: string[];
  active_border: string | null;
  is_approved: boolean;
};

export type AuthSession = {
  user: {
    id: string;
    email: string;
    identities: { provider: string }[];
  };
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

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

type AuthState = {
  session: AuthSession | null;
  profile: Profile | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  claimUsername: (username: string) => Promise<{ error: string | null }>;
  refetchProfile: () => Promise<void>;
  isAdmin: boolean;
  hasPermission: (perm: string) => boolean;
  deactivatedNotice: boolean;
  dismissDeactivatedNotice: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

type CurrentUserResponse = {
  tenant: string;
  user: Profile & { identities: { provider: string }[] };
};

async function getCurrentUser() {
  return apiRequest<CurrentUserResponse>("/auth/me", { headers: { "Cache-Control": "no-store" } });
}

function toSession(user: CurrentUserResponse["user"]): AuthSession {
  return { user: { id: user.id, email: user.email, identities: user.identities ?? [] } };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivatedNotice, setDeactivatedNotice] = useState(false);

  const refetchProfile = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      setSession(toSession(current.user));
      setProfile(current.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession(null);
        setProfile(null);
        return;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(({ user }) => {
        if (cancelled) return;
        setSession(toSession(user));
        setProfile(user);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error("Could not restore the DigitalOcean session", error);
        }
        setSession(null);
        setProfile(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!session?.user.id || !profile?.username || !profile.is_approved) return;
    let cancelled = false;
    apiRequest<{ claimed: boolean }>("/auth/daily-login", { method: "POST" })
      .then(({ claimed }) => {
        if (!cancelled && claimed) {
          void refetchProfile();
          queryClient.invalidateQueries({ queryKey: ["point-history", session.user.id] });
        }
      })
      .catch((error) => console.error("Could not update the daily login streak", error));
    return () => { cancelled = true; };
  }, [profile?.is_approved, profile?.username, queryClient, refetchProfile, session?.user.id]);

  const signInWithPassword = async (email: string, password: string) => {
    try {
      await apiRequest("/auth/password/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await refetchProfile();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Sign-in failed. Please try again." };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { authorization_url } = await apiRequest<{ authorization_url: string }>("/auth/google/start", { method: "POST" });
      window.location.assign(authorization_url);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Google sign-in failed. Please try again." };
    }
  };

  const signOut = async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      setSession(null);
      setProfile(null);
      queryClient.clear();
    }
  };

  const claimUsername = async (username: string) => {
    if (!session) return { error: "Not signed in." };
    if (!USERNAME_PATTERN.test(username)) {
      return { error: "Username must be 3-20 characters: letters, numbers, or underscore only." };
    }
    try {
      await apiRequest("/auth/username", { method: "PUT", body: JSON.stringify({ username }) });
      await refetchProfile();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not update username." };
    }
  };

  const isAdmin = profile?.is_admin ?? false;
  const hasPermission = useCallback(
    (perm: string) => isAdmin || (profile?.permissions?.includes(perm) ?? false),
    [isAdmin, profile],
  );
  const dismissDeactivatedNotice = useCallback(() => setDeactivatedNotice(false), []);

  return (
    <AuthContext.Provider value={{
      session, profile, loading, signInWithPassword, signInWithGoogle, signOut,
      claimUsername, refetchProfile, isAdmin, hasPermission, deactivatedNotice, dismissDeactivatedNotice,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
