import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import { useComments } from "@/hooks/use-social";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { getPostImageUrl, useDeletePost, type Post } from "@/hooks/use-posts";

export function PostCard({ post }: { post: Post }) {
  const { session, isAdmin } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const { data: comments = [] } = useComments("post", post.id);
  const deletePost = useDeletePost();
  const isOwner = post.author_id === session?.user.id;
  const canDelete = isOwner || isAdmin;

  return (
    <Card className="shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4 flex items-center gap-3">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarFallback className={`text-white font-bold ${colorForId(post.author_id)}`}>
              {initialsForUsername(post.author?.username ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">@{post.author?.username ?? "unknown"}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
          {canDelete && (
            <button
              onClick={() => window.confirm("Delete this post?") && deletePost.mutate(post.id)}
              className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
              title="Delete post"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {post.body && <p className="px-4 pb-3 text-sm whitespace-pre-wrap">{post.body}</p>}

        {post.image_path && (
          <img src={getPostImageUrl(post.image_path)} alt="" className="w-full max-h-[480px] object-cover" />
        )}

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <ReactionBar targetType="post" targetId={post.id} />
            <button
              onClick={() => setShowComments((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comment"}
              {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {showComments && <CommentSection targetType="post" targetId={post.id} />}
        </div>
      </CardContent>
    </Card>
  );
}
