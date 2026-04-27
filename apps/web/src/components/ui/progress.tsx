import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const normalizedValue = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        className={cn(
          "relative h-1.5 w-full overflow-hidden rounded-full bg-[rgba(126,101,51,0.14)]",
          className,
        )}
        {...props}
      >
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#9b7b3c,#d8be84)] transition-all"
          style={{ width: `${normalizedValue}%` }}
        />
      </div>
    );
  },
);

Progress.displayName = "Progress";
