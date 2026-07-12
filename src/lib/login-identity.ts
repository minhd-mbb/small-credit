const legacyUsernameToEmail: Readonly<Record<string, string>> = {
  "0983171982": "minhd.mbb@gmail.com",
  "1505": "benpoddle@gmail.com",
  "1403": "bicorgi@gmail.com",
  "0922076868": "giang.mbbank@gmail.com",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function resolveLoginEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (emailPattern.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4,10}$/.test(trimmed)) {
    return legacyUsernameToEmail[trimmed] ?? null;
  }

  return null;
}

export function getLegacyUsernameToEmailMap(): Readonly<Record<string, string>> {
  return legacyUsernameToEmail;
}
