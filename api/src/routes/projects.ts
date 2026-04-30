import type { FastifyPluginAsync } from 'fastify';

import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  or,
} from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  patternsScope,
  projectsScope,
  yarnScope,
} from '../db/scope.js';
import { patterns, projectYarn, projects, yarn } from '../db/schema.js';

const STATUS = new Set(['wip', 'finished', 'frogged']);

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('Expected string or null');
  }
  return value;
}

function readStatus(value: unknown): string {
  const s = readString(value, 'status');
  if (!STATUS.has(s)) {
    throw new Error('status must be wip, finished, or frogged');
  }
  return s;
}

function readOptionalPatternId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10);
    if (!Number.isNaN(n)) return n;
  }
  throw new Error('patternId must be an integer or null');
}

function readOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('date must be YYYY-MM-DD string or null');
  }
  const s = value.trim();
  if (s === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error('date must be YYYY-MM-DD');
  }
  return s;
}

function readOptionalSkeinsUsed(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return String(n);
  }
  throw new Error('skeinsUsed must be a finite number or null');
}

function readYarnLinks(
  value: unknown,
): Array<{ yarnId: number; skeinsUsed: string | null }> {
  if (!Array.isArray(value)) {
    throw new Error('yarnLinks must be an array');
  }
  return value.map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`yarnLinks[${i}] must be an object`);
    }
    const o = item as Record<string, unknown>;
    const yarnIdRaw = o.yarnId ?? o.yarn_id;
    if (
      typeof yarnIdRaw !== 'number' ||
      !Number.isInteger(yarnIdRaw)
    ) {
      throw new Error(`yarnLinks[${i}].yarnId must be an integer`);
    }
    return {
      yarnId: yarnIdRaw,
      skeinsUsed: readOptionalSkeinsUsed(o.skeinsUsed ?? o.skeins_used),
    };
  });
}

async function ensurePatternOwned(
  userId: string,
  patternId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: patterns.id })
    .from(patterns)
    .where(and(patternsScope(userId), eq(patterns.id, patternId)));
  return !!row;
}

const projectsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const q = request.query as Record<string, string | undefined>;
    const status = q.status;

    const conditions = [projectsScope(userId)];
    if (status) {
      conditions.push(eq(projects.status, status));
    }

    const rows = await db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt));

    return reply.send(rows);
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const id = Number.parseInt(request.params.id, 10);
    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: 'Invalid id' });
    }

    const [projectRow] = await db
      .select()
      .from(projects)
      .where(and(projectsScope(userId), eq(projects.id, id)));

    if (!projectRow) {
      return reply.code(404).send({ error: 'Not found' });
    }

    let pattern: typeof patterns.$inferSelect | null = null;
    if (projectRow.patternId !== null) {
      const [p] = await db
        .select()
        .from(patterns)
        .where(
          and(
            patternsScope(userId),
            eq(patterns.id, projectRow.patternId),
          ),
        );
      pattern = p ?? null;
    }

    const linkRows = await db
      .select({
        id: projectYarn.id,
        projectId: projectYarn.projectId,
        yarnId: projectYarn.yarnId,
        skeinsUsed: projectYarn.skeinsUsed,
        yarnRow: yarn,
      })
      .from(projectYarn)
      .leftJoin(yarn, eq(projectYarn.yarnId, yarn.id))
      .where(
        and(
          eq(projectYarn.projectId, id),
          or(isNull(projectYarn.yarnId), eq(yarn.userId, userId)),
        ),
      );

    const yarnLinks = linkRows.map((r) => {
      const y = r.yarnRow;
      return {
        id: r.id,
        projectId: r.projectId,
        yarnId: r.yarnId,
        skeinsUsed: r.skeinsUsed,
        yarn: y
          ? {
              id: y.id,
              userId: y.userId,
              brand: y.brand,
              colorway: y.colorway,
              weight: y.weight,
              fiber: y.fiber,
              yardage: y.yardage,
              skeins: String(y.skeins),
              colorCode: y.colorCode,
              photoUrl: y.photoUrl,
              notes: y.notes,
              tags: y.tags,
              createdAt: y.createdAt,
            }
          : null,
      };
    });

    return reply.send({
      project: projectRow,
      pattern,
      yarnLinks,
    });
  });

  fastify.post('/', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const body = request.body as Record<string, unknown>;

    let yarnLinks: Array<{ yarnId: number; skeinsUsed: string | null }> = [];
    try {
      const title = readString(body.title, 'title');
      const status = readStatus(body.status);
      const patternId = readOptionalPatternId(body.patternId) ?? null;
      if (patternId !== null) {
        const ok = await ensurePatternOwned(userId, patternId);
        if (!ok) {
          return reply.code(400).send({ error: 'Invalid patternId' });
        }
      }

      const row = {
        userId,
        patternId,
        title,
        status,
        startDate: readOptionalDate(body.startDate) ?? null,
        endDate: readOptionalDate(body.endDate) ?? null,
        notes: readOptionalString(body.notes) ?? null,
        photoUrl: readOptionalString(body.photoUrl) ?? null,
      };

      if (body.yarnLinks !== undefined) {
        yarnLinks = readYarnLinks(body.yarnLinks);
        const ids = [...new Set(yarnLinks.map((l) => l.yarnId))];
        await assertYarnsOwned(userId, ids);
      }

      const created = await db.transaction(async (tx) => {
        const [p] = await tx.insert(projects).values(row).returning();
        if (!p) {
          throw new Error('Insert failed');
        }
        if (yarnLinks.length > 0) {
          await tx.insert(projectYarn).values(
            yarnLinks.map((l) => ({
              projectId: p.id,
              yarnId: l.yarnId,
              skeinsUsed: l.skeinsUsed,
            })),
          );
        }
        return p;
      });

      return reply.code(201).send(created);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid body';
      return reply.code(400).send({ error: msg });
    }
  });

  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const id = Number.parseInt(request.params.id, 10);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({ error: 'Invalid id' });
      }

      const body = request.body as Record<string, unknown>;
      const patch: Record<string, unknown> = {};

      try {
        if (body.title !== undefined) {
          patch.title = readString(body.title, 'title');
        }
        if (body.status !== undefined) {
          patch.status = readStatus(body.status);
        }
        if (body.patternId !== undefined) {
          const pid = readOptionalPatternId(body.patternId);
          patch.patternId = pid === undefined ? null : pid;
        }
        if (body.startDate !== undefined) {
          patch.startDate = readOptionalDate(body.startDate);
        }
        if (body.endDate !== undefined) {
          patch.endDate = readOptionalDate(body.endDate);
        }
        if (body.notes !== undefined) {
          patch.notes = readOptionalString(body.notes);
        }
        if (body.photoUrl !== undefined) {
          patch.photoUrl = readOptionalString(body.photoUrl);
        }

        if (body.patternId !== undefined) {
          const pid = patch.patternId as number | null | undefined;
          if (pid !== null && pid !== undefined) {
            const ok = await ensurePatternOwned(userId, pid);
            if (!ok) {
              return reply.code(400).send({ error: 'Invalid patternId' });
            }
          }
        }

        let newLinks: Array<{
          yarnId: number;
          skeinsUsed: string | null;
        }> | null = null;
        if (body.yarnLinks !== undefined) {
          newLinks = readYarnLinks(body.yarnLinks);
          const ids = [...new Set(newLinks.map((l) => l.yarnId))];
          await assertYarnsOwned(userId, ids);
        }

        if (
          Object.keys(patch).length === 0 &&
          newLinks === null
        ) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        const updated = await db.transaction(async (tx) => {
          let row = null;
          if (Object.keys(patch).length > 0) {
            const [u] = await tx
              .update(projects)
              .set(patch)
              .where(and(projectsScope(userId), eq(projects.id, id)))
              .returning();
            row = u;
          } else {
            const [existing] = await tx
              .select()
              .from(projects)
              .where(and(projectsScope(userId), eq(projects.id, id)));
            row = existing ?? null;
          }

          if (!row) {
            return null;
          }

          if (newLinks !== null) {
            await tx
              .delete(projectYarn)
              .where(eq(projectYarn.projectId, id));
            if (newLinks.length > 0) {
              await tx.insert(projectYarn).values(
                newLinks.map((l) => ({
                  projectId: id,
                  yarnId: l.yarnId,
                  skeinsUsed: l.skeinsUsed,
                })),
              );
            }
          }

          return row;
        });

        if (!updated) {
          return reply.code(404).send({ error: 'Not found' });
        }
        return reply.send(updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid body';
        return reply.code(400).send({ error: msg });
      }
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const id = Number.parseInt(request.params.id, 10);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({ error: 'Invalid id' });
      }

      const deleted = await db.transaction(async (tx) => {
        const [proj] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(and(projectsScope(userId), eq(projects.id, id)));

        if (!proj) {
          return false;
        }

        await tx.delete(projectYarn).where(eq(projectYarn.projectId, id));
        await tx
          .delete(projects)
          .where(and(projectsScope(userId), eq(projects.id, id)));
        return true;
      });

      if (!deleted) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.code(204).send();
    },
  );
};

async function assertYarnsOwned(userId: string, yarnIds: number[]) {
  if (yarnIds.length === 0) {
    return;
  }
  const rows = await db
    .select({ id: yarn.id })
    .from(yarn)
    .where(and(yarnScope(userId), inArray(yarn.id, yarnIds)));
  if (rows.length !== yarnIds.length) {
    throw new Error('One or more yarn IDs are invalid or not yours');
  }
}

export default projectsRoutes;
