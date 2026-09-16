import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type ProgressPhotoTargetType = "goal" | "challenge";

export type ProgressPhoto = {
  id: string;
  target_type: ProgressPhotoTargetType;
  target_id: string;
  uploader_id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
  uploader: { username: string | null } | null;
};

export function getProgressPhotoUrl(path: string) {
  return supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
}

export function useProgressPhotos(targetType: ProgressPhotoTargetType, targetId: string) {
  return useQuery({
    queryKey: ["progress-photos", targetType, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_photos")
        .select("*, uploader:profiles(username)")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as ProgressPhoto[];
    },
  });
}

export async function uploadProgressPhoto(
  {
    targetType,
    targetId,
    file,
    userId,
    caption,
  }: {
    targetType: ProgressPhotoTargetType;
    targetId: string;
    file: File;
    userId: string;
    caption?: string;
  }
) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/progress-${targetType}-${targetId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("post-images").upload(path, file);
  if (uploadError) throw uploadError;

  const { error } = await supabase.from("progress_photos").insert({
    target_type: targetType,
    target_id: targetId,
    uploader_id: userId,
    image_path: path,
    caption: caption?.trim() || null,
  });
  if (error) throw error;
}

export function useAddProgressPhoto(targetType: ProgressPhotoTargetType, targetId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      if (!session) throw new Error("Not signed in");
      await uploadProgressPhoto({ targetType, targetId, file, userId: session.user.id, caption });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress-photos", targetType, targetId] }),
  });
}

export function useDeleteProgressPhoto(targetType: ProgressPhotoTargetType, targetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase.from("progress_photos").delete().eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress-photos", targetType, targetId] }),
  });
}
