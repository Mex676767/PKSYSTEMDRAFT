import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-lg bg-gradient-to-br from-primary/10 via-card to-secondary/10">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Compass className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Lost in the Arena
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page doesn't exist. Let's get you back to the action.
          </p>
          <Link href="/" className="block mt-6">
            <Button className="w-full">Back to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
