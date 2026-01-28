'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleFilterProps {
  children: React.ReactNode;
  header: React.ReactNode;
  defaultOpen?: boolean;
  sticky?: boolean;
  className?: string;
}

export function CollapsibleFilter({
  children,
  header,
  defaultOpen = true,
  sticky = true,
  className,
}: CollapsibleFilterProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card
      className={cn(
        'mb-6 transition-all duration-200',
        sticky && 'sticky top-[72px] z-10 bg-white',
        className
      )}
    >
      <CardHeader
        className="pb-2 pt-2 px-4 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 flex-1">
            {header}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isOpen && <CardContent className="px-4 pb-2">{children}</CardContent>}
    </Card>
  );
}
