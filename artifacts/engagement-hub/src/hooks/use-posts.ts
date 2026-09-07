import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type Post = {
  id: string;
  author_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
  author: { username: string | null } | null;
};

const POST_SELECT = "*, author:profiles(username)";

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
    mutationFn: async ({ body, imageFile }: { body: string; imageFile: File | null }) => {
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
        .insert({ author_id: session.user.id, body: body || null, image_path })
        .select(POST_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as Post;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts-feed"] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts-feed"] }),
  });
}
