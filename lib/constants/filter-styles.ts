// Shared styling constants for filter components
// Ensures consistent visual design across all filter implementations

export const FILTER_STYLES = {
  card: {
    default: "mb-6 transition-all duration-200",
    active: "border-2 border-primary/20 shadow-sm"
  },
  header: "pb-3 pt-4 px-4",
  content: "px-4 pb-4",
  spacing: "space-y-3",
  badge: "h-5 px-2",
  clearButton: "mt-3 pt-3 border-t",
  gridGap: "gap-3"
} as const;
