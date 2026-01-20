"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export interface Option {
  value: string
  label: string
}

export interface GroupedOption {
  group: string
  options: Option[]
}

interface MultiSelectProps {
  options?: Option[]
  groupedOptions?: GroupedOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  icon?: React.ReactNode
}

export function MultiSelect({
  options,
  groupedOptions,
  selected,
  onChange,
  placeholder = "Select items...",
  emptyMessage = "No items found.",
  className,
  disabled = false,
  icon,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (value: string) => {
    if (disabled) return
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const handleClear = () => {
    if (disabled) return
    onChange([])
  }

  // Get all options from either flat or grouped
  const allOptions = React.useMemo(() => {
    if (groupedOptions) {
      return groupedOptions.flatMap(g => g.options)
    }
    return options || []
  }, [options, groupedOptions])

  const selectedLabels = selected
    .map((val) => allOptions.find((opt) => opt.value === val)?.label)
    .filter(Boolean)

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
            <div className="flex gap-1 flex-wrap flex-1 min-w-0">
              {selected.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <>
                  {selectedLabels.slice(0, 2).map((label) => (
                    <Badge key={label} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                  {selectedLabels.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{selectedLabels.length - 2} more
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search...`} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {selected.length > 0 && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleClear}
                  className="justify-center text-center text-muted-foreground"
                >
                  Clear all
                </CommandItem>
              </CommandGroup>
            )}
            {groupedOptions ? (
              groupedOptions.map((group) => (
                <CommandGroup key={group.group} heading={group.group}>
                  {group.options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleSelect(option.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selected.includes(option.value) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            ) : (
              <>
                {selected.length > 0 && (
                  <CommandGroup heading="Selected">
                    {allOptions
                      .filter((option) => selected.includes(option.value))
                      .map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.label}
                          onSelect={() => handleSelect(option.value)}
                        >
                          <Check className="mr-2 h-4 w-4 opacity-100" />
                          {option.label}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
                <CommandGroup heading={selected.length > 0 ? "All Options" : undefined}>
                  {allOptions
                    .filter((option) => !selected.includes(option.value))
                    .map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => handleSelect(option.value)}
                      >
                        <Check className="mr-2 h-4 w-4 opacity-0" />
                        {option.label}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
