import { format } from "date-fns";
import { useState } from "react";
import { Award, Printer, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { initialsForUsername, colorForId, useAuth } from "@/hooks/use-auth";
import { useDeleteHofRecord } from "@/hooks/use-guinness-records";
import { getErrorMessage } from "@/lib/utils";
import type { HofCategory, HofRecord } from "@/hooks/use-guinness-records";

export function CertificateDialog({
  category,
  record,
  open,
  onOpenChange,
}: {
  category: HofCategory;
  record: HofRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { hasPermission } = useAuth();
  const deleteRecord = useDeleteHofRecord(category.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { setConfirmDelete(false); deleteRecord.reset(); onOpenChange(next); }}>
      <DialogContent className="max-w-lg p-0 certificate-dialog-content">
        <DialogTitle className="sr-only">{category.name} certificate</DialogTitle>
        <DialogDescription className="sr-only">Achievement certificate and record actions.</DialogDescription>
        <div className="certificate-print-area relative m-3 p-6 pt-10 rounded-lg bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-amber-950/40 dark:via-background dark:to-amber-950/40 border border-amber-400/60">

          <div className="text-center space-y-4">
            <Award className="w-12 h-12 mx-auto text-amber-500" />
            <div>
              <p className="text-[11px] tracking-[0.3em] uppercase text-amber-600 dark:text-amber-400 font-semibold">
                Certificate of Achievement
              </p>
              <h2 className="text-2xl font-bold mt-1">{category.name}</h2>
            </div>

            <div className="flex flex-col items-center gap-2 py-2">
              <div>
                <UserAvatar
                  user={{
                    name: record.holder?.username ?? "unknown",
                    initials: initialsForUsername(record.holder?.username ?? "?"),
                    color: colorForId(record.holder_id),
                  }}
                  photoUrl={record.holder?.avatar_url ?? null}
                  border={record.holder?.active_border ?? null}
                  className="w-16 h-16 border-2 border-amber-400 shadow"
                />
              </div>
              <p className="text-lg font-bold">@{record.holder?.username ?? "unknown"}</p>
            </div>

            <p className="text-sm text-muted-foreground italic max-w-sm mx-auto">
              has set the company record for
            </p>
            <p className="text-base font-semibold px-4">{record.achievement}</p>

            <p className="text-xs text-muted-foreground pt-2">
              {format(new Date(record.record_date), "MMMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="px-4 pb-4 flex flex-wrap justify-center gap-2 no-print">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print / Save as PDF
          </Button>
          {hasPermission("manage_hall_of_fame") && (
            confirmDelete ? <div className="w-full space-y-3 text-center">
              <p className="text-sm">Delete this record and its certificate? This cannot be undone.</p>
              <Button variant="outline" disabled={deleteRecord.isPending} onClick={() => setConfirmDelete(false)}>Cancel</Button>{" "}
              <Button variant="destructive" disabled={deleteRecord.isPending} onClick={() => deleteRecord.mutate(record.id, { onSuccess: () => { setConfirmDelete(false); onOpenChange(false); } })}>
                {deleteRecord.isPending ? "Deleting…" : "Delete record"}
              </Button>
            </div> : <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete record</Button>
          )}
          {deleteRecord.error && <p role="alert" className="w-full text-sm text-destructive">{getErrorMessage(deleteRecord.error)}</p>}
        </div>
      </DialogContent>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .certificate-print-area, .certificate-print-area * { visibility: visible; }
          .certificate-print-area { position: fixed; inset: 0; border-width: 4px; }
          .no-print { display: none !important; }
          .certificate-dialog-content > button { display: none !important; }
        }
      `}</style>
    </Dialog>
  );
}
