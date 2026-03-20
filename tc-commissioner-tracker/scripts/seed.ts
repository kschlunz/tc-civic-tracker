/**
 * Seed script: loads local JSON meeting files and public statements into Supabase.
 *
 * Usage: npx tsx scripts/seed.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Meeting {
  id: string;
  date: string;
  type: string;
  time: string;
  attendees: string[];
  audienceSize: number;
  duration: string;
  tldr: string;
  keyVotes: unknown[];
  commissionerActivity: Record<string, unknown>;
  publicComments: unknown[];
  followUps?: unknown[];
  sourceUrl?: string;
  agendaUrl?: string;
}

async function seedMeetings() {
  const meetingsDir = path.resolve(__dirname, "../src/data/meetings");

  if (!fs.existsSync(meetingsDir)) {
    console.log("No meetings directory found at", meetingsDir);
    return;
  }

  const files = fs.readdirSync(meetingsDir).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} meeting file(s)`);

  for (const file of files) {
    const raw = fs.readFileSync(path.join(meetingsDir, file), "utf-8");
    const meeting: Meeting = JSON.parse(raw);

    // Upsert into meetings table
    const { error: meetingError } = await supabase
      .from("meetings")
      .upsert({
        id: meeting.id,
        date: meeting.date,
        type: meeting.type,
        time: meeting.time,
        attendees: meeting.attendees,
        audience_size: meeting.audienceSize,
        duration: meeting.duration,
        tldr: meeting.tldr,
        key_votes: meeting.keyVotes,
        commissioner_activity: meeting.commissionerActivity,
        public_comments: meeting.publicComments,
        follow_ups: meeting.followUps || [],
        source_url: meeting.sourceUrl || null,
        agenda_url: meeting.agendaUrl || null,
      });

    if (meetingError) {
      console.error(`Error upserting meeting ${meeting.id}:`, meetingError.message);
    } else {
      console.log(`  Upserted meeting: ${meeting.id}`);
    }

    // Upsert follow-ups into follow_ups table
    if (meeting.followUps && meeting.followUps.length > 0) {
      for (const fu of meeting.followUps as Record<string, unknown>[]) {
        const owner = (fu.owner as string) || (fu.raisedBy as string) || "staff";
        const { error: fuError } = await supabase
          .from("follow_ups")
          .upsert({
            id: fu.id as string,
            date_raised: fu.dateRaised as string,
            owner,
            description: fu.description as string,
            status: (fu.status as string) || "open",
            categories: (fu.categories as string[]) || [],
            related_meeting_id: (fu.relatedMeetingId as string) || meeting.id,
            resolved_date: (fu.resolvedDate as string) || null,
            resolved_meeting_id: (fu.resolvedMeetingId as string) || null,
            resolution: (fu.resolution as string) || null,
            last_referenced_date: (fu.lastReferencedDate as string) || null,
            last_referenced_meeting_id: (fu.lastReferencedMeetingId as string) || null,
          });

        if (fuError) {
          console.error(`  Error upserting follow-up ${fu.id}:`, fuError.message);
        } else {
          console.log(`    Upserted follow-up: ${fu.id}`);
        }
      }
    }
  }
}

async function seedPublicStatements() {
  // Load public statements from the TS source
  const statementsPath = path.resolve(__dirname, "../src/lib/public-statements.ts");
  if (!fs.existsSync(statementsPath)) {
    console.log("No public-statements.ts found");
    return;
  }

  const raw = fs.readFileSync(statementsPath, "utf-8");

  // Extract the data by evaluating the JSON-like structure
  // Parse the object manually from the TS file
  const dataMatch = raw.match(/export const PUBLIC_STATEMENTS[^=]*=\s*(\{[\s\S]*\});?\s*$/);
  if (!dataMatch) {
    console.log("Could not parse public-statements.ts, trying dynamic import...");

    // Try require with tsx
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("../src/lib/public-statements");
      const statements: Record<string, Array<{ date: string; source: string; type: string; text: string; url?: string; categories: string[] }>> = mod.PUBLIC_STATEMENTS;

      let count = 0;
      for (const [commId, stmts] of Object.entries(statements)) {
        for (const stmt of stmts) {
          const { error } = await supabase
            .from("public_statements")
            .upsert(
              {
                commissioner_id: commId,
                date: stmt.date,
                source: stmt.source,
                type: stmt.type,
                text: stmt.text,
                url: stmt.url || null,
                categories: stmt.categories || [],
              },
              { onConflict: "commissioner_id,date,source" }
            );

          if (error) {
            // If unique constraint doesn't exist, try insert
            const { error: insertError } = await supabase
              .from("public_statements")
              .insert({
                commissioner_id: commId,
                date: stmt.date,
                source: stmt.source,
                type: stmt.type,
                text: stmt.text,
                url: stmt.url || null,
                categories: stmt.categories || [],
              });

            if (insertError) {
              console.error(`  Error inserting statement for ${commId}:`, insertError.message);
            } else {
              count++;
            }
          } else {
            count++;
          }
        }
      }
      console.log(`Seeded ${count} public statements`);
      return;
    } catch (e) {
      console.error("Failed to load public-statements:", e);
      return;
    }
  }
}

async function main() {
  console.log("Seeding Supabase...");
  console.log(`URL: ${supabaseUrl}`);
  console.log("");

  await seedMeetings();
  console.log("");
  await seedPublicStatements();

  console.log("");
  console.log("Done!");
}

main().catch(console.error);
