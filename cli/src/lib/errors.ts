/**
 * UserError represents a recoverable, user-caused error (invalid input, unreachable URL, etc.).
 * These are caught at the process boundary in index.ts and printed as readable messages.
 * Internal/unexpected errors should use plain Error and will surface as stack traces.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
