import type { ListedMeeting } from "../scripts/lib/county";
import type { Extraction, Llm, Review } from "../scripts/lib/extraction";
import type { CommissionerRecord, StoredMeeting } from "../src/lib/types";

export const ROSTER: CommissionerRecord[] = [
  { id: "mccall", name: "Teresa McCall", color: "#111", since: "2020", terms: [{ start: "2020-12-07" }], roles: [{ role: "Chair", start: "2025-12-08" }] },
  { id: "chapman", name: "Larry Chapman", color: "#222", since: "2010", terms: [{ start: "2010-12-06" }], roles: [] },
  { id: "dalton", name: "Jake Dalton", color: "#333", since: "2020", terms: [{ start: "2020-12-07", end: "2026-12-07" }], roles: [], note: "Not running '26" },
];

export function listed(date: string, overrides: Partial<ListedMeeting> = {}): ListedMeeting & { minutesUrl: string } {
  return {
    date,
    title: `Commissioners' Meeting ${date}`,
    type: "regular",
    time: "4:00 PM",
    pageUrl: `https://www.transylvaniacounty.org/meetings/${date}`,
    minutesUrl: `https://www.transylvaniacounty.org/sites/default/files/minutes/${date}%20reg%20mtg.pdf`,
    ...overrides,
  };
}

export function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    duration: "2 hours",
    audienceSize: null,
    attendees: ["mccall", "chapman", "dalton"],
    tldr: "The board approved a contract and heard a budget update.",
    keyVotes: [
      {
        description: "Approve paving contract ($120,000)",
        consent: false,
        mover: "chapman",
        seconder: "dalton",
        ayes: ["chapman", "dalton"],
        nays: ["mccall"],
        abstained: [],
        absent: [],
        rollCallKnown: true,
        passed: true,
        background: "Staff recommended the low bidder.",
        discussion: "McCall objected to the cost.",
        page: 4,
      },
    ],
    commissionerActivity: [{ commissioner: "mccall", topics: [{ text: "Questioned the paving cost.", categories: ["fiscal"] }], externalRoles: [] }],
    publicComments: [{ speaker: "Pat Doe", summary: "Asked for sidewalk repairs." }],
    newFollowUps: [{ owner: "staff", description: "Bring back a sidewalk plan.", categories: ["infrastructure"] }],
    followUpUpdates: [],
    ...overrides,
  };
}

export function storedMeeting(date: string, overrides: Partial<StoredMeeting> = {}): StoredMeeting {
  return {
    id: date,
    date,
    type: "regular",
    time: "4:00 PM",
    duration: null,
    audienceSize: null,
    attendees: ["mccall", "chapman", "dalton"],
    tldr: "Summary.",
    keyVotes: [],
    commissionerActivity: {},
    publicComments: [],
    followUps: [],
    sourceUrl: `https://www.transylvaniacounty.org/minutes/${date}.pdf`,
    ...overrides,
  };
}

/** A stand-in model: answers each task from a queue and records what it was asked. */
export function fakeLlm(answers: { extract?: Extraction[]; revise?: Extraction[]; review?: Review[] }) {
  const calls: { task: string; instructions: string; system: string }[] = [];
  const queues = { extract: [...(answers.extract ?? [])], revise: [...(answers.revise ?? [])], review: [...(answers.review ?? [])] };
  const llm: Llm = async (request) => {
    calls.push({ task: request.task, instructions: request.instructions, system: request.system });
    const queue = queues[request.task as keyof typeof queues];
    const answer = queue.length > 0 ? queue.shift() : request.task === "review" ? { issues: [] } : undefined;
    if (answer === undefined) throw new Error(`fakeLlm: no answer queued for "${request.task}"`);
    return request.schema.parse(answer);
  };
  return { llm, calls };
}
