import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest } from './types.js';

type LogEvent = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isLogEvent(value: unknown): value is LogEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.at === 'string' &&
    typeof event.job === 'string' &&
    (event.status === 'ok' || event.status === 'retry' || event.status === 'fail') &&
    (typeof event.owner === 'string' || event.owner === null) &&
    (event.error === undefined || typeof event.error === 'string')
  );
}

export function readNight(runsDir: string, night: string): NightDigest {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) throw new Error('invalid night');
  const content = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const rows = new Map<string, DigestRow>();
  let malformedLines = 0;
  const counts: Record<DigestStatus, number> = { ok: 0, retry: 0, fail: 0 };

  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      malformedLines += 1;
      continue;
    }
    if (!isLogEvent(parsed)) {
      malformedLines += 1;
      continue;
    }

    counts[parsed.status] += 1;

    const previous = rows.get(parsed.job);
    if (!previous) {
      rows.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error ?? null,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }

    previous.owner = parsed.owner;
    previous.runs += 1;
    if (parsed.status === 'retry') previous.retries += 1;
    previous.lastStatus = parsed.status;
    previous.lastError = parsed.error ?? null;
    previous.lastAt = parsed.at;
  }

  return { rows: [...rows.values()], malformedLines, counts };
}
