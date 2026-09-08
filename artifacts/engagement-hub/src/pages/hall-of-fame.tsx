import { useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HofCategoryCard } from "@/components/hof-category-card";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useHofCategories, useCurrentHofRecords, useCreateHofCategory } from "@/hooks/use-hall-of-fame";
import { HOF_ICON_OPTIONS, getHofIcon } from "@/lib/icon-map";

export default function HallOfFame() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_hall_of_fame");
  const { data: categories = [], isLoading: loadingCategories } = useHofCategories();
  const { data: currentRecords = [] } = useCurrentHofRecords();
  const createCategory = useCreateHofCategory();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<(typeof HOF_ICON_OPTIONS)[number]>(HOF_ICON_OPTIONS[0]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createCategory.mutate(
      { name: name.trim(), description: description.trim(), icon },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setName("");
          setDescription("");
          setIcon(HOF_ICON_OPTIONS[0]);
        },
      }
    );
  };

  if (loadingCategories) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-accent/20" /></div>;
  }

  return (
    <PageTransition className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Badge variant="accent" className="mb-2">🏆 Company Record Book</Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Hall of Fame</h1>
          <p className="text-muted-foreground mt-1">Every category has a champion. Come take their spot.</p>
        </div>

        {canManage && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="shrink-0 hover-elevate">
              <Plus className="w-4 h-4 mr-2" /> New Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a Record Category</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fastest PR Merge"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this record measure?"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Icon</label>
                <div className="grid grid-cols-8 gap-2">
                  {HOF_ICON_OPTIONS.map((opt) => {
                    const OptIcon = getHofIcon(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setIcon(opt)}
                        className={`aspect-square rounded-lg border flex items-center justify-center transition-colors ${
                          icon === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                        title={opt}
                      >
                        <OptIcon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button type="submit" className="w-full mt-4" disabled={createCategory.isPending}>
                {createCategory.isPending ? "Creating..." : "Create Category"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="p-12 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground">
          No categories yet. {canManage ? "Add the first one!" : "Check back soon."}
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {categories.map((category) => (
            <motion.div key={category.id} variants={slideUp}>
              <HofCategoryCard
                category={category}
                current={currentRecords.find((r) => r.category_id === category.id) ?? null}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  );
}
