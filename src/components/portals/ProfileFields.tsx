import type { InputHTMLAttributes, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const labelClass =
  "block text-[11px] font-bold uppercase tracking-wider text-[#002147] dark:text-slate-100";

/** Locked contrast — resists portal dark-mode color overrides */
const readonlyInputClass = cn(
  "profile-field profile-field-readonly h-auto w-full rounded-xl border border-slate-200",
  "bg-slate-100/80 px-4 py-2.5 text-sm font-bold text-[#002147]",
  "cursor-not-allowed opacity-100 shadow-none",
  "disabled:cursor-not-allowed disabled:opacity-100",
  "dark:border-slate-700 dark:bg-slate-900/80 dark:text-white"
);

const editableInputClass = cn(
  "profile-field profile-field-editable h-auto w-full rounded-xl border-2 border-[#002147]/25",
  "bg-white px-4 py-2.5 text-sm font-bold text-[#002147]",
  "placeholder:font-medium placeholder:text-slate-600",
  "focus-visible:border-[#ea580c] focus-visible:ring-2 focus-visible:ring-[#ea580c]/35",
  "dark:border-slate-600 dark:bg-slate-900/80 dark:text-white",
  "dark:placeholder:text-slate-300 dark:focus-visible:border-[#ea580c]"
);

export function ProfileFieldLabel({ children }: { children: ReactNode }) {
  return <span className={labelClass}>{children}</span>;
}

export function ReadOnlyProfileField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <ProfileFieldLabel>{label}</ProfileFieldLabel>
      <Input
        value={value || "—"}
        disabled
        readOnly
        className={readonlyInputClass}
      />
    </label>
  );
}

export function EditableProfileField({
  label,
  className,
  ...props
}: {
  label: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1.5">
      <ProfileFieldLabel>{label}</ProfileFieldLabel>
      <Input {...props} className={cn(editableInputClass, className)} />
    </label>
  );
}

export function ProfileInfoText({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="mt-1 text-sm font-bold text-[#002147] dark:text-white">
        {value || "—"}
      </p>
    </div>
  );
}
