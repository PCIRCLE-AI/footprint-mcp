import * as path from "node:path";
import type {
  SessionMessageRecord,
  SessionRecord,
  TimelineEventRecord,
} from "./storage/index.js";

export interface MessageSummary {
  total: number;
  byRole: {
    user: number;
    assistant: number;
    system: number;
  };
  firstCapturedAt: string | null;
  lastCapturedAt: string | null;
  preview: string | null;
}

export interface TimelineSummary {
  total: number;
  eventTypes: string[];
  statuses: string[];
  firstStartedAt: string | null;
  lastEndedAt: string | null;
}

export const DEFAULT_SESSION_DETAIL_PAGE_LIMIT = 50;
export const MAX_SESSION_DETAIL_PAGE_LIMIT = 200;

export interface PageInfo {
  total: number;
  offset: number;
  limit: number;
  returned: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface SessionListItem {
  id: string;
  host: SessionRecord["host"];
  title: string | null;
  label: string;
  status: SessionRecord["status"];
  startedAt: string;
  endedAt: string | null;
  cwd: string;
  projectRoot: string;
}

export function truncateSummary(value: string, maxLength: number = 80): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function getSessionLabel(
  session: Pick<SessionRecord, "title" | "host" | "cwd">,
): string {
  if (session.title && session.title.trim()) {
    return session.title;
  }

  const cwdLabel = path.basename(session.cwd) || session.cwd;
  return `${session.host} session @ ${cwdLabel}`;
}

export function toSessionListItem(session: SessionRecord): SessionListItem {
  return {
    id: session.id,
    host: session.host,
    title: session.title,
    label: getSessionLabel(session),
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    cwd: session.cwd,
    projectRoot: session.projectRoot,
  };
}

export function buildMessageSummary(
  messages: SessionMessageRecord[],
): MessageSummary {
  return {
    total: messages.length,
    byRole: {
      user: messages.filter((message) => message.role === "user").length,
      assistant: messages.filter((message) => message.role === "assistant")
        .length,
      system: messages.filter((message) => message.role === "system").length,
    },
    firstCapturedAt: messages[0]?.capturedAt ?? null,
    lastCapturedAt: messages.at(-1)?.capturedAt ?? null,
    preview: messages[0] ? truncateSummary(messages[0].content) : null,
  };
}

export function buildTimelineSummary(
  timeline: TimelineEventRecord[],
): TimelineSummary {
  return {
    total: timeline.length,
    eventTypes: [...new Set(timeline.map((event) => event.eventType))],
    statuses: [
      ...new Set(
        timeline
          .map((event) => event.status)
          .filter((status): status is string => Boolean(status)),
      ),
    ],
    firstStartedAt: timeline[0]?.startedAt ?? null,
    lastEndedAt: timeline.at(-1)?.endedAt ?? timeline.at(-1)?.startedAt ?? null,
  };
}

export function buildPageInfo(
  total: number,
  returned: number,
  options?: {
    offset?: number;
    limit?: number;
  },
): PageInfo {
  const offset = options?.offset ?? 0;
  const normalizedTotal = Math.max(total, 0);
  const normalizedReturned = Math.max(returned, 0);
  const limit =
    options?.limit ?? Math.max(normalizedReturned, normalizedTotal - offset, 0);
  const nextOffset = offset + normalizedReturned;
  const hasMore = nextOffset < normalizedTotal;

  return {
    total: normalizedTotal,
    offset,
    limit,
    returned: normalizedReturned,
    hasMore,
    nextOffset: hasMore ? nextOffset : null,
  };
}
