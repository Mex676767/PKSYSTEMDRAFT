import { type LucideIcon, Clock } from "lucide-react";
import { Link } from "wouter";
import { PageTransition, slideUp } from "@/components/animations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function ComingSoon({ label, icon: Icon = Clock }: { label: string; icon?: LucideIcon }) {
  return (
    <PageTransition className="p-4 md:p-8 max-w-lg mx-auto min-h-[70vh] flex items-center justify-center">
      <motion.div variants={slideUp} initial="hidden" animate="show" className="text-center space-y-4">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
          <Icon className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{label}</h1>
          <Badge variant="outline" className="mt-2">
            <Clock className="w-3 h-3 mr-1" /> Coming Soon
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-xs mx-auto">
          We're still building this one out. Check back soon!
        </p>
        <Link href="/">
          <Button variant="outline" size="sm">Back to Dashboard</Button>
        </Link>
      </motion.div>
    </PageTransition>
  );
}

export default ComingSoon;
