import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-base font-bold text-[#002147] ring-offset-background placeholder:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400",
          className
        )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
