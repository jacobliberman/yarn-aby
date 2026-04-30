import { eq } from 'drizzle-orm';

import { patterns, projects, yarn } from './schema.js';

/** Attach to Drizzle `where`/`and` once CRUD routes query tenant tables */
export function yarnScope(userId: string) {
  return eq(yarn.userId, userId);
}

export function patternsScope(userId: string) {
  return eq(patterns.userId, userId);
}

export function projectsScope(userId: string) {
  return eq(projects.userId, userId);
}
