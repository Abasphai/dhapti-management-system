/**
 * Shared high-contrast styles for CMS admin modals / editors.
 * Dialogs are always light surfaces — never inherit dark-theme field colors.
 */

/** Apply on DialogContent in CMS editors */
export const cmsDialogContentClass =
  "bg-white text-[#002147] dark:bg-white dark:text-[#002147] " +
  "[&_label]:text-[#002147] [&_label]:font-semibold " +
  "[&_input]:!bg-white [&_input]:!text-[#002147] [&_input]:font-bold " +
  "[&_input]:placeholder:!text-slate-400 [&_input]:border-[#E5EBF3] " +
  "[&_textarea]:!bg-white [&_textarea]:!text-[#002147] [&_textarea]:font-bold " +
  "[&_textarea]:placeholder:!text-slate-400 [&_textarea]:border-[#E5EBF3] " +
  "[&_[role=combobox]]:!bg-white [&_[role=combobox]]:!text-[#002147] " +
  "[&_[role=combobox]]:font-bold [&_[role=combobox]]:border-[#E5EBF3]";

/** Standalone fields on CMS pages (non-dialog) */
export const cmsFieldClass =
  "bg-white text-[#002147] font-bold placeholder:text-slate-400 border-[#E5EBF3] " +
  "dark:bg-white dark:text-[#002147] dark:placeholder:text-slate-400 dark:border-[#E5EBF3]";

export const cmsBtnCancelClass =
  "bg-slate-100 text-[#002147] hover:bg-slate-200 hover:text-[#002147] " +
  "border border-slate-200 font-bold px-6 py-2.5 h-auto rounded-xl transition-all " +
  "dark:bg-slate-100 dark:text-[#002147] dark:hover:bg-slate-200 dark:border-slate-200";

export const cmsBtnDraftClass =
  "bg-slate-800 text-white hover:bg-slate-700 hover:text-white " +
  "border border-slate-700 font-bold px-6 py-2.5 h-auto rounded-xl transition-all " +
  "dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700";

export const cmsBtnPublishClass =
  "bg-[#ea580c] text-white hover:bg-orange-600 hover:text-white " +
  "font-bold px-6 py-2.5 h-auto rounded-xl transition-all " +
  "dark:bg-[#ea580c] dark:text-white dark:hover:bg-orange-600";

export const cmsBtnPublishNavyClass =
  "bg-[#002147] text-white hover:bg-[#003366] hover:text-white " +
  "font-bold px-6 py-2.5 h-auto rounded-xl transition-all";
