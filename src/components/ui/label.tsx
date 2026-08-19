import * as React from "react";

import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentProps<"label">
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-bold leading-none text-[#002147] peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-white",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
