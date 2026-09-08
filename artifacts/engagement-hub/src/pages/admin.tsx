import { useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { ShieldAlert, Search, UserX, UserCheck, Shield, Cake } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  useAllProfiles,
  useSetUserAdmin,
  useSetUserPermissions,
  useDeactivateUser,
  useReactivateUser,
  type AdminProfileRow,
} from "@/hooks/use-admin";
import { useAdminSetBirthday } from "@/hooks/use-birthdays";
import { format } from "date-fns";
import { PERMISSIONS, PERMISSION_KEYS, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/not-found";

export default function Admin() {
  const { isAdmin, session } = useAuth();
  const { data: profiles = [], isLoading } = useAllProfiles();
  const [search, setSearch] = useState("");

  // A non-admin who finds this URL just sees a normal 404 -- this panel
  // isn't meant to be discoverable.
  if (!isAdmin) return <NotFound />;

  const filtered = profiles.filter(
    (p) =>
      !search.trim() ||
      p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Badge variant="destructive" className="mb-2">
          <ShieldAlert className="w-3 h-3 mr-1" /> Admin Only
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1">Roles, permissions, and account status.</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or email..."
          className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
          {filtered.map((p) => (
            <motion.div key={p.id} variants={slideUp}>
              <UserRow row={p} isSelf={p.id === session?.user.id} />
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No users match that search.</p>
          )}
        </motion.div>
      )}
    </PageTransition>
  );
}

function UserRow({ row, isSelf }: { row: AdminProfileRow; isSelf: boolean }) {
  const setAdmin = useSetUserAdmin();
  const setPermissions = useSetUserPermissions();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const adminSetBirthday = useAdminSetBirthday();
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [birthdayInput, setBirthdayInput] = useState(row.birthday ?? "");

  const togglePermission = (perm: Permission) => {
    const next = row.permissions.includes(perm)
      ? row.permissions.filter((p) => p !== perm)
      : [...row.permissions, perm];
    setPermissions.mutate({ userId: row.id, permissions: next });
  };

  return (
    <Card className={cn("shadow-sm", row.is_deleted && "opacity-60 border-dashed")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className={cn("text-white text-xs font-bold", colorForId(row.id))}>
              {initialsForUsername(row.username ?? row.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">@{row.username ?? "(no username)"}</span>
              {row.is_admin && <Badge className="text-[10px] bg-primary hover:bg-primary">Admin</Badge>}
              {row.is_deleted && <Badge variant="destructive" className="text-[10px]">Deactivated</Badge>}
            </div>
            <p className="text-xs text-muted-foreground truncate">{row.email} · {row.points} pts{row.department ? ` · ${row.department}` : ""}</p>
          </div>

          {!isSelf && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setAdmin.mutate({ userId: row.id, value: !row.is_admin })}
                disabled={setAdmin.isPending}
                title={row.is_admin ? "Revoke admin" : "Make admin"}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  row.is_admin ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Shield className="w-4 h-4" />
              </button>
              {row.is_deleted ? (
                <button
                  onClick={() => reactivate.mutate(row.id)}
                  disabled={reactivate.isPending}
                  title="Reactivate account"
                  className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => window.confirm(`Deactivate @${row.username}? They'll be signed out and hidden from the app.`) && deactivate.mutate(row.id)}
                  disabled={deactivate.isPending}
                  title="Deactivate account"
                  className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <UserX className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {!row.is_admin && !isSelf && (
          <div className="flex flex-wrap gap-1.5 pl-12">
            {PERMISSION_KEYS.map((perm) => {
              const active = row.permissions.includes(perm);
              return (
                <button
                  key={perm}
                  onClick={() => togglePermission(perm)}
                  disabled={setPermissions.isPending}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                    active
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {PERMISSIONS[perm]}
                </button>
              );
            })}
          </div>
        )}

        <div className="pl-12 flex items-center gap-2 text-xs text-muted-foreground">
          <Cake className="w-3.5 h-3.5 shrink-0" />
          {editingBirthday ? (
            <>
              <input
                type="date"
                value={birthdayInput}
                onChange={(e) => setBirthdayInput(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
                className="h-7 rounded border border-input bg-background px-2 text-xs"
              />
              <button
                disabled={!birthdayInput || adminSetBirthday.isPending}
                onClick={() => adminSetBirthday.mutate({ userId: row.id, birthday: birthdayInput }, { onSuccess: () => setEditingBirthday(false) })}
                className="text-primary hover:underline disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setEditingBirthday(false)} className="hover:text-foreground">Cancel</button>
            </>
          ) : (
            <>
              <span>{row.birthday ? format(new Date(2000, Number(row.birthday.split("-")[1]) - 1, Number(row.birthday.split("-")[2])), "MMMM d") : "No birthday set"}</span>
              <button onClick={() => setEditingBirthday(true)} className="text-primary hover:underline">
                {row.birthday ? "Change" : "Set"}
              </button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
