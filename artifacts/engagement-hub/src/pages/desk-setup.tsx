import { useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ReactionBar } from "@/components/social/reaction-bar";
import { ArrowLeft, Monitor, Image as ImageIcon, X, Trophy } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useDeskSetupEntries, useCreatePost, getPostImageUrl } from "@/hooks/use-posts";
import { cn } from "@/lib/utils";

const RANK_STYLES = [
  "border-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.15)]",
  "border-slate-300/60",
  "border-amber-600/50",
];

export default function DeskSetup() {
  const { session } = useAuth();
  const { data: entries = [], isLoading } = useDeskSetupEntries();
  const createPost = useCreatePost();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) return;
    createPost.mutate(
      { body: caption.trim(), imageFile, category: "desk_setup" },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setCaption("");
          clearImage();
        },
      }
    );
  };

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <Link href="/games" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Games
      </Link>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="w-7 h-7 text-secondary" /> Best WFH Desk Setup
          </h1>
          <p className="text-muted-foreground mt-1">Show it off. React to vote for your favorites.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" disabled={!session} className="shrink-0 hover-elevate">
              <ImageIcon className="w-4 h-4 mr-2" /> Submit Your Setup
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Your Setup</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={imagePreview} alt="" className="w-full max-h-64 object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-sm">Add a photo of your setup</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Tell us about your setup (optional)"
                maxLength={200}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />

              <Button type="submit" className="w-full" disabled={!imageFile || createPost.isPending}>
                {createPost.isPending ? "Submitting..." : "Submit Entry"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-secondary/20" /></div>
      ) : entries.length === 0 ? (
        <div className="p-12 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground">
          No entries yet. {session ? "Be the first to show off your desk!" : "Sign in to submit one."}
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {entries.map((entry, i) => (
            <motion.div key={entry.id} variants={slideUp}>
              <Card className={cn("overflow-hidden shadow-sm hover:shadow-md transition-shadow", i < 3 && `border-2 ${RANK_STYLES[i]}`)}>
                <div className="relative">
                  {entry.image_path && (
                    <img src={getPostImageUrl(entry.image_path)} alt="" className="w-full h-56 object-cover" />
                  )}
                  {i < 3 && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full">
                      <Trophy className="w-3 h-3 text-yellow-400" /> #{i + 1}
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarFallback className={cn("text-white text-[10px] font-bold", colorForId(entry.author_id))}>
                        {initialsForUsername(entry.author?.username ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">@{entry.author?.username ?? "unknown"}</span>
                  </div>
                  {entry.body && <p className="text-sm text-muted-foreground">{entry.body}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <ReactionBar targetType="post" targetId={entry.id} />
                    <span className="text-xs font-semibold text-muted-foreground shrink-0">
                      {entry.vote_count} vote{entry.vote_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  );
}
