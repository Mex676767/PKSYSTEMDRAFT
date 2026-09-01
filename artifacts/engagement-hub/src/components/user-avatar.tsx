import { type Employee } from "@/hooks/use-mock-api";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: Pick<Employee, "initials" | "color" | "name">;
  className?: string;
}

export function UserAvatar({ user, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("border-2 border-background", className)}>
      <AvatarFallback className={cn("text-white font-bold", user.color)}>
        {user.initials}
      </AvatarFallback>
    </Avatar>
  );
}
