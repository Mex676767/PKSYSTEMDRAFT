import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

// Shared between goals and challenges (same target_type/target_id pattern as
// comments/reactions in use-social.ts) rather than two near-identical tables.
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

// Reuses the existing "post-images" bucket (see use-posts.ts) instead of a
// new bucket -- its storage policy keys off the uploader's own user id as
// the first path segment, which the upload path below matches, so no new
// bucket/storage policies are needed.
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

// Plain (non-hook) upload, so callers that aren't bound to one fixed
// target_id up front -- e.g. attaching a photo right when a goal/challenge is
// first created, before its own ProgressPhotos instance ever mounts -- can
// still reuse the exact same upload+insert logic as useAddProgressPhoto.
export async function uploadProgressPhoto({
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
}) {
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

// RLS allows this for the photo's own uploader, or any admin -- see
// progress-photos-setup.sql.
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
