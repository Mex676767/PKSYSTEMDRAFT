import {
  Trophy, Flame, Zap, Star, Medal, Rocket, Crown, Target,
  Award, Sparkles, Coffee, Gamepad2, Music, Palette, Code2, Dumbbell,
  type LucideIcon,
} from "lucide-react";

export const HOF_ICON_OPTIONS = [
  "Trophy", "Flame", "Zap", "Star", "Medal", "Rocket", "Crown", "Target",
  "Award", "Sparkles", "Coffee", "Gamepad2", "Music", "Palette", "Code2", "Dumbbell",
] as const;

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, Flame, Zap, Star, Medal, Rocket, Crown, Target,
  Award, Sparkles, Coffee, Gamepad2, Music, Palette, Code2, Dumbbell,
};

export function getHofIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Trophy;
}
