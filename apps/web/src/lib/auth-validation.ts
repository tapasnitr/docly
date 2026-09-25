// Client-side mirror of the API's validation rules (apps/api/src/controllers/auth.controller.ts),
// so the form can show an error instantly instead of waiting on a round trip.
// The API re-validates everything server-side regardless - this is only ever
// a UX shortcut, never the source of truth.
export function validateEmail(email: string): string | undefined {
  if (!email.trim()) {
    return 'Email is required';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Invalid email address';
  }
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (password.length > 128) {
    return 'Password must be at most 128 characters';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain a lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain a number';
  }
  return undefined;
}

export function validateName(name: string): string | undefined {
  if (!name.trim()) {
    return 'Name is required';
  }
  if (name.length > 100) {
    return 'Name must be at most 100 characters';
  }
  return undefined;
}

export function validateConfirmPassword(password: string, confirmPassword: string): string | undefined {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return undefined;
}
