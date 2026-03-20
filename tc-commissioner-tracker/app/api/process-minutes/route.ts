import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a meeting minutes parser for the Transylvania County Board of Commissioners. Extract structured data from raw meeting minutes text.

Commissioner IDs and names:
- mccall: Teresa McCall
- chapman: Larry Chapman
- chappell: Jason Chappell
- dalton: Jake Dalton
- mckelvey: Chase McKelvey

Category IDs for tagging topics:
- fiscal: Fiscal Policy & Revenue
- schools: Schools & Capital
- safety: Public Safety
- infrastructure: Infrastructure
- econ: Economic Development
- governance: Transparency & Governance
- environment: Environment & Land
- housing: Housing
- health: Health & Human Services
- recovery: Helene Recovery
- community: Community & Culture

Extract the following from the meeting minutes:

1. Meeting metadata: date (YYYY-MM-DD), time, type (regular/special/workshop), attendees as an array of commissioner IDs, estimated audience size, duration estimate, and a TLDR summary of the meeting.

2. All key votes with:
   - description: what was voted on
   - result: "Unanimous" or the vote split like "4-1"
   - mover and seconder as commissioner IDs (use "consent agenda" for consent agenda items)
   - background: 2-3 sentences on why this item was on the agenda, who presented it, and the key facts/numbers discussed
   - discussion: summary of what commissioners said or asked about this item before voting — who raised concerns, what questions were asked, any debate

3. For each commissioner present, extract:
   - Every topic they raised, question they asked, or position they took. Write each as a concise sentence. Tag each with one or more relevant category IDs.
   - Count of motions made and motions seconded.
   - Any external committee roles mentioned (e.g., "NCACC Tax & Finance Subcommittee").

4. All public comments: speaker full name and a summary of what they said.

5. New follow-up items (newFollowUps): Extract any NEW commitments to future action made in THIS meeting. These are moments where a commissioner, the county manager, or staff says something will be done later: "staff will bring this back," "we'll schedule a workshop," "the manager will provide a report," "this will be on the next agenda," etc. For each:
   - id: meeting date + sequential number, e.g. "2026-02-09-fu-1"
   - dateRaised: the meeting date
   - owner: the person who owns this commitment. Use commissioner IDs for commissioners. For county staff, use their full name when mentioned in the minutes — common staff names include: County Manager Jaime Laughter, Finance Director Meagan O'Neal, IT Director Nathanael Carver, Project Manager Beecher Allison. Only use "staff" when the minutes don't specify an individual.
   - description: what was committed to
   - status: "open" (always open when first extracted)
   - categories: relevant category IDs
   - relatedMeetingId: the meeting ID

6. Resolved follow-ups (resolvedFollowUps): If open follow-up items from previous meetings are provided below, check whether any of them are addressed, updated, or resolved in these minutes. For each match:
   - id: the original follow-up item ID
   - status: "in_progress" if partially addressed, "resolved" if fully completed
   - resolution: brief description of what happened (1-2 sentences)

Only include resolvedFollowUps entries for items you are confident are addressed in the minutes. Do not guess.

Use the meeting date as the id field (e.g., "2026-02-09").

Generate a sourceUrl for the official minutes PDF using this pattern:
https://www.transylvaniacounty.org/sites/default/files/departments/administration/minutes/YYYY-MM-DD%20reg%20mtg.pdf
Replace YYYY-MM-DD with the meeting date. Use "reg%20mtg" for regular meetings and "special%20mtg" for special meetings.

Return ONLY raw JSON. No markdown fences. No preamble. No explanation. Start with { and end with }

The JSON must match this TypeScript interface:

{
  id: string;
  date: string;
  type: string;
  time: string;
  sourceUrl: string;
  attendees: string[];
  audienceSize: number;
  duration: string;
  tldr: string;
  keyVotes: Array<{
    description: string;
    result: string;
    mover: string;
    seconder: string;
    background: string;
    discussion: string;
  }>;
  commissionerActivity: Record<string, {
    topics: Array<{ text: string; categories: string[] }>;
    motionsMade: number;
    motionsSeconded: number;
    externalRoles: string[];
  }>;
  publicComments: Array<{
    speaker: string;
    summary: string;
  }>;
  followUps: Array<{
    id: string;
    dateRaised: string;
    owner: string;
    description: string;
    status: "open";
    categories: string[];
    relatedMeetingId: string;
  }>;
  resolvedFollowUps: Array<{
    id: string;
    status: "in_progress" | "resolved";
    resolution: string;
  }>;
}`;

interface OpenFollowUp {
  id: string;
  dateRaised: string;
  owner: string;
  description: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { minutesText?: string; openFollowUps?: OpenFollowUp[] };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { minutesText, openFollowUps } = body;
  if (!minutesText || typeof minutesText !== "string") {
    return Response.json(
      { error: "minutesText is required and must be a string" },
      { status: 400 }
    );
  }

  // Build user message with optional open follow-ups context
  let userContent = `Parse the following meeting minutes and return structured JSON:\n\n${minutesText}`;

  if (openFollowUps && openFollowUps.length > 0) {
    const followUpsList = openFollowUps
      .map((f) => `- [${f.id}] (raised ${f.dateRaised} by ${f.owner}): ${f.description}`)
      .join("\n");
    userContent += `\n\n---\n\nHere are currently open follow-up items from previous meetings. If any of these are addressed, updated, or resolved in the minutes above, include them in the resolvedFollowUps array:\n\n${followUpsList}`;
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
        {
          role: "assistant",
          content: "{",
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json(
        { error: "No text response from Claude" },
        { status: 500 }
      );
    }

    // Prepend the "{" prefill and strip any markdown fences
    let jsonText = ("{" + textBlock.text).trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const meeting = JSON.parse(jsonText);
    return Response.json(meeting);
  } catch (error) {
    console.error("Error processing minutes:", error);

    if (error instanceof SyntaxError) {
      console.error("Raw Claude response that failed to parse as JSON:");
      console.error((error as SyntaxError).message);
      return Response.json(
        { error: "Failed to parse Claude response as JSON" },
        { status: 500 }
      );
    }

    return Response.json(
      { error: "Failed to process meeting minutes" },
      { status: 500 }
    );
  }
}
