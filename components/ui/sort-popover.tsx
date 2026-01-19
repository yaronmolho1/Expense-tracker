'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SortOption {
  value: string;        // e.g., "bank_charge_date:desc"
  label: string;        // e.g., "Date (Newest first)"
  icon?: React.ReactNode;
}

export interface SortPopoverProps {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
  align?: 'start' | 'center' | 'end';
}

export function SortPopover({ value, options, onChange, align = 'end' }: SortPopoverProps) {
  // Extract direction from value if it follows "field:direction" pattern
  const getDirectionIcon = (optionValue: string) => {
    if (optionValue.endsWith(':asc')) {
      return <ArrowUp className="h-3 w-3 text-muted-foreground" />;
    } else if (optionValue.endsWith(':desc')) {
      return <ArrowDown className="h-3 w-3 text-muted-foreground" />;
    }
    return null;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Sort options"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[240px] p-3">
        <div className="space-y-2">
          <h4 className="text-sm font-medium leading-none mb-3">Sort by</h4>
          <RadioGroup value={value} onValueChange={onChange}>
            <div className="space-y-1">
              {options.map((option) => {
                const isSelected = value === option.value;
                return (
                  <div
                    key={option.value}
                    className={cn(
                      "flex items-center space-x-2 rounded-md px-2 py-2 cursor-pointer hover:bg-accent transition-colors",
                      isSelected && "bg-accent"
                    )}
                    onClick={() => onChange(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                    <Label
                      htmlFor={option.value}
                      className="flex items-center justify-between flex-1 cursor-pointer text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </span>
                      <span className="flex items-center gap-1">
                        {getDirectionIcon(option.value)}
                        {isSelected && <Check className="h-3 w-3 text-primary" />}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
