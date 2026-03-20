import type { Meeting } from "./types";

export interface FilterParams {
  dateRange?: string;       // "all" | "6months" | "2026" | "2025" | "custom"
  dateFrom?: string;        // YYYY-MM-DD for custom range
  dateTo?: string;          // YYYY-MM-DD for custom range
  categories?: string[];    // category IDs
  commissioners?: string[]; // commissioner IDs
}

export function parseFiltersFromParams(searchParams: URLSearchParams): FilterParams {
  const dateRange = searchParams.get("range") || "all";
  const dateFrom = searchParams.get("from") || undefined;
  const dateTo = searchParams.get("to") || undefined;
  const categories = searchParams.get("cat")?.split(",").filter(Boolean) || [];
  const commissioners = searchParams.get("comm")?.split(",").filter(Boolean) || [];

  return {
    dateRange,
    dateFrom,
    dateTo,
    categories: categories.length > 0 ? categories : undefined,
    commissioners: commissioners.length > 0 ? commissioners : undefined,
  };
}

export function filtersToSearchParams(filters: FilterParams): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.dateRange && filters.dateRange !== "all") {
    params.set("range", filters.dateRange);
  }
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.categories && filters.categories.length > 0) {
    params.set("cat", filters.categories.join(","));
  }
  if (filters.commissioners && filters.commissioners.length > 0) {
    params.set("comm", filters.commissioners.join(","));
  }
  return params;
}

function getDateRange(dateRange: string, dateFrom?: string, dateTo?: string): { start: string; end: string } | null {
  const now = new Date();

  switch (dateRange) {
    case "6months": {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return {
        start: sixMonthsAgo.toISOString().slice(0, 10),
        end: now.toISOString().slice(0, 10),
      };
    }
    case "custom":
      if (dateFrom || dateTo) {
        return {
          start: dateFrom || "1900-01-01",
          end: dateTo || "2099-12-31",
        };
      }
      return null;
    default: {
      // Handle dynamic year values like "2026", "2025", "2024", etc.
      if (/^\d{4}$/.test(dateRange)) {
        return { start: `${dateRange}-01-01`, end: `${dateRange}-12-31` };
      }
      return null;
    }
  }
}

export function filterMeetings(meetings: Meeting[], filters: FilterParams): Meeting[] {
  let result = meetings;

  // Date range filter
  const range = getDateRange(filters.dateRange || "all", filters.dateFrom, filters.dateTo);
  if (range) {
    result = result.filter((m) => m.date >= range.start && m.date <= range.end);
  }

  // Commissioner filter: meeting must have at least one matching commissioner as attendee
  if (filters.commissioners && filters.commissioners.length > 0) {
    result = result.filter((m) =>
      m.attendees.some((a) => filters.commissioners!.includes(a))
    );
  }

  // Category filter: meeting must have at least one topic tagged with a matching category
  if (filters.categories && filters.categories.length > 0) {
    result = result.filter((m) => {
      for (const activity of Object.values(m.commissionerActivity)) {
        for (const topic of activity.topics) {
          if (topic.categories.some((c) => filters.categories!.includes(c))) {
            return true;
          }
        }
      }
      return false;
    });
  }

  return result;
}

export function hasActiveFilters(filters: FilterParams): boolean {
  return (
    (filters.dateRange !== undefined && filters.dateRange !== "all") ||
    (filters.categories !== undefined && filters.categories.length > 0) ||
    (filters.commissioners !== undefined && filters.commissioners.length > 0)
  );
}
