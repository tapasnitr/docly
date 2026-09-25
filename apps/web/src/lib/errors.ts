import { ApiRequestError } from './api-client';

// Turns a thrown error into copy a user can act on. Shared by every form
// that calls the API (auth, organizations, members) so error handling reads
// the same way everywhere.
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
