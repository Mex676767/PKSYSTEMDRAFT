import { useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLotteryData, useRunLottery, type Employee } from "@/hooks/use-mock-api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, Ticket } from "lucide-react";
import { Confetti } from "@/components/confetti";

export default function Lottery() {
  const { data, isLoading } = useLotteryData();
  const runLottery = useRunLottery();
  
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Employee | null>(null);

  const entries = data?.entries || [];
  const winners = data?.winners || [];
  const totalTickets = entries.reduce((acc, curr) => acc + curr.entries, 0);

  const handleDraw = async () => {
    setSpinning(true);
    setWinner(null);
    try {
      const res = await runLottery.mutateAsync();
      setWinner(res);
    } catch (e) {
      console.error(e);
    } finally {
      setSpinning(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-accent/20" /></div>;

  return (
    <PageTransition className="p-4 md:p-8 max-w-5xl mx-auto space-y-12">
      <Confetti active={!!winner && !spinning} />
      
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="w-20 h-20 bg-accent/20 text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-4 relative">
          <Gift className="w-10 h-10" />
          <Sparkles className="w-6 h-6 absolute -top-2 -right-2 text-yellow-500 animate-pulse" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Lucky Draw</h1>
        <p className="text-lg text-muted-foreground">Hard work pays off. The more goals you complete, the more entries you get.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Draw Area */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white border-none shadow-xl overflow-hidden relative min-h-[400px] flex flex-col items-center justify-center p-8">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white blur-3xl mix-blend-overlay"></div>
              <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-secondary blur-3xl mix-blend-overlay"></div>
            </div>

            <AnimatePresence mode="wait">
              {spinning ? (
                <motion.div 
                  key="spinning"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  className="flex flex-col items-center z-10"
                >
                  <div className="w-24 h-24 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
                  <h3 className="text-2xl font-bold font-display">Drawing Winner...</h3>
                  <p className="text-white/60 mt-2">Shuffling {totalTickets} tickets</p>
                </motion.div>
              ) : winner ? (
                <motion.div 
                  key="winner"
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex flex-col items-center z-10 text-center"
                >
                  <Badge className="bg-yellow-500 text-yellow-950 mb-6 px-4 py-1 text-sm border-none shadow-lg">
                    Winner Drawn!
                  </Badge>
                  <Avatar className="w-32 h-32 border-4 border-yellow-400 shadow-2xl mb-6">
                    <AvatarFallback className={cn("text-4xl text-white font-bold", winner.color)}>{winner.initials}</AvatarFallback>
                  </Avatar>
                  <h2 className="text-4xl font-bold mb-2">{winner.name}</h2>
                  <p className="text-xl text-yellow-200 mb-8">Wins the Surprise Swag Box!</p>
                  
                  <Button onClick={() => setWinner(null)} variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-full">
                    Close
                  </Button>
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center z-10 text-center w-full max-w-sm"
                >
                  <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/10 w-full mb-8">
                    <div className="text-5xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500">
                      {totalTickets}
                    </div>
                    <div className="text-white/70 uppercase tracking-widest text-sm font-semibold">Total Tickets in Pool</div>
                  </div>
                  
                  <Button 
                    size="lg" 
                    onClick={handleDraw}
                    disabled={entries.length === 0}
                    className="w-full h-16 text-lg rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-950 hover:from-yellow-300 hover:to-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.3)] border-none font-bold"
                  >
                    Spin the Wheel
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>

        {/* Side Panels */}
        <div className="lg:col-span-5 space-y-6">
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" /> Current Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {entries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className={cn("text-xs text-white", entry.employee.color)}>{entry.employee.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{entry.employee.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.reason}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{entry.entries} tkts</Badge>
                  </div>
                ))}
                {entries.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">Pool is empty right now.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Past Winners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {winners.slice(0, 3).map(w => (
                  <div key={w.id} className="flex items-start gap-4">
                    <Avatar className="w-10 h-10 border border-border mt-1">
                      <AvatarFallback className={cn("text-sm text-white font-bold", w.employee.color)}>{w.employee.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{w.employee.name}</p>
                      <p className="text-sm text-primary font-medium">{w.prize}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(w.date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </PageTransition>
  );
}