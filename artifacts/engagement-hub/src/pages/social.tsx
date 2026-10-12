import { useEffect, useMemo, useRef, useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/post-card";
import { EmojiPicker } from "@/components/emoji-picker";
import { motion } from "framer-motion";
import { X, Rss } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { usePostsFeed, usePostById, useCreatePost, getPostImageError } from "@/hooks/use-posts";
import { useCommentsForTargets, useReactionsForTargets, type Reaction } from "@/hooks/use-social";
import { imageFromClipboard } from "@/lib/clipboard-image";
import { ImagePickerButton } from "@/components/image-picker-button";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft-storage";

const NEW_POST_DRAFT_KEY = "c9myr:new-post-draft";

export default function Social() {
  const { session, profile } = useAuth();
  const { data: feedPosts = [], isLoading } = usePostsFeed();
  const searchParams = new URLSearchParams(window.location.search);
  const requestedPostId = searchParams.get("post");
  const requestedCommentId = searchParams.get("comment");
  const { data: focusedPost } = usePostById(requestedPostId && !feedPosts.some((post) => post.id === requestedPostId) ? requestedPostId : null);
  const posts = useMemo(() => focusedPost && !feedPosts.some((post) => post.id === focusedPost.id) ? [focusedPost, ...feedPosts] : feedPosts, [feedPosts, focusedPost]);
  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const { data: comments = [] } = useCommentsForTargets("post", postIds);
  const focusCommentId = requestedCommentId;
  const focusedComment = focusCommentId ? comments.find((comment) => comment.id === focusCommentId) : undefined;
  const lastScrolledPostId = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedPostId) {
      lastScrolledPostId.current = null;
      return;
    }
    if (lastScrolledPostId.current === requestedPostId || !posts.some((post) => post.id === requestedPostId)) return;
    if (requestedCommentId && focusedComment) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(`post-${requestedPostId}`);
      if (!target) return;
      lastScrolledPostId.current = requestedPostId;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [focusedComment, posts, requestedCommentId, requestedPostId]);
  const { data: reactions = [] } = useReactionsForTargets("post", postIds);
  const createPost = useCreatePost();

  const commentCountByPost = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comment of comments) counts.set(comment.target_id, (counts.get(comment.target_id) ?? 0) + 1);
    return counts;
  }, [comments]);

  const reactionsByPost = useMemo(() => {
    const grouped = new Map<string, Reaction[]>();
    for (const reaction of reactions) {
      const group = grouped.get(reaction.target_id) ?? [];
      group.push(reaction);
      grouped.set(reaction.target_id, group);
    }
    return grouped;
  }, [reactions]);

  const [body, setBody] = useState(() => loadDraft<string>(NEW_POST_DRAFT_KEY) ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (body.trim()) saveDraft(NEW_POST_DRAFT_KEY, body);
    else clearDraft(NEW_POST_DRAFT_KEY);
  }, [body]);

  const setImage = (file: File | null) => {
    if (file) {
      const error = getPostImageError(file);
      if (error) {
        setImageFile(null);
        setImagePreview(null);
        setImageError(error);
        return;
      }
    }
    setImageError(null);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const file = imageFromClipboard(e);
    if (file) {
      e.preventDefault();
      setImage(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && !imageFile) return;
    createPost.mutate(
      { body: body.trim(), imageFile },
      {
        onSuccess: () => {
          setBody("");
          clearImage();
          clearDraft(NEW_POST_DRAFT_KEY);
        },
      }
    );
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;
  }

  return (
    <PageTransition className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
          <Rss className="w-8 h-8 text-primary" /> Social
        </h1>
        <p className="text-muted-foreground mt-1">Share something with the team.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          {session ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center gap-3">
                <UserAvatar
                  user={{ name: profile?.username ?? "unknown", initials: initialsForUsername(profile?.username ?? "?"), color: colorForId(session.user.id) }}
                  photoUrl={profile?.avatar_url}
                  accessory={profile?.active_accessory}
                  border={profile?.active_border}
                  className="w-10 h-10 shrink-0"
                />
                <div className="flex-1 flex gap-2 items-stretch">
                  <div className="relative flex-1 rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onPaste={handlePaste}
                      placeholder="What's on your mind? (you can paste a picture in here too)"
                      className="h-24 w-full px-3 pt-2 pb-10 pr-12 text-sm bg-transparent focus-visible:outline-none resize-none overflow-y-auto block"
                    />
                    <EmojiPicker className="absolute bottom-1 right-1" onSelect={(emoji) => setBody((value) => `${value}${emoji}`)} />
                  </div>
                  <div className="flex flex-col gap-2 w-20 shrink-0">
                  <ImagePickerButton onImage={setImage} label="Photo" iconOnly accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp" className="h-[calc(50%-4px)] shrink-0" />
                    <Button
                      type="submit"
                      className="h-[calc(50%-4px)] shrink-0 rounded-xl px-2 text-sm"
                      disabled={createPost.isPending || (!body.trim() && !imageFile)}
                    >
                      {createPost.isPending ? "Posting..." : "Post"}
                    </Button>
                  </div>
                </div>
              </div>

              {imagePreview && (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={imagePreview} alt="Photo preview" onError={() => { clearImage(); setImageError("This photo could not be previewed. Choose a JPEG, PNG, GIF, or WebP image."); }} className="w-full max-h-80 object-contain" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {(imageError || createPost.error) && (
                <p role="alert" className="text-sm text-destructive">
                  {imageError ?? (createPost.error instanceof Error ? createPost.error.message : "The post could not be published. Please try again.")}
                </p>
              )}
            </form>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Sign in to post something.</p>
          )}
        </CardContent>
      </Card>

      {posts.length === 0 ? (
        <div className="p-12 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground">
          No posts yet. {session ? "Share the first one!" : "Sign in to post."}
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
          {posts.map((post) => (
            <motion.div key={post.id} variants={slideUp}>
              <PostCard
                post={post}
                commentCount={commentCountByPost.get(post.id) ?? 0}
                reactions={reactionsByPost.get(post.id) ?? []}
                focusCommentId={focusedComment?.target_id === post.id ? focusCommentId : null}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  );
}
