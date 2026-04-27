import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-[#69501f] bg-[#1b1712] text-[#f5e7c3] shadow-[0_12px_22px_rgba(28,21,7,0.16)] hover:bg-[#241d13]",
        secondary:
          "border border-[rgba(216,190,132,0.22)] bg-[rgba(216,190,132,0.1)] text-[#f1e0b8] hover:bg-[rgba(216,190,132,0.16)]",
        ghost:
          "text-[#6a5d49] hover:bg-[rgba(216,190,132,0.1)] hover:text-[#2b2215]",
        destructive:
          "border border-[#deada4] bg-[#7f3428] text-[#fffaf2] hover:bg-[#6f2d23]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";

export { buttonVariants };
