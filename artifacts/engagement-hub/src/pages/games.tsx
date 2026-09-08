import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Type, Monitor, Swords, Brain, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Tailwind's build-time scanner needs full literal class strings -- a
// template like `bg-${color}/10` never gets generated into the compiled
// CSS, so each color combo is spelled out here instead.
const COLOR_STYLES = {
  primary: { card: "from-primary/10", icon: "bg-primary/15 text-primary" },
  secondary: { card: "from-secondary/10", icon: "bg-secondary/15 text-secondary" },
  accent: { card: "from-accent/10", icon: "bg-accent/15 text-accent-foreground" },
} as const;

const GAMES = [
  {
    href: "/games/wordle",
    icon: Type,
    name: "Fastest Wordle Guesser",
    description: "One word a day. Guess it fast, guess it right.",
    color: "primary",
    live: true,
  },
  {
    href: null,
    icon: Monitor,
    name: "Best WFH Desk Setup",
    description: "Show off your home office. Team votes on the best.",
    color: "secondary",
    live: false,
  },
  {
    href: null,
    icon: Swords,
    name: "Mobile Legends Tournament",
    description: "Internal bracket, bragging rights on the line.",
    color: "accent",
    live: false,
  },
  {
    href: null,
    icon: Brain,
    name: "Brand Knowledge Quiz",
    description: "How well do you really know our brands?",
    color: "primary",
    live: false,
  },
] satisfies { href: string | null; icon: typeof Type; name: string; description: string; color: keyof typeof COLOR_STYLES; live: boolean }[];

export default function Games() {
  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
          <Gamepad2 className="w-8 h-8 text-primary" /> Games
        </h1>
        <p className="text-muted-foreground mt-1">A little friendly competition to boost morale.</p>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GAMES.map((game) => {
          const Icon = game.icon;
          const style = COLOR_STYLES[game.color];
          const card = (
            <Card
              className={cn(
                "h-full shadow-sm transition-all bg-gradient-to-br via-card to-card",
                style.card,
                game.live ? "hover:shadow-md hover:-translate-y-1 cursor-pointer" : "opacity-70"
              )}
            >
              <CardContent className="p-5 flex items-start gap-4">
                <div className={cn("p-3 rounded-xl shrink-0", style.icon)}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{game.name}</h3>
                    {game.live ? (
                      <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600">Live</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{game.description}</p>
                </div>
              </CardContent>
            </Card>
          );

          return (
            <motion.div key={game.name} variants={slideUp}>
              {game.href ? <Link href={game.href}>{card}</Link> : card}
            </motion.div>
          );
        })}
      </motion.div>
    </PageTransition>
  );
}
