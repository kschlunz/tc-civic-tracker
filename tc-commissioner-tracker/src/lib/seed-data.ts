// Re-exports committed meeting data from JSON files.
// This file exists for backward compatibility — prefer importing from "@/lib/data" directly.
import { getMeetings } from "./data";

export const MEETINGS = getMeetings();
