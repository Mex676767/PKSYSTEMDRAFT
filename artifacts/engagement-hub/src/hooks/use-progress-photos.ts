import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiAssetUrl, apiRequest, uploadImage } from "@/lib/api";

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
  const [owner,name]=path.split("/",2);
  return apiAssetUrl(`/files/${encodeURIComponent(owner??"")}/${encodeURIComponent(name??"")}`);
}

export function useProgressPhotos(targetType: ProgressPhotoTargetType, targetId: string) {
  return useQuery({
    queryKey: ["progress-photos", targetType, targetId],
    queryFn: () => apiRequest<ProgressPhoto[]>(`/progress-photos/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`),
    refetchInterval: 30_000,
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
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const name = `progress-${targetType}-${targetId}-${Date.now()}.${ext}`;
  const stored = await uploadImage(`/files/${encodeURIComponent(userId)}/${encodeURIComponent(name)}`,file);
  await apiRequest<void>(`/progress-photos/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,{method:"POST",body:JSON.stringify({image_path:stored.path,caption:caption?.trim()||null})});
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
      await apiRequest<void>(`/progress-photos/${encodeURIComponent(photoId)}`,{method:"DELETE"});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress-photos", targetType, targetId] }),
  });
}
