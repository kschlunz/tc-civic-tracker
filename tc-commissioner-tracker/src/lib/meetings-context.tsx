"use client";

import { createContext, useContext } from "react";
import type { Meeting } from "./types";
import { getMeetings } from "./data";

interface MeetingsContextValue {
  /** All meetings, newest first. */
  meetings: Meeting[];
}

const MeetingsContext = createContext<MeetingsContextValue | null>(null);

export function MeetingsProvider({ children }: { children: React.ReactNode }) {
  return <MeetingsContext.Provider value={{ meetings: getMeetings() }}>{children}</MeetingsContext.Provider>;
}

export function useMeetings() {
  const ctx = useContext(MeetingsContext);
  if (!ctx) throw new Error("useMeetings must be used within MeetingsProvider");
  return ctx;
}
