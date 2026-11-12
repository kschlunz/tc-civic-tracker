import type { Commissioner, CommissionerRecord, Category, Election } from "./types";
import { buildRoster, todayISO } from "./roster";
import commissionerRecords from "@/data/commissioners.json";
import electionData from "@/data/election.json";

/**
 * Everyone who appears in the tracked record, sitting members first. Roles and
 * "current" are worked out for today's date from src/data/commissioners.json,
 * so a change of board needs a data edit, not a code change.
 */
export const COMMISSIONERS: Commissioner[] = buildRoster(commissionerRecords as CommissionerRecord[], todayISO());

/** Sitting commissioners only. */
export const CURRENT_COMMISSIONERS: Commissioner[] = COMMISSIONERS.filter((c) => c.current);

export const CATEGORIES: Category[] = [
  { id: "fiscal", label: "Fiscal Policy & Revenue", icon: "💰", color: "#D4A843" },
  { id: "schools", label: "Schools & Capital", icon: "🏫", color: "#5B8C5A" },
  { id: "safety", label: "Public Safety", icon: "🛡️", color: "#C0392B" },
  { id: "infrastructure", label: "Infrastructure", icon: "🔧", color: "#7D8CA3" },
  { id: "econ", label: "Economic Development", icon: "📈", color: "#2E86AB" },
  { id: "governance", label: "Transparency & Governance", icon: "🏛️", color: "#8E6C88" },
  { id: "environment", label: "Environment & Land", icon: "🌲", color: "#3A7D44" },
  { id: "housing", label: "Housing", icon: "🏠", color: "#C97B3D" },
  { id: "health", label: "Health & Human Services", icon: "❤️", color: "#E74C5E" },
  { id: "recovery", label: "Helene Recovery", icon: "🌀", color: "#5DADE2" },
  { id: "community", label: "Community & Culture", icon: "🤝", color: "#AF7AC5" },
];

/** Material Symbols Outlined icon name for each category */
export const CATEGORY_ICONS: Record<string, string> = {
  fiscal: "account_balance_wallet",
  schools: "school",
  safety: "shield",
  infrastructure: "construction",
  econ: "trending_up",
  governance: "visibility",
  environment: "eco",
  housing: "home",
  health: "favorite",
  recovery: "cyclone",
  community: "diversity_3",
};

export const ELECTION: Election = electionData as Election;
