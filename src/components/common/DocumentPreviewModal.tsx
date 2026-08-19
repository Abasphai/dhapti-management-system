import { Download, Eye, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DocumentPreviewData = {
  title: string;
  subtitle?: string;
  meta?: Array<{ label: string; value: string }>;
  bodyHtml?: string;
  amountLabel?: string;
  footerNote?: string;
};

type DocumentPreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentPreviewData | null;
  onDownload?: () => void;
  downloadLabel?: string;
};

export function DocumentPreviewModal({
  open,
  onOpenChange,
  document: doc,
  onDownload,
  downloadLabel = "Download / Print",
}: DocumentPreviewModalProps) {
  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <Eye className="h-5 w-5 text-[#ea580c]" />
            Document Preview
          </DialogTitle>
          <DialogDescription>
            Review the document before downloading or printing.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-[#E5EBF3] bg-[#FAFBFD] p-5 dark:bg-slate-50">
          <div className="mb-4 flex items-start gap-3 border-b border-[#E5EBF3] pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#002147] text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                Dhapti University
              </p>
              <h3 className="text-lg font-bold text-[#002147]">{doc.title}</h3>
              {doc.subtitle && (
                <p className="text-sm text-slate-500">{doc.subtitle}</p>
              )}
            </div>
          </div>

          {doc.meta && (
            <dl className="space-y-2 text-sm">
              {doc.meta.map((row) => (
                <div
                  key={row.label}
                  className="flex items-start justify-between gap-4"
                >
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="text-right font-semibold text-[#002147]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {doc.amountLabel && (
            <p className="mt-4 text-3xl font-black text-[#16a34a]">
              {doc.amountLabel}
            </p>
          )}

          {doc.bodyHtml && (
            <div
              className="prose prose-sm mt-4 max-w-none text-[#002147]"
              dangerouslySetInnerHTML={{ __html: doc.bodyHtml }}
            />
          )}

          {doc.footerNote && (
            <p className="mt-4 text-xs text-slate-500">{doc.footerNote}</p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Close
          </Button>
          {onDownload && (
            <Button
              type="button"
              onClick={onDownload}
              className="gap-2 bg-[#002147] text-white hover:bg-[#003366]"
            >
              <Download className="h-4 w-4" />
              {downloadLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
