import type { PublicStatement, StoredStatement } from "./types";
import statements from "@/data/statements.json";

/** Public statements grouped by commissioner, newest first. Source: src/data/statements.json */
export const PUBLIC_STATEMENTS: Record<string, PublicStatement[]> = {};

for (const { commissionerId, ...statement } of [...(statements as StoredStatement[])].sort((a, b) =>
  b.date.localeCompare(a.date),
)) {
  (PUBLIC_STATEMENTS[commissionerId] ??= []).push(statement);
}
