import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type AccessoryCatalogItem = {
  key: string;
  emoji: string;
  name: string;
  price: number;
};

export function useAccessoryCatalog() {
  return useQuery({
    queryKey: ["accessory-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accessory_catalog")
        .select("*")
        .order("price");
      if (error) throw error;
      return data as AccessoryCatalogItem[];
    },
  });
}

export function usePurchaseAccessory() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (accessoryKey: string) => {
      const { error } = await supabase.rpc("purchase_accessory", { accessory_key: accessoryKey });
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useSetActiveAccessory() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (accessoryKey: string | null) => {
      const { error } = await supabase.rpc("set_active_accessory", { accessory_key: accessoryKey });
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useSetActiveTitle() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (titleKey: string | null) => {
      const { error } = await supabase.rpc("set_active_title", { title_key: titleKey });
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}

export type BorderCatalogItem = {
  key: string;
  name: string;
  price: number;
};

export function useBorderCatalog() {
  return useQuery({
    queryKey: ["border-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("border_catalog")
        .select("*")
        .order("price");
      if (error) throw error;
      return data as BorderCatalogItem[];
    },
  });
}

export function usePurchaseBorder() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (borderKey: string) => {
      const { error } = await supabase.rpc("purchase_border", { border_key: borderKey });
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useSetActiveBorder() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (borderKey: string | null) => {
      const { error } = await supabase.rpc("set_active_border", { border_key: borderKey });
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}

// Storage upload + profile row update, matching the trust level of
// claimUsername (a direct update to the caller's own row) -- there's no
// server-side validation this actually came through the upload flow, same
// tradeoff as every other free-text profile field.
export function useUploadAvatar() {
  const { session, refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!session) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${session.user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new photo shows immediately instead of the
      // browser (or a CDN) serving the previous upload at the same path.
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", session.user.id);
      if (updateError) throw updateError;

      return avatarUrl;
    },
    onSuccess: () => refetchProfile(),
  });
}
