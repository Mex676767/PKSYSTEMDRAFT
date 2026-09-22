import { useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { AtSign, Sparkles, Cake, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/date-picker";
import { useAuth } from "@/hooks/use-auth";
import { useSetMyBirthday } from "@/hooks/use-birthdays";
import { useSetMyRoleDepartment } from "@/hooks/use-role-department";
import { ROLES, DEPARTMENTS, type Role, type Department } from "@/lib/roles";
import { getErrorMessage } from "@/lib/utils";

function sanitizeUsername(raw: string) {
  return raw.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
}

type Step = "username" | "birthday" | "role";

const STEPS: Step[] = ["username", "birthday", "role"];

function stepFor(profile: ReturnType<typeof useAuth>["profile"]): Step | null {
  if (!profile?.username) return "username";
  if (!profile?.birthday) return "birthday";
  if (!profile?.role || !profile?.department) return "role";
  return null;
}

const STEP_META: Record<Step, { icon: typeof AtSign; title: string; subtitle: string }> = {
  username: { icon: AtSign, title: "Pick a username", subtitle: "This is how everyone will see you. Choose wisely." },
  birthday: { icon: Cake, title: "When's your birthday?", subtitle: "We'll throw you a little something on the day." },
  role: { icon: Briefcase, title: "Your role & department", subtitle: "Helps us route challenges and mentorships correctly." },
};

export default function Onboarding() {
  const { profile } = useAuth();
  const step = stepFor(profile);

  if (!step) return null;
  const { icon: Icon, title, subtitle } = STEP_META[step];

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 app-gradient-bg">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="bg-primary text-primary-foreground w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
            <Icon className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={
                  "w-2 h-2 rounded-full " +
                  (s === step ? "bg-primary" : i < STEPS.indexOf(step) ? "bg-primary/40" : "bg-muted")
                }
              />
            ))}
          </div>
        </div>

        <Card className="border-primary/20 shadow-lg bg-gradient-to-br from-primary/10 via-card to-secondary/10">
          <CardContent className="pt-8 pb-8">
            {step === "username" && <UsernameStep />}
            {step === "birthday" && <BirthdayStep />}
            {step === "role" && <RoleStep />}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function UsernameStep() {
  const { claimUsername } = useAuth();
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error } = await claimUsername(username.trim());
    setSubmitting(false);
    if (error) setError(error);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <AtSign className="w-4 h-4 text-primary" /> Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
          placeholder="e.g. code_ninja"
          autoFocus
          required
          maxLength={20}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <p className="text-xs text-muted-foreground">3-20 characters. Letters, numbers, and underscores only.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full h-11" disabled={submitting}>
        {submitting ? "Checking..." : <><Sparkles className="w-4 h-4 mr-2" /> Continue</>}
      </Button>
    </form>
  );
}

function BirthdayStep() {
  const setBirthday = useSetMyBirthday();
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setError(null);
    setBirthday.mutate(value, { onError: (err) => setError(getErrorMessage(err)) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Cake className="w-4 h-4 text-primary" /> Birthday
        </label>
        <DatePicker value={value} onChange={setValue} maxDate={format(new Date(), "yyyy-MM-dd")} className="w-full" />
        <p className="text-xs text-muted-foreground">You won't be able to change this yourself afterward.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full h-11" disabled={!value || setBirthday.isPending}>
        {setBirthday.isPending ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}

function RoleStep() {
  const setRoleDept = useSetMyRoleDepartment();
  const [role, setRole] = useState<Role | "">("");
  const [department, setDepartment] = useState<Department | "">("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !department) return;
    setError(null);
    setRoleDept.mutate({ role, department }, { onError: (err) => setError(getErrorMessage(err)) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" /> Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          required
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select a role...</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Department</label>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value as Department)}
          required
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select a department...</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full h-11" disabled={!role || !department || setRoleDept.isPending}>
        {setRoleDept.isPending ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
