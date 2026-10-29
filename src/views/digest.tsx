import type { DigestRow, NightDigest } from '../digest/types.js';

function missing(value: string | null): string {
  return value ?? '—';
}

function rowClass(row: DigestRow): string | undefined {
  return row.retries >= 3 || row.lastStatus === 'fail' ? 'warn' : undefined;
}

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last status</th>
              <th>last error</th><th>first time</th><th>last time</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={rowClass(row)}>
                <td>{row.job}</td>
                <td>{missing(row.owner)}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{missing(row.lastError)}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.malformedLines > 0 && <p class="warn">malformed lines: {digest.malformedLines}</p>}
    </>
  );
}
