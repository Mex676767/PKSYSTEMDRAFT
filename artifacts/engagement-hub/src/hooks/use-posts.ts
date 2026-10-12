import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiAssetUrl, apiRequest, uploadImage } from "@/lib/api";

export type PostCategory = "general" | "desk_setup";

const POST_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;
const POST_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export function getPostImageError(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type.toLowerCase();
  const supportedMime = mime in POST_IMAGE_TYPES;
  const supportedExtension = ["jpg", "jpeg", "png", "gif", "webp"].includes(extension);
  if ((mime && !supportedMime) || (!mime && !supportedExtension)) {
    return "Use a JPEG, PNG, GIF, or WebP photo. HEIC and AVIF photos are not supported yet.";
  }
  if (file.size > POST_IMAGE_MAX_BYTES) return "This photo is over 20 MB. Choose a smaller photo and try again.";
  return null;
}

function preparePostImage(file: File): { file: File; extension: string } {
  const extensionFromName = file.name.split(".").pop()?.toLowerCase();
  const mimeFromExtension: Record<string, keyof typeof POST_IMAGE_TYPES> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  };
  const mime = (file.type.toLowerCase() in POST_IMAGE_TYPES
    ? file.type.toLowerCase()
    : mimeFromExtension[extensionFromName ?? ""]) as keyof typeof POST_IMAGE_TYPES | undefined;

  const error = getPostImageError(file);
  if (error) throw new Error(error);
  if (!mime || !POST_IMAGE_TYPES[mime]) throw new Error("This photo format is not supported.");

  const extension = POST_IMAGE_TYPES[mime];
  const normalizedFile = file.type === mime ? file : new File([file], `photo.${extension}`, { type: mime });
  return { file: normalizedFile, extension };
}

export type Post = {
  id: string;
  author_id: string;
  body: string | null;
  image_path: string | null;
  category: PostCategory;
  created_at: string;
  author: { username: string | null; avatar_url: string | null; active_border: string | null; active_accessory?: string | null } | null;
};

const POST_SELECT = "*, author:profiles!inner(username, avatar_url, active_border, active_accessory)";

export function usePostsFeed() {
  return useQuery({
    queryKey: ["posts-feed"],
    queryFn: () => apiRequest<Post[]>("/posts"),
    refetchInterval: 30_000,
  });
}

export function getPostImageUrl(path: string) {
  const [owner, ...objectKey] = path.split("/");
  if (!owner || objectKey.length === 0) return "";
  const encodedKey = objectKey.map((segment) => encodeURIComponent(segment)).join("/");
  return apiAssetUrl(`/files/${encodeURIComponent(owner)}/${encodedKey}`);
}

export function usePostById(postId: string | null) {
  return useQuery({
    queryKey: ["post", postId],
    enabled: !!postId,
    queryFn: () => apiRequest<Post>(`/posts/${encodeURIComponent(postId!)}`),
    staleTime: 30_000,
  });
}

export function useCreatePost() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      imageFile,
      category = "general",
    }: {
      body: string;
      imageFile: File | null;
      category?: PostCategory;
    }) => {
      if (!session) throw new Error("Not signed in");

      let image_path: string | null = null;
      if (imageFile) {
        const prepared = preparePostImage(imageFile);
        image_path = (await uploadImage(`/files/${encodeURIComponent(session.user.id)}/${encodeURIComponent(`${crypto.randomUUID()}.${prepared.extension}`)}`, prepared.file)).path;
      }

      return apiRequest<Post>("/posts", { method: "POST", body: JSON.stringify({ body: body || null, image_path, category }) });
    },
    onSuccess: (post) => {
      qc.invalidateQueries({ queryKey: ["posts-feed"] });
      if (post.category === "desk_setup") {
        qc.invalidateQueries({ queryKey: ["desk-setup-entries"] });
      }
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<void>(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts-feed"] });
      qc.invalidateQueries({ queryKey: ["desk-setup-entries"] });
    },
  });
}

export type DeskSetupEntry = Post & { vote_count: number };

export function useDeskSetupEntries() {
  return useQuery({
    queryKey: ["desk-setup-entries"],
    queryFn: () => apiRequest<DeskSetupEntry[]>("/posts/desk-setup"),
    refetchInterval: 30_000,
  });
}
