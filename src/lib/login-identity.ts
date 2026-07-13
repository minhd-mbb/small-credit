const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function resolveLoginEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  return emailPattern.test(trimmed) ? trimmed : null;
}
