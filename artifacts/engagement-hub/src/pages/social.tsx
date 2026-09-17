import { useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/post-card";
import { motion } from "framer-motion";
import { X, Rss } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { usePostsFeed, useCreatePost } from "@/hooks/use-posts";
import { imageFromClipboard } from "@/lib/clipboard-image";
import { ImagePickerButton } from "@/components/image-picker-button";

export default function Social() {
  const { session, profile } = useAuth();
  const { data: posts = [], isLoading } = usePostsFeed();
  const createPost = useCreatePost();

  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const setImage = (file: File | null) => {
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
              <div className="flex gap-3">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarFallback className={`text-white font-bold ${colorForId(session.user.id)}`}>
                    {initialsForUsername(profile?.username ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="relative flex-1">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="What's on your mind? (you can paste a picture in here too)"
                    className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 pt-2 pb-14 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                    <ImagePickerButton onImage={setImage} label="Photo" iconOnly />
                    <Button
                      type="submit"
                      className="h-10 rounded-full px-5"
                      disabled={createPost.isPending || (!body.trim() && !imageFile)}
                    >
                      {createPost.isPending ? "Posting..." : "Post"}
                    </Button>
                  </div>
                </div>
              </div>

              {imagePreview && (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={imagePreview} alt="" className="w-full max-h-80 object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
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
              <PostCard post={post} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  );
}
