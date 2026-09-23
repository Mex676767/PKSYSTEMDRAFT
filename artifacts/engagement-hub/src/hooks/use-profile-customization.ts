import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

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

export function useUploadAvatar() {
  const { session, refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!session) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${session.user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
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

export function useSetAvatarUrl() {
  const { session, refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (avatarUrl: string | null) => {
      if (!session) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", session.user.id);
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}
