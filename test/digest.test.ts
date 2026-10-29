import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('aggregates jobs and preserves timestamp offsets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    tempDirs.push(dir);
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      [
        '{"at":"2026-10-28T23:00:02+01:00","job":"b","status":"retry","owner":"rook","error":"busy"}',
        '{"at":"2026-10-28T23:01:02+01:00","job":"b","status":"ok","owner":"rook"}',
        '{"at":"2026-10-28T23:02:02+01:00","job":"a","status":"fail","owner":null,"error":"broken"}',
      ].join('\n'),
    );

    expect(readNight(dir, '2026-10-28')).toEqual({
      rows: [
        {
          job: 'b', owner: 'rook', runs: 2, retries: 1, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:01:02+01:00',
        },
        {
          job: 'a', owner: null, runs: 1, retries: 0, lastStatus: 'fail', lastError: 'broken',
          firstAt: '2026-10-28T23:02:02+01:00', lastAt: '2026-10-28T23:02:02+01:00',
        },
      ],
      malformedLines: 0,
      counts: { ok: 1, retry: 1, fail: 1 },
    });
  });

  it('counts malformed lines and keeps valid rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    tempDirs.push(dir);
    writeFileSync(join(dir, '2026-10-28.jsonl'), '{"at":"x","job":"a","status":"ok","owner":null}\nnot json\n');

    const digest = readNight(dir, '2026-10-28');
    expect(digest.rows).toHaveLength(1);
    expect(digest.malformedLines).toBe(1);
    expect(digest.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
  });
});
