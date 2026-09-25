import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// A hash of a value that can never be typed by a real user (bcrypt hashes are
// base64-ish and much shorter than this) - used to keep bcrypt.compare's timing
// the same on a login attempt for an email that doesn't exist, so the response
// time doesn't leak whether the account exists.
const DUMMY_HASH = bcrypt.hashSync('docly-dummy-password-for-timing-safety', SALT_ROUNDS);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// Compares against a real hash when one exists, and a dummy one when it
// doesn't (see DUMMY_HASH above) - used for login, where "no such user" and
// "wrong password" must be indistinguishable.
export async function verifyPasswordTimingSafe(plain: string, hash: string | undefined): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH);
}
