import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-bold tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(216,190,132,0.22)] bg-[rgba(216,190,132,0.12)] text-[#866833]",
        dark:
          "border-[rgba(216,190,132,0.18)] bg-[#1b1712] text-[#f5e7c3]",
        success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
        warning: "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]",
        danger: "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
