import path from 'node:path';

/** SQLite paths in DATABASE_URL are relative to project root (not prisma/). */
export function resolveDatabaseUrl(url: string, cwd = process.cwd()): string {
  if (!url.startsWith('file:')) return url;
  const filePath = url.slice('file:'.length);
  if (path.isAbsolute(filePath)) return url;
  const normalized = filePath.replace(/^\.\//, '');
  return `file:${path.join(cwd, normalized)}`;
}
