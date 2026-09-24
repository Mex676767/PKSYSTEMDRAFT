import { useState } from "react";
import { Building2, ArrowUp, ArrowDown, Pencil, Trash2, Plus, Check, X, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDeleteOrgItem, useMoveOrgItem, useOrgStructure, useSaveOrgItem, type OrgKind } from "@/hooks/use-org-structure";
import { cn, getErrorMessage } from "@/lib/utils";

/** Admin: add, rename, reorder and remove roles and departments. */
export function AdminOrgCard() {
  const { roles, departments, managed } = useOrgStructure();
  const [kind, setKind] = useState<OrgKind>("role");

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Roles & Departments</h2>
            <p className="text-xs text-muted-foreground">
              Roles are ranked most senior first; challenges use this order for upline/downline. Departments have no
              rank. Renaming updates everyone who has it. Removing only works once nobody has it.
            </p>
          </div>
        </div>

        {!managed ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
            Run migrations <code>0027_org_structure</code> and <code>0028_org_structure_admin</code> in Supabase to manage
            these here.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "role", label: `Roles (${roles.length})`, icon: Briefcase },
                { key: "department", label: `Departments (${departments.length})`, icon: Building2 },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setKind(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                    kind === key ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
            <OrgList key={kind} kind={kind} items={kind === "role" ? roles : departments} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OrgList({ kind, items }: { kind: OrgKind; items: string[] }) {
  const save = useSaveOrgItem();
  const move = useMoveOrgItem();
  const remove = useDeleteOrgItem();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const noun = kind === "role" ? "role" : "department";
  const error = save.error ?? move.error ?? remove.error;
  const busy = save.isPending || move.isPending || remove.isPending;

  const add = () => {
    if (!newName.trim()) return;
    save.mutate({ kind, oldName: null, newName }, { onSuccess: () => setNewName("") });
  };

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`New ${noun}, e.g. ${kind === "role" ? "INTERN" : "FINANCE"}`} maxLength={40} />
        <Button type="submit" size="sm" className="h-9 shrink-0" disabled={!newName.trim() || busy}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground">
        {kind === "role"
          ? "Names are saved in capitals. New roles are added at the bottom (most junior); use the arrows to move them."
          : "Names are saved in capitals. Departments are listed A to Z."}
      </p>
      {error && <p className="text-xs text-destructive">{getErrorMessage(error)}</p>}

      <div className="rounded-xl border border-border divide-y divide-border">
        {items.map((name, i) => (
          <div key={name} className="flex items-center gap-2 px-3 py-2">
            {kind === "role" && <span className="w-6 text-[11px] text-muted-foreground tabular-nums">{i + 1}.</span>}
            {editing === name ? (
              <form
                className="flex flex-1 items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate({ kind, oldName: name, newName: editValue }, { onSuccess: () => setEditing(null) });
                }}
              >
                <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} maxLength={40} className="h-8" />
                <button type="submit" disabled={busy} className="p-1.5 rounded-md hover:bg-muted text-emerald-500" title="Save"><Check className="w-4 h-4" /></button>
                <button type="button" onClick={() => setEditing(null)} className="p-1.5 rounded-md hover:bg-muted" title="Cancel"><X className="w-4 h-4" /></button>
              </form>
            ) : (
              <>
                <span className="flex-1 min-w-0 truncate text-sm font-medium">{name}</span>
                {/* Only roles have a rank; departments are just listed A to Z. */}
                {kind === "role" && (
                  <>
                    <button type="button" disabled={busy || i === 0} onClick={() => move.mutate({ kind, name, direction: -1 })} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" title="Move up"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" disabled={busy || i === items.length - 1} onClick={() => move.mutate({ kind, name, direction: 1 })} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" title="Move down"><ArrowDown className="w-4 h-4" /></button>
                  </>
                )}
                <button type="button" disabled={busy} onClick={() => { setEditing(name); setEditValue(name); }} className="p-1.5 rounded-md hover:bg-muted" title="Rename"><Pencil className="w-4 h-4" /></button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { if (confirm(`Remove the ${noun} "${name}"?`)) remove.mutate({ kind, name }); }}
                  className="p-1.5 rounded-md hover:bg-muted text-destructive"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
