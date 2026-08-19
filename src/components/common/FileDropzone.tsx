import { useCallback, useId, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MAX_MB = 500;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar,.7z,.png,.jpg,.jpeg";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type FileDropzoneProps = {
  label?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  progress?: number | null;
  disabled?: boolean;
  error?: string | null;
  className?: string;
  accept?: string;
  hint?: string;
};

export function FileDropzone({
  label = "Attach your submission file (PDF, DOCX, ZIP - Max 500MB)",
  file,
  onFileChange,
  progress = null,
  disabled = false,
  error = null,
  className,
  accept = ACCEPT,
  hint,
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const pick = useCallback(
    (next: File | null) => {
      setLocalError(null);
      if (!next) {
        onFileChange(null);
        return;
      }
      if (next.size > MAX_BYTES) {
        setLocalError(`File exceeds ${MAX_MB}MB limit`);
        onFileChange(null);
        return;
      }
      onFileChange(next);
    },
    [onFileChange]
  );

  return (
    <div className={cn("assignment-dropzone space-y-2", className)}>
      <p className="assignment-dropzone-label text-xs font-bold uppercase tracking-wider text-[#002147]">
        {label}
      </p>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          pick(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "flex min-w-0 max-w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center transition-colors hover:bg-slate-50",
          dragOver && "border-[#16a34a] bg-[#16a34a]/10",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <FileUp className="mb-2 h-8 w-8 text-[#ea580c]" />
        <p className="text-sm font-bold text-[#002147]">
          Drag & drop a file here, or click to browse
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-600">
          {hint || `Allowed: PDF, DOCX, ZIP, images · Max ${MAX_MB}MB`}
        </p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </label>

      {file && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#002147]">
              {file.name}
            </p>
            <p className="text-xs font-semibold text-slate-600">
              {formatBytes(file.size)}
              {progress != null ? ` · Uploading ${progress}%` : ""}
            </p>
            {progress != null && (
              <Progress value={progress} className="mt-2 h-2" />
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              aria-label="Remove file"
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-[#002147]"
              onClick={() => {
                pick(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {(localError || error) && (
        <p className="text-xs font-bold text-red-600">{localError || error}</p>
      )}
    </div>
  );
}

export const ASSIGNMENT_MAX_FILE_MB = MAX_MB;
export const ASSIGNMENT_MAX_FILE_BYTES = MAX_BYTES;
