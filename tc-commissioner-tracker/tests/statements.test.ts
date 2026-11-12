import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeStatements, searchWindowStart } from "../scripts/lib/statements";
import type { StoredStatement } from "../src/lib/types";

const statement = (overrides: Partial<StoredStatement> = {}): StoredStatement => ({
  commissionerId: "mccall",
  date: "2026-10-20",
  source: "Transylvania Times",
  type: "news",
  text: "Announced a budget workshop.",
  url: "https://www.transylvaniatimes.com/news/article-1.html",
  categories: ["fiscal"],
  ...overrides,
});

const base = { commissionerIds: ["mccall", "chapman"], since: "2026-10-01", today: "2026-11-12" };

test("adds new statements and skips ones already recorded", () => {
  const existing = [statement()];
  const fresh = statement({ commissionerId: "chapman", url: "https://www.transylvaniatimes.com/news/article-2.html" });
  const sameWithTracking = statement({ url: "https://www.transylvaniatimes.com/news/article-1.html?utm_source=x#top" });
  const result = mergeStatements({ ...base, existing, found: [fresh, sameWithTracking, fresh] });
  assert.deepEqual(result.added, [fresh]);
  assert.equal(result.merged.length, 2);
  assert.deepEqual(result.rejected, []);
});

test("rejects statements outside the window, without a link, or for unknown people", () => {
  const result = mergeStatements({
    ...base,
    existing: [],
    found: [
      statement({ date: "2026-09-30", url: "https://a.example/1" }),
      statement({ date: "2026-11-13", url: "https://a.example/2" }),
      statement({ url: undefined }),
      statement({ commissionerId: "nobody", url: "https://a.example/3" }),
    ],
  });
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.rejected.map((r) => r.reason), [
    "dated outside 2026-10-01 to 2026-11-12",
    "dated outside 2026-10-01 to 2026-11-12",
    "no link to the source",
    "unknown commissioner",
  ]);
});

test("rejects links the search never returned", () => {
  const real = statement({ url: "https://www.transylvaniatimes.com/news/real.html" });
  const invented = statement({ url: "https://www.transylvaniatimes.com/news/invented.html" });
  const result = mergeStatements({ ...base, existing: [], found: [real, invented], searchedUrls: ["https://www.transylvaniatimes.com/news/real.html/"] });
  assert.deepEqual(result.added, [real]);
  assert.deepEqual(result.rejected.map((r) => r.reason), ["link was not among the search results"]);
});

test("search window starts two weeks before the newest news item, capped at 90 days", () => {
  assert.equal(searchWindowStart([statement({ date: "2026-10-20" }), statement({ date: "2026-11-01", type: "statement" })], "2026-11-12"), "2026-10-06");
  assert.equal(searchWindowStart([statement({ date: "2025-12-28" })], "2026-11-12"), "2026-08-14");
  assert.equal(searchWindowStart([], "2026-11-12"), "2026-08-14");
});
