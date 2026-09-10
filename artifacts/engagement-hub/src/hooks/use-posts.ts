import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type PostCategory = "general" | "desk_setup";

export type Post = {
  id: string;
  author_id: string;
  body: string | null;
  image_path: string | null;
  category: PostCategory;
  created_at: string;
  author: { username: string | null } | null;
};

// !inner means a post from a hidden (e.g. deactivated) author drops out of
// the feed entirely, instead of showing up with a blank author.
const POST_SELECT = "*, author:profiles!inner(username)";

export function usePostsFeed() {
  return useQuery({
    queryKey: ["posts-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Post[];
    },
  });
}

export function getPostImageUrl(path: string) {
  return supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
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
        const ext = imageFile.name.split(".").pop() ?? "jpg";
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("post-images").upload(path, imageFile);
        if (uploadError) throw uploadError;
        image_path = path;
      }

      const { data, error } = await supabase
        .from("posts")
        .insert({ author_id: session.user.id, body: body || null, image_path, category })
        .select(POST_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as Post;
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
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts-feed"] });
      qc.invalidateQueries({ queryKey: ["desk-setup-entries"] });
    },
  });
}

export type DeskSetupEntry = Post & { vote_count: number };

// The reactions table is a generic (target_type, target_id) pair with no
// real foreign key to posts, so PostgREST can't embed/aggregate it for us --
// fetch entries and their reaction counts separately and join client-side.
export function useDeskSetupEntries() {
  return useQuery({
    queryKey: ["desk-setup-entries"],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("category", "desk_setup")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (posts ?? []).map((p) => p.id);
      const counts: Record<string, number> = {};

      if (ids.length > 0) {
        const { data: reactions, error: reactionsError } = await supabase
          .from("reactions")
          .select("target_id")
          .eq("target_type", "post")
          .in("target_id", ids);
        if (reactionsError) throw reactionsError;
        for (const r of reactions ?? []) {
          counts[r.target_id] = (counts[r.target_id] ?? 0) + 1;
        }
      }

      const entries = (posts as unknown as Post[]).map((p) => ({
        ...p,
        vote_count: counts[p.id] ?? 0,
      }));
      entries.sort((a, b) => b.vote_count - a.vote_count);
      return entries as DeskSetupEntry[];
    },
  });
}
