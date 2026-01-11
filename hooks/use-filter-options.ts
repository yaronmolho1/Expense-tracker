import { useQuery } from '@tanstack/react-query';

export interface FilterOption {
  value: string | number;
  label: string;
}

export interface CategoryOption extends FilterOption {
  name: string;
  children?: FilterOption[];
}

export interface CardOption extends FilterOption {
  owner: string;
}

export interface FilterOptions {
  businesses: FilterOption[];
  categories: {
    parents: FilterOption[];
    tree: CategoryOption[];
  };
  cards: CardOption[];
  transactionTypes: FilterOption[];
  statuses: FilterOption[];
}

async function fetchFilterOptions(): Promise<FilterOptions> {
  const response = await fetch('/api/filter-options');
  if (!response.ok) {
    throw new Error('Failed to fetch filter options');
  }
  return response.json();
}

export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options'],
    queryFn: fetchFilterOptions,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
