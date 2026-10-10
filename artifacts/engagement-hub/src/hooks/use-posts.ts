import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiAssetUrl, apiRequest, uploadImage } from "@/lib/api";

export type PostCategory = "general" | "desk_setup";

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
        const ext = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        image_path = (await uploadImage(`/files/${encodeURIComponent(session.user.id)}/${encodeURIComponent(`${Date.now()}.${ext}`)}`, imageFile)).path;
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
