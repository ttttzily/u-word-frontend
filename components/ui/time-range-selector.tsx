import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const timeRangeVariants = cva(
  "inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-gray-200 dark:bg-gray-700 text-foreground hover:bg-gray-300 dark:hover:bg-gray-600",
        outline: "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800",
      },
      size: {
        default: "px-3 py-1",
        sm: "px-2 py-0.5",
        lg: "px-4 py-2",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  }
)

export interface TimeRangeSelectorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: "week" | "month" | "year"
  onValueChange: (value: "week" | "month" | "year") => void
}

export function TimeRangeSelector({
  value,
  onValueChange,
  className,
  ...props
}: TimeRangeSelectorProps) {
  return (
    <div
      className={cn("inline-flex items-center space-x-1", className)}
      {...props}
    >
      <button
        type="button"
        onClick={() => onValueChange("week")}
        className={cn(
          timeRangeVariants({
            variant: value === "week" ? "default" : "outline",
          })
        )}
      >
        最近七天
      </button>
      <button
        type="button"
        onClick={() => onValueChange("month")}
        className={cn(
          timeRangeVariants({
            variant: value === "month" ? "default" : "outline",
          })
        )}
      >
        最近一月
      </button>
      <button
        type="button"
        onClick={() => onValueChange("year")}
        className={cn(
          timeRangeVariants({
            variant: value === "year" ? "default" : "outline",
          })
        )}
      >
        最近半年
      </button>
    </div>
  )
}
