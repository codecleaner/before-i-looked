import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/reader.js';
import type { NightDigest } from './digest/types.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function ordered(digest: NightDigest): NightDigest {
  return { ...digest, rows: [...digest.rows].sort((a, b) => a.job.localeCompare(b.job)) };
}

function loadNight(config: RigConfig, night: string): NightDigest | null {
  try {
    return ordered(readNight(config.runsDir, night));
  } catch {
    return null;
  }
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const digest = loadNight(config, night);
    if (!digest) return c.notFound();
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestPage night={night} digest={digest} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const digest = loadNight(config, c.req.param('night'));
    if (!digest) return c.notFound();
    return c.json(digest);
  });

  return app;
}
