import { format } from "date-fns";
import { Printer, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteHofRecord } from "@/hooks/use-guinness-records";
import { BRAND_FULL_NAME, BRAND_NAME } from "@/lib/brand";
import { printElement } from "@/lib/print-element";
import { getErrorMessage } from "@/lib/utils";
import type { HofCategory, HofRecord } from "@/hooks/use-guinness-records";

function RegistryEmblem() {
  const pathId = `registry-emblem-${BRAND_NAME.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;

  return (
    <svg className="record-certificate__emblem" viewBox="0 0 240 240" role="img" aria-label={`${BRAND_NAME} Guinness Record emblem`}>
      <defs>
        <path id={`${pathId}-top`} d="M 45,118 A 75,75 0 0,1 195,118" />
        <path id={`${pathId}-bottom`} d="M 35,132 A 88,88 0 0,0 205,132" />
      </defs>
      <circle cx="120" cy="120" r="105" fill="#112840" stroke="#d9bd68" strokeWidth="3" />
      <circle cx="120" cy="120" r="96" fill="none" stroke="#f6f0d8" strokeWidth="2" />
      <circle cx="120" cy="120" r="66" fill="#f7f3df" stroke="#d9bd68" strokeWidth="2" />
      <text className="record-certificate__emblem-arc">
        <textPath href={`#${pathId}-top`} startOffset="50%" textAnchor="middle">{BRAND_NAME}</textPath>
      </text>
      <text className="record-certificate__emblem-arc record-certificate__emblem-arc--bottom">
        <textPath href={`#${pathId}-bottom`} startOffset="50%" textAnchor="middle">GUINNESS RECORD</textPath>
      </text>
      <path d="m120 55 8 17 19 2-14 13 4 19-17-9-17 9 4-19-14-13 19-2Z" fill="#d3a72e" />
      <path d="M91 116h58v13c0 19-12 32-29 32s-29-13-29-32Zm29 45v19m-18 0h36" fill="none" stroke="#112840" strokeWidth="7" strokeLinecap="square" />
      <path d="M91 122H78c0 16 7 24 20 26m51-26h13c0 16-7 24-20 26" fill="none" stroke="#112840" strokeWidth="6" />
      <text x="120" y="196" textAnchor="middle" textLength="80" lengthAdjust="spacingAndGlyphs" className="record-certificate__emblem-caption">COMPANY HONORS</text>
    </svg>
  );
}

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
  const certificateRef = useRef<HTMLElement>(null);
  if (!record) return null;

  const recordDate = new Date(record.record_date);
  const holderName = record.holder?.username ?? "unknown";
  const department = record.holder?.department?.trim();
  const recordPrefix = BRAND_NAME.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const recordId = `${recordPrefix}-GR-${format(recordDate, "yyyy")}-${record.id.slice(0, 8).toUpperCase()}`;

  return (
    <Dialog open={open} onOpenChange={(next) => { setConfirmDelete(false); deleteRecord.reset(); onOpenChange(next); }}>
      <DialogContent className="certificate-dialog-content max-w-[780px] p-0">
        <DialogTitle className="sr-only">{category.name} certificate</DialogTitle>
        <DialogDescription className="sr-only">Official {BRAND_NAME} Guinness Record certificate and record actions.</DialogDescription>

        <div className="certificate-stage">
          <article ref={certificateRef} className="record-certificate" aria-label={`${category.name} record certificate`}>
            <div className="record-certificate__security" aria-hidden="true" />
            <div className="record-certificate__border" aria-hidden="true" />
            <div className="record-certificate__body">
              <RegistryEmblem />

              <header className="record-certificate__header">
                <h2>CERTIFICATE</h2>
                <p>{BRAND_NAME} GUINNESS RECORD · COMPANY ACHIEVEMENT</p>
              </header>

              <section className="record-certificate__highlights" aria-label="Record details">
                <div className="record-certificate__highlight">
                  <span>Official achievement</span>
                  <strong>{category.name}</strong>
                </div>
                <div className="record-certificate__highlight record-certificate__highlight--holder">
                  <span>Record holder</span>
                  <strong>@{holderName}</strong>
                  <small>{department ? `${department} department` : "Company record holder"}</small>
                </div>
                <div className="record-certificate__highlight record-certificate__highlight--result">
                  <span>Verified record</span>
                  <strong>{record.achievement}</strong>
                </div>
              </section>

              <p className="record-certificate__date">
                Recorded and verified on {format(recordDate, "d MMMM yyyy")}<br />
                <span>{BRAND_FULL_NAME}</span>
              </p>

              <footer className="record-certificate__validation">
                <div className="record-certificate__signature">
                  <strong>{BRAND_NAME} Records Committee</strong>
                  <span>Authorised record validation</span>
                  <small>{format(recordDate, "MMMM yyyy")}</small>
                </div>
                <div className="record-certificate__seal" aria-label="Record verified">
                  <span>{BRAND_NAME}</span>
                  <strong>RECORD</strong>
                  <strong>VERIFIED</strong>
                </div>
              </footer>

              <div className="record-certificate__motto">EXCELLENCE <b>RECOGNISED</b></div>
              <div className="record-certificate__id">OFFICIAL RECORD ID · {recordId}</div>
            </div>
          </article>
        </div>

        <div className="no-print flex flex-wrap justify-center gap-2 px-4 pb-4">
          <Button size="sm" variant="outline" onClick={() => certificateRef.current && printElement(certificateRef.current)}>
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / Save as PDF
          </Button>
          {hasPermission("manage_hall_of_fame") && (
            confirmDelete ? (
              <div className="w-full space-y-3 text-center">
                <p className="text-sm">Delete this record and its certificate? This cannot be undone.</p>
                <Button variant="outline" disabled={deleteRecord.isPending} onClick={() => setConfirmDelete(false)}>Cancel</Button>{" "}
                <Button variant="destructive" disabled={deleteRecord.isPending} onClick={() => deleteRecord.mutate(record.id, { onSuccess: () => { setConfirmDelete(false); onOpenChange(false); } })}>
                  {deleteRecord.isPending ? "Deleting…" : "Delete record"}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete record
              </Button>
            )
          )}
          {deleteRecord.error && <p role="alert" className="w-full text-sm text-destructive">{getErrorMessage(deleteRecord.error)}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
