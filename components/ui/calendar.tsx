"use client"

import * as React from "react"

export type CalendarProps = React.InputHTMLAttributes<HTMLInputElement>

function Calendar({ className, ...props }: CalendarProps) {
  return (
    <input
      type="date"
      data-testid="date-input"
      className={`p-3 border rounded-md ${className || ""}`}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
