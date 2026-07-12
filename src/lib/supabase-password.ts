export async function deriveSupabasePassword(password: string): Promise<string> {
  const input = new TextEncoder().encode(`small-credit:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", input);

  return Array.from(new Uint8Array(digest), (byte: number) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
