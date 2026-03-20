import { Commissioner, Category } from "./types";

export const COMMISSIONERS: Commissioner[] = [
  { id: "mccall", name: "Teresa McCall", role: "Chair", since: "2020", color: "#2D5A3D" },
  { id: "chapman", name: "Larry Chapman", role: "Vice-Chair", since: "2010", color: "#8B4513" },
  { id: "chappell", name: "Jason Chappell", role: "Commissioner", since: "2004", color: "#1B4F72" },
  { id: "dalton", name: "Jake Dalton", role: "Commissioner", since: "2020", color: "#6B3A5D" },
  { id: "mckelvey", name: "Chase McKelvey", role: "Commissioner", since: "2024", color: "#4A6741" },
];

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

export const ELECTION_INFO = {
  nextElection: "November 2026",
  openSeats: 2,
  note: "Dalton and McKelvey are not running for re-election.",
  gopNominees: ["Howell", "Sutherland"],
  demNominees: ["Carson", "O'Neil"],
};
