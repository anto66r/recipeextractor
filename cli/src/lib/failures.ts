import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolve } from 'node:path';

const FAILURES_LOG = resolve(process.cwd(), 'logs/failures.log');

export async function logFailure(url: string, reason: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const sanitized = reason.replace(/[\t\r\n]/g, ' ');
  const line = `${timestamp}\t${url}\t${sanitized}\n`;
  await mkdir(dirname(FAILURES_LOG), { recursive: true });
  await appendFile(FAILURES_LOG, line, 'utf8');
}
