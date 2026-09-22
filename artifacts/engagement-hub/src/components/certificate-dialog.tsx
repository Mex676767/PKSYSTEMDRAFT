import { format } from "date-fns";
import { Award, Printer, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { initialsForUsername, colorForId } from "@/hooks/use-auth";
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
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden certificate-dialog-content">
        <div className="certificate-print-area relative p-8 bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-amber-950/40 dark:via-background dark:to-amber-950/40 border-8 border-double border-amber-400/60">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground no-print"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center space-y-4">
            <Award className="w-12 h-12 mx-auto text-amber-500" />
            <div>
              <p className="text-[11px] tracking-[0.3em] uppercase text-amber-600 dark:text-amber-400 font-semibold">
                Certificate of Achievement
              </p>
              <h2 className="text-2xl font-bold mt-1">{category.name}</h2>
            </div>

            <div className="flex flex-col items-center gap-2 py-2">
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

        <div className="p-4 flex justify-center no-print">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print / Save as PDF
          </Button>
        </div>
      </DialogContent>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .certificate-print-area, .certificate-print-area * { visibility: visible; }
          .certificate-print-area { position: fixed; inset: 0; border-width: 4px; }
          .no-print { display: none !important; }
        }
      `}</style>
    </Dialog>
  );
}
