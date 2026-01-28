// Shared styling constants for filter components
// Ensures consistent visual design across all filter implementations

export const FILTER_STYLES = {
  card: {
    default: "mb-6 transition-all duration-200 shadow-sm",
    active: "border-2 border-primary/20 shadow-md"
  },
  header: "pb-2 pt-2 px-3 md:px-4",
  content: "px-3 md:px-4 pb-2",
  spacing: "space-y-2 md:space-y-3",
  badge: "h-5 px-2 text-xs",
  clearButton: "mt-3 pt-3 border-t",
  gridGap: "gap-2 md:gap-3"
} as const;
