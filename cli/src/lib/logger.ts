export function info(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function error(message: string): void {
  process.stderr.write(`ERROR: ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`WARN: ${message}\n`);
}
