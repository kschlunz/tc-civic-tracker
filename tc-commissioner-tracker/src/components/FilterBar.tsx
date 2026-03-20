"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { COMMISSIONERS, CATEGORIES, CATEGORY_ICONS } from "@/lib/constants";
import { useMeetings } from "@/lib/meetings-context";
import { parseFiltersFromParams, filtersToSearchParams, hasActiveFilters, type FilterParams } from "@/lib/filters";

interface FilterBarProps {
  /** Hide category/commissioner filters and only show date range */
  dateOnly?: boolean;
}

export default function FilterBar({ dateOnly = false }: FilterBarProps) {
  const { meetings } = useMeetings();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [showCommDropdown, setShowCommDropdown] = useState(false);

  const updateFilters = useCallback(
    (updates: Partial<FilterParams>) => {
      const newFilters = { ...filters, ...updates };
      const params = filtersToSearchParams(newFilters);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  const clearFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  const toggleCategory = useCallback(
    (catId: string) => {
      const current = filters.categories || [];
      const next = current.includes(catId)
        ? current.filter((c) => c !== catId)
        : [...current, catId];
      updateFilters({ categories: next });
    },
    [filters.categories, updateFilters],
  );

  const toggleCommissioner = useCallback(
    (commId: string) => {
      const current = filters.commissioners || [];
      const next = current.includes(commId)
        ? current.filter((c) => c !== commId)
        : [...current, commId];
      updateFilters({ commissioners: next });
    },
    [filters.commissioners, updateFilters],
  );

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    for (const m of meetings) {
      years.add(m.date.slice(0, 4));
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [meetings]);

  const dateRangeOptions = [
    { value: "all", label: "All Time" },
    { value: "6months", label: "Last 6 Months" },
    ...yearOptions.map((y) => ({ value: y, label: y })),
    { value: "custom", label: "Custom" },
  ];

  const active = hasActiveFilters(filters);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-tight text-on-surface-variant border border-outline-variant/30 rounded-lg w-full justify-center"
      >
        <span className="material-symbols-outlined text-[16px]">filter_list</span>
        Filters
        {active && <span className="w-2 h-2 rounded-full bg-primary" />}
        <span className="material-symbols-outlined text-[16px] ml-auto">{mobileOpen ? "expand_less" : "expand_more"}</span>
      </button>

      <div className={`flex-wrap items-center gap-3 ${mobileOpen ? "flex" : "hidden md:flex"}`}>
      {/* Date Range */}
      <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1 overflow-x-auto">
        {dateRangeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateFilters({ dateRange: opt.value, dateFrom: undefined, dateTo: undefined })}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-tight rounded transition-colors ${
              (filters.dateRange || "all") === opt.value
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {filters.dateRange === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateFrom || ""}
            onChange={(e) => updateFilters({ dateFrom: e.target.value || undefined })}
            className="bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1.5 text-xs font-label focus:ring-1 focus:ring-primary focus:border-primary outline-none"
          />
          <span className="text-xs text-on-surface-variant">to</span>
          <input
            type="date"
            value={filters.dateTo || ""}
            onChange={(e) => updateFilters({ dateTo: e.target.value || undefined })}
            className="bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1.5 text-xs font-label focus:ring-1 focus:ring-primary focus:border-primary outline-none"
          />
        </div>
      )}

      {!dateOnly && (
        <>
          {/* Category Dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowCatDropdown(!showCatDropdown); setShowCommDropdown(false); }}
              className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-tight rounded-lg border transition-colors ${
                filters.categories && filters.categories.length > 0
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-outline-variant/30 text-on-surface-variant hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">category</span>
              Topics
              {filters.categories && filters.categories.length > 0 && (
                <span className="bg-primary text-on-primary rounded-full w-4 h-4 text-[9px] flex items-center justify-center">
                  {filters.categories.length}
                </span>
              )}
            </button>
            {showCatDropdown && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-xl p-2 w-64 max-h-72 overflow-y-auto">
                {CATEGORIES.map((cat) => {
                  const icon = CATEGORY_ICONS[cat.id];
                  const selected = filters.categories?.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs font-label transition-colors ${
                        selected ? "bg-primary/10 text-primary font-bold" : "text-on-surface hover:bg-surface-container-high"
                      }`}
                    >
                      {icon && <span className="material-symbols-outlined text-[16px]">{icon}</span>}
                      <span className="flex-1">{cat.label}</span>
                      {selected && <span className="material-symbols-outlined text-[16px]">check</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Commissioner Dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowCommDropdown(!showCommDropdown); setShowCatDropdown(false); }}
              className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-tight rounded-lg border transition-colors ${
                filters.commissioners && filters.commissioners.length > 0
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-outline-variant/30 text-on-surface-variant hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">groups</span>
              Commissioners
              {filters.commissioners && filters.commissioners.length > 0 && (
                <span className="bg-primary text-on-primary rounded-full w-4 h-4 text-[9px] flex items-center justify-center">
                  {filters.commissioners.length}
                </span>
              )}
            </button>
            {showCommDropdown && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-xl p-2 w-56">
                {COMMISSIONERS.map((comm) => {
                  const selected = filters.commissioners?.includes(comm.id);
                  return (
                    <button
                      key={comm.id}
                      onClick={() => toggleCommissioner(comm.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs font-label transition-colors ${
                        selected ? "bg-primary/10 text-primary font-bold" : "text-on-surface hover:bg-surface-container-high"
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: comm.color }} />
                      <span className="flex-1">{comm.name}</span>
                      {selected && <span className="material-symbols-outlined text-[16px]">check</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Clear Filters */}
      {active && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase tracking-tight text-error hover:bg-error/5 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
          Clear
        </button>
      )}
      </div>
    </div>
  );
}
