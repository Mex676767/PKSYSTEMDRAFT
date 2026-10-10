import { useMutation } from "@tanstack/react-query";
import { apiAssetUrl, apiRequest, uploadImage } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export function useSetActiveAccessory() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (accessoryKey: string | null) => {
      await apiRequest<void>("/profile/customization/accessory", { method: "PATCH", body: JSON.stringify({ value: accessoryKey }) });
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useSetActiveTitle() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (titleKey: string | null) => {
      await apiRequest<void>("/profile/customization/title", { method: "PATCH", body: JSON.stringify({ value: titleKey }) });
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useSetActiveBorder() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (borderKey: string | null) => {
      await apiRequest<void>("/profile/customization/border", { method: "PATCH", body: JSON.stringify({ value: borderKey }) });
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useUploadAvatar() {
  const { session, refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!session) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const stored = await uploadImage(`/files/${encodeURIComponent(session.user.id)}/${encodeURIComponent(`avatar.${ext}`)}`, file);
      const [owner, name] = stored.path.split("/", 2);
      const avatarUrl = `${apiAssetUrl(`/files/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(name ?? "")}`)}?t=${Date.now()}`;
      await apiRequest<void>("/profile/avatar-url", { method: "PATCH", body: JSON.stringify({ avatar_url: avatarUrl }) });

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
      await apiRequest<void>("/profile/avatar-url", { method: "PATCH", body: JSON.stringify({ avatar_url: avatarUrl }) });
    },
    onSuccess: () => refetchProfile(),
  });
}
