import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function appWithNight(name: string, content: string) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, `${name}.jsonl`), content);
  return createApp({ adapter: 'test', installed: 'now', beatEverySeconds: 60, runsDir: dir });
}

describe('digest routes', () => {
  it('renders a sorted digest page and marks retries and failures', async () => {
    const app = appWithNight(
      '2026-10-28',
      [
        '{"at":"2026-10-28T01:00:00+01:00","job":"z-job","status":"fail","owner":null,"error":"broken"}',
        '{"at":"2026-10-28T00:00:00+01:00","job":"a-job","status":"retry","owner":"rook"}',
        '{"at":"2026-10-28T00:01:00+01:00","job":"a-job","status":"retry","owner":"rook"}',
        '{"at":"2026-10-28T00:02:00+01:00","job":"a-job","status":"retry","owner":"rook"}',
      ].join('\n'),
    );

    const response = await app.request('/digest/2026-10-28');
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html.indexOf('a-job')).toBeLessThan(html.indexOf('z-job'));
    expect(html).toContain('class="warn"');
    expect(html).toContain('—');
    expect(html).not.toContain('<script');
  });

  it('returns the same sorted rows from the JSON endpoint', async () => {
    const app = appWithNight(
      '2026-10-28',
      '{"at":"2026-10-28T00:00:00+01:00","job":"b","status":"ok","owner":"rook"}\n{"at":"2026-10-28T00:01:00+01:00","job":"a","status":"ok","owner":"rook"}',
    );

    const response = await app.request('/api/digest/2026-10-28');
    expect(response.status).toBe(200);
    expect((await response.json()).rows.map((row: { job: string }) => row.job)).toEqual(['a', 'b']);
  });

  it('returns 404 for a missing night', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
    tempDirs.push(dir);
    const app = createApp({ adapter: 'test', installed: 'now', beatEverySeconds: 60, runsDir: dir });

    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders an empty night and a night with a bad line', async () => {
    const empty = appWithNight('2026-10-27', '');
    expect(await (await empty.request('/digest/2026-10-27')).text()).toContain('nothing ran');

    const bad = appWithNight('2026-10-26', 'not json\n{"at":"x","job":"ok","status":"ok","owner":null}');
    const response = await bad.request('/api/digest/2026-10-26');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ malformedLines: 1, rows: [{ job: 'ok' }] });
  });
});
