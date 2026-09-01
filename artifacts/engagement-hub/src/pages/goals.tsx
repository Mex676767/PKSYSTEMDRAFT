import { useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useGoals, useUpdateGoal, useCreateGoal } from "@/hooks/use-mock-api";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Plus, Target, Clock } from "lucide-react";
import { format, isPast } from "date-fns";
import { Confetti } from "@/components/confetti";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Goals() {
  const { data: goals = [], isLoading } = useGoals();
  const updateGoal = useUpdateGoal();
  const createGoal = useCreateGoal();
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<'Small Goals' | 'Big Goals'>('Small Goals');

  const handleToggleGoal = (id: string, currentProgress: number, completed: boolean) => {
    if (completed) return; // Don't un-complete for now in this mock
    
    // If it's a small goal, complete it immediately. Big goals increment by 20%.
    const isSmall = goals.find(g => g.id === id)?.type === 'Small Goals';
    const newProgress = isSmall ? 100 : Math.min(100, currentProgress + 20);
    const isNowCompleted = newProgress === 100;
    
    if (isNowCompleted) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
    
    updateGoal.mutate({ id, updates: { progress: newProgress, completed: isNowCompleted } });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    createGoal.mutate({
      title: newTitle,
      description: newDesc,
      type: newType,
      progress: 0,
      deadline: new Date(Date.now() + 86400000 * 7).toISOString(), // 1 week
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setNewTitle("");
        setNewDesc("");
      }
    });
  };

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;

  const activeGoals = goals.filter(g => !g.completed);
  const completedGoals = goals.filter(g => g.completed);

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <Confetti active={showConfetti} />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Your Goals</h1>
          <p className="text-muted-foreground mt-1">Track your progress and celebrate wins.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 hover-elevate">
              <Plus className="w-4 h-4 mr-2" /> New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Goal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                  placeholder="e.g., Ship feature X"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                  placeholder="Details..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant={newType === 'Small Goals' ? 'default' : 'outline'} 
                    onClick={() => setNewType('Small Goals')}
                    className="flex-1"
                  >
                    Small Win
                  </Button>
                  <Button 
                    type="button" 
                    variant={newType === 'Big Goals' ? 'default' : 'outline'} 
                    onClick={() => setNewType('Big Goals')}
                    className="flex-1"
                  >
                    Big Milestone
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full mt-4" disabled={createGoal.isPending}>
                {createGoal.isPending ? 'Creating...' : 'Create Goal'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Active Goals
          </h2>
          {activeGoals.length === 0 ? (
            <div className="p-8 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground">
              No active goals right now. Ready to conquer something new?
            </div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4">
              {activeGoals.map(goal => (
                <motion.div key={goal.id} variants={slideUp} whileHover={{ y: -2 }}>
                  <Card className={cn(
                    "border-l-4 shadow-sm hover:shadow-md transition-all bg-gradient-to-r to-card",
                    goal.type === 'Big Goals' ? "border-l-secondary from-secondary/10" : "border-l-primary from-primary/10"
                  )}>
                    <CardContent className="p-4 md:p-6 flex flex-col md:flex-row gap-4 md:items-center">
                      <button
                        onClick={() => handleToggleGoal(goal.id, goal.progress, goal.completed)}
                        disabled={updateGoal.isPending}
                        className={cn(
                          "shrink-0 transition-colors focus:outline-none disabled:opacity-50 hover:scale-110 transition-transform",
                          goal.type === 'Big Goals' ? "text-secondary hover:text-secondary/80" : "text-primary hover:text-primary/80"
                        )}
                      >
                        <Circle className="w-8 h-8 stroke-2" />
                      </button>
                      
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-lg truncate">{goal.title}</h3>
                          <Badge variant={goal.type === 'Big Goals' ? 'secondary' : 'outline'}>{goal.type}</Badge>
                          {isPast(new Date(goal.deadline)) && (
                            <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{goal.description}</p>
                        
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1 font-medium text-muted-foreground">
                              <span>Progress</span>
                              <span>{goal.progress}%</span>
                            </div>
                            <Progress value={goal.progress} className="h-2" 
                              indicatorClassName={goal.type === 'Big Goals' ? 'bg-secondary' : 'bg-primary'} />
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            <Clock className="w-3 h-3 mr-1" />
                            {format(new Date(goal.deadline), 'MMM d')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {completedGoals.length > 0 && (
          <div className="opacity-70">
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Completed
            </h2>
            <div className="grid gap-3">
              {completedGoals.map(goal => (
                <Card key={goal.id} className="bg-muted/30 border-transparent shadow-none">
                  <CardContent className="p-4 flex items-center gap-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-through text-muted-foreground">{goal.title}</h3>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}