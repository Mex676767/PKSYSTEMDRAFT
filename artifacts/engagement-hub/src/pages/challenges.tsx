import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useChallenges, useCreateChallenge, useEmployees, useCurrentUser } from "@/hooks/use-mock-api";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Flame, Plus, Shield, Swords, Users } from "lucide-react";
import { useState } from "react";

export default function Challenges() {
  const { data: challenges = [], isLoading: loadingChall } = useChallenges();
  const { data: employees = [] } = useEmployees();
  const { data: currentUser } = useCurrentUser();
  const createChallenge = useCreateChallenge();
  
  const [filter, setFilter] = useState<'all' | 'Personal' | 'Team' | 'Department'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newType, setNewType] = useState<'Personal' | 'Team' | 'Department'>('Personal');
  const [newName, setNewName] = useState("");
  const [opponent, setOpponent] = useState("");

  const filteredChallenges = challenges.filter(c => filter === 'all' || c.level === filter);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !currentUser) return;
    
    createChallenge.mutate({
      name: newName,
      level: newType,
      sideA: currentUser.id,
      sideB: opponent || 'Someone',
      metric: 'Points',
      reward: 100,
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setNewName("");
      }
    });
  };

  if (loadingChall) return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-secondary/20" /></div>;

  return (
    <PageTransition className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Battle Arena</h1>
          <p className="text-muted-foreground mt-1">Challenge your peers and climb the ranks.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="shrink-0 hover-elevate">
              <Swords className="w-4 h-4 mr-2" /> Issue Challenge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue a New Challenge</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Challenge Name</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                  placeholder="e.g., Code Review Sprint"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Level</label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={newType === 'Personal' ? 'default' : 'outline'} onClick={() => setNewType('Personal')}>1v1</Button>
                  <Button type="button" size="sm" variant={newType === 'Team' ? 'default' : 'outline'} onClick={() => setNewType('Team')}>Team</Button>
                  <Button type="button" size="sm" variant={newType === 'Department' ? 'default' : 'outline'} onClick={() => setNewType('Department')}>Department</Button>
                </div>
              </div>
              {newType === 'Personal' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Opponent</label>
                  <select 
                    value={opponent}
                    onChange={e => setOpponent(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select someone...</option>
                    {employees.filter(e => e.id !== currentUser?.id).map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <Button type="submit" variant="secondary" className="w-full mt-4" disabled={createChallenge.isPending}>
                {createChallenge.isPending ? 'Sending...' : 'Throw Gauntlet'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'Personal', 'Team', 'Department'] as const).map(f => (
          <Button 
            key={f} 
            variant={filter === f ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter(f)}
            className="rounded-full"
          >
            {f === 'all' ? 'All Battles' : f}
          </Button>
        ))}
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredChallenges.map(c => {
          const isPersonal = c.level === 'Personal';
          const empA = isPersonal ? employees.find(e => e.id === c.sideA) : null;
          const empB = isPersonal ? employees.find(e => e.id === c.sideB) : null;
          
          return (
            <motion.div variants={slideUp} key={c.id}>
              <Card className={cn(
                "overflow-hidden transition-all",
                c.status === 'active' ? "border-secondary/40 shadow-[0_0_15px_rgba(236,72,153,0.1)]" : "opacity-80"
              )}>
                <div className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-wider flex justify-between text-white",
                  c.status === 'active' ? "bg-gradient-to-r from-secondary to-purple-500" : "bg-muted-foreground"
                )}>
                  <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> {c.status}</span>
                  <span>{c.reward} PTS</span>
                </div>
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <Badge variant="outline" className="mb-2">{c.level}</Badge>
                    <h3 className="font-bold text-lg">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">Metric: {c.metric}</p>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4">
                    {/* Side A */}
                    <div className="flex flex-col items-center flex-1 text-center">
                      {isPersonal && empA ? (
                        <Avatar className="w-16 h-16 border-2 border-primary mb-2">
                          <AvatarFallback className={cn("text-white font-bold", empA.color)}>{empA.initials}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary mb-2 text-primary">
                          <Shield className="w-8 h-8" />
                        </div>
                      )}
                      <span className="font-semibold text-sm line-clamp-1">{isPersonal ? empA?.name : c.sideA}</span>
                      <span className="text-2xl font-black mt-1">{c.scoreA}</span>
                    </div>

                    {/* VS */}
                    <div className="flex flex-col items-center justify-center shrink-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-black text-muted-foreground italic -rotate-12">VS</div>
                    </div>

                    {/* Side B */}
                    <div className="flex flex-col items-center flex-1 text-center">
                      {isPersonal && empB ? (
                        <Avatar className="w-16 h-16 border-2 border-destructive mb-2">
                          <AvatarFallback className={cn("text-white font-bold", empB.color)}>{empB.initials}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center border-2 border-destructive mb-2 text-destructive">
                          <Users className="w-8 h-8" />
                        </div>
                      )}
                      <span className="font-semibold text-sm line-clamp-1">{isPersonal ? empB?.name : c.sideB}</span>
                      <span className="text-2xl font-black mt-1">{c.scoreB}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
      
      {filteredChallenges.length === 0 && (
        <div className="text-center p-12 bg-muted/30 rounded-2xl border-dashed border">
          <Swords className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No challenges found in this category.</p>
        </div>
      )}
    </PageTransition>
  );
}