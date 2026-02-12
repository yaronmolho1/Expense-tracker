"use client"

import * as React from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr",
  "May", "Jun", "Jul", "Aug",
  "Sep", "Oct", "Nov", "Dec",
]

interface MonthYearPickerProps {
  value?: string // YYYY-MM-DD format (day is ignored; uses first of month)
  onChange: (date: string) => void
  placeholder?: string
  disabled?: boolean
}

export function MonthYearPicker({
  value,
  onChange,
  placeholder = "MM/YYYY",
  disabled = false,
}: MonthYearPickerProps) {
  const parsed = value ? new Date(value) : null
  const [year, setYear] = React.useState(parsed?.getFullYear() ?? new Date().getFullYear())
  const [open, setOpen] = React.useState(false)

  // Keep year in sync when value changes externally
  React.useEffect(() => {
    if (value) {
      const d = new Date(value)
      setYear(d.getFullYear())
    }
  }, [value])

  const selectedMonth = parsed ? parsed.getMonth() : null
  const selectedYear = parsed ? parsed.getFullYear() : null

  const displayValue = parsed
    ? `${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`
    : placeholder

  const handleSelect = (monthIndex: number) => {
    const month = String(monthIndex + 1).padStart(2, "0")
    onChange(`${year}-${month}-01`)
    setOpen(false)
  }

  return (
    <Popover modal={true} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !parsed && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3 z-[200]"
        align="start"
        side="bottom"
        sideOffset={8}
        avoidCollisions={false}
      >
        {/* Year navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((month, index) => {
            const isSelected = selectedMonth === index && selectedYear === year
            return (
              <Button
                key={month}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleSelect(index)}
              >
                {month}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
