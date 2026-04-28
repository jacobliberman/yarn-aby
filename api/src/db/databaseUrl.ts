/** Single place for DATABASE_URL validation (runtime + drizzle-kit). */

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is required. Copy .env.example to .env in the repo root and set DATABASE_URL (e.g. from Neon).',
    );
  }
  return url;
}
