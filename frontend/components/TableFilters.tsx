import { Search } from "lucide-react";

type FilterOption = {
  label: string;
  value: string;
};

export function TableFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  filters = [],
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }>;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-ink-100 bg-white p-3 shadow-soft lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{searchPlaceholder}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-md border border-ink-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-compliance-green focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      {filters.map((filter) => (
        <label key={filter.label} className="grid gap-1 text-xs font-bold uppercase text-ink-500 lg:w-52">
          {filter.label}
          <select
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
            className="h-10 rounded-md border border-ink-200 bg-white px-3 text-sm font-semibold normal-case text-ink-700 outline-none transition focus:border-compliance-green focus:ring-2 focus:ring-emerald-100"
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
