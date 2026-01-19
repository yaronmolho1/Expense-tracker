"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  fromValue?: string; // YYYY-MM-DD format
  toValue?: string; // YYYY-MM-DD format
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  fromLabel?: string;
  toLabel?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  fromPlaceholder = "DD/MM/YYYY",
  toPlaceholder = "DD/MM/YYYY",
  fromLabel = "From Date",
  toLabel = "To Date",
  disabled = false,
}: DateRangePickerProps) {
  const [fromDate, setFromDate] = React.useState<Date | undefined>(
    fromValue ? new Date(fromValue) : undefined
  )
  const [toDate, setToDate] = React.useState<Date | undefined>(
    toValue ? new Date(toValue) : undefined
  )

  // Sync internal state when props change
  React.useEffect(() => {
    setFromDate(fromValue ? new Date(fromValue) : undefined)
  }, [fromValue])

  React.useEffect(() => {
    setToDate(toValue ? new Date(toValue) : undefined)
  }, [toValue])

  const handleFromSelect = (selectedDate: Date | undefined) => {
    setFromDate(selectedDate)
    if (selectedDate) {
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      onFromChange(`${year}-${month}-${day}`)

      // If "To Date" is before the new "From Date", clear it
      if (toDate && toDate < selectedDate) {
        setToDate(undefined)
        onToChange('')
      }
    } else {
      onFromChange('')
    }
  }

  const handleToSelect = (selectedDate: Date | undefined) => {
    setToDate(selectedDate)
    if (selectedDate) {
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      onToChange(`${year}-${month}-${day}`)
    } else {
      onToChange('')
    }
  }

  const formatDisplayDate = (date: Date | undefined) => {
    if (!date) return null
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* From Date */}
      <div>
        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{fromLabel}</label>
        <Popover modal={true}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal h-10",
                !fromDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDisplayDate(fromDate) || fromPlaceholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 z-[200]"
            align="start"
            side="bottom"
            sideOffset={8}
            avoidCollisions={false}
            sticky="always"
          >
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={handleFromSelect}
              defaultMonth={fromDate}
              initialFocus
              className="rounded-md border"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* To Date */}
      <div>
        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{toLabel}</label>
        <Popover modal={true}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal h-10",
                !toDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDisplayDate(toDate) || toPlaceholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 z-[200]"
            align="start"
            side="bottom"
            sideOffset={8}
            avoidCollisions={false}
            sticky="always"
          >
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={handleToSelect}
              defaultMonth={toDate || fromDate}
              disabled={(date) => fromDate ? date < fromDate : false}
              initialFocus
              className="rounded-md border"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
