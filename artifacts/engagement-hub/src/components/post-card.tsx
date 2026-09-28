import { memo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import type { Reaction } from "@/hooks/use-social";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { getPostImageUrl, useDeletePost, type Post } from "@/hooks/use-posts";

function PostCardComponent({ post, commentCount, reactions }: { post: Post; commentCount: number; reactions: Reaction[] }) {
  const { session, isAdmin } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const deletePost = useDeletePost();
  const isOwner = post.author_id === session?.user.id;
  const canDelete = isOwner || isAdmin;

  return (
    <Card className="render-when-visible shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4 flex items-center gap-3">
          <UserAvatar
            user={{ name: post.author?.username ?? "unknown", initials: initialsForUsername(post.author?.username ?? "?"), color: colorForId(post.author_id) }}
            photoUrl={post.author?.avatar_url ?? null}
            border={post.author?.active_border ?? null}
            accessory={post.author?.active_accessory ?? null}
            className="w-10 h-10 shrink-0"
          />
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
          <img src={getPostImageUrl(post.image_path)} alt="" loading="lazy" decoding="async" className="w-full max-h-[480px] object-cover" />
        )}

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <ReactionBar targetType="post" targetId={post.id} reactions={reactions} />
            <button
              onClick={() => setShowComments((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? "" : "s"}` : "Comment"}
              {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {showComments && <CommentSection targetType="post" targetId={post.id} />}
        </div>
      </CardContent>
    </Card>
  );
}

function sameReactions(previous: Reaction[], next: Reaction[]) {
  return previous.length === next.length && previous.every((reaction, index) => {
    const candidate = next[index];
    return reaction.id === candidate?.id && reaction.emoji === candidate.emoji && reaction.user_id === candidate.user_id;
  });
}

export const PostCard = memo(
  PostCardComponent,
  (previous, next) =>
    previous.post === next.post &&
    previous.commentCount === next.commentCount &&
    sameReactions(previous.reactions, next.reactions),
);
PostCard.displayName = "PostCard";
