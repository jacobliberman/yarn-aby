import type { FastifyPluginAsync } from 'fastify';

import {
  and,
  desc,
  eq,
  ilike,
  isNotNull,
  or,
  sql,
} from 'drizzle-orm';

import { db } from '../db/client.js';
import { patternsScope, yarnScope } from '../db/scope.js';
import { patterns, projectYarn, projects, yarn } from '../db/schema.js';

const CRAFT = new Set(['knit', 'crochet']);
const DIFFICULTY = new Set([
  'beginner',
  'intermediate',
  'advanced',
]);

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

function readOptionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10);
    if (!Number.isNaN(n)) return n;
  }
  throw new Error('Expected integer or null');
}

function readCraftType(value: unknown): string {
  const s = readString(value, 'craftType');
  if (!CRAFT.has(s)) {
    throw new Error('craftType must be knit or crochet');
  }
  return s;
}

function readOptionalDifficulty(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('difficulty must be string or null');
  }
  const s = value.trim();
  if (s === '') return null;
  if (!DIFFICULTY.has(s)) {
    throw new Error('difficulty must be beginner, intermediate, or advanced');
  }
  return s;
}

function readOptionalTags(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('tags must be an array of strings or null');
  }
  return value.map((t) => readString(t, 'tag'));
}

const patternsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const q = request.query as Record<string, string | undefined>;
    const craft = q.craft;
    const tag = q.tag;
    const search = q.q?.trim();

    const conditions = [patternsScope(userId)];
    if (craft) {
      conditions.push(eq(patterns.craftType, craft));
    }
    if (tag) {
      conditions.push(sql`${patterns.tags} @> ARRAY[${tag}]::text[]`);
    }
    if (search) {
      const pat = `%${search}%`;
      const searchCond = or(
        ilike(patterns.title, pat),
        and(isNotNull(patterns.designer), ilike(patterns.designer, pat)),
      );
      if (searchCond) {
        conditions.push(searchCond);
      }
    }

    const rows = await db
      .select()
      .from(patterns)
      .where(and(...conditions))
      .orderBy(desc(patterns.createdAt));

    return reply.send(rows);
  });

  /** Register before `/:id` so `yardage-check` is not captured as id */
  fastify.get<{ Params: { id: string } }>(
    '/:id/yardage-check',
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const id = Number.parseInt(request.params.id, 10);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({ error: 'Invalid id' });
      }

      const [patternRow] = await db
        .select()
        .from(patterns)
        .where(and(patternsScope(userId), eq(patterns.id, id)));

      if (!patternRow) {
        return reply.code(404).send({ error: 'Not found' });
      }

      const needed = patternRow.yardageNeeded;

      const [grossRow] = await db
        .select({
          gross: sql<string>`coalesce(sum(coalesce(${yarn.yardage}, 0)::numeric * ${yarn.skeins}::numeric), 0)`,
        })
        .from(yarn)
        .where(yarnScope(userId));

      const [unknownRow] = await db
        .select({
          cnt: sql<number>`count(*)::int`,
        })
        .from(yarn)
        .where(
          and(
            yarnScope(userId),
            sql`${yarn.yardage} is null`,
            sql`${yarn.skeins}::numeric > 0`,
          ),
        );

      const [wipRow] = await db
        .select({
          used: sql<string>`coalesce(sum(coalesce(${projectYarn.skeinsUsed}, 0)::numeric * coalesce(${yarn.yardage}, 0)::numeric), 0)`,
        })
        .from(projectYarn)
        .innerJoin(projects, eq(projectYarn.projectId, projects.id))
        .innerJoin(yarn, eq(projectYarn.yarnId, yarn.id))
        .where(
          and(
            eq(projects.userId, userId),
            eq(projects.status, 'wip'),
            eq(yarn.userId, userId),
          ),
        );

      const grossYardsInInventory = Number(grossRow?.gross ?? 0);
      const yardsCommittedToWip = Number(wipRow?.used ?? 0);
      const availableYards = grossYardsInInventory - yardsCommittedToWip;
      const hasYarnWithUnknownYardage = (unknownRow?.cnt ?? 0) > 0;

      const sufficient =
        needed === null ? null : availableYards >= needed;

      return reply.send({
        patternId: id,
        needed,
        grossYardsInInventory,
        yardsCommittedToWip,
        availableYards,
        sufficient,
        hasYarnWithUnknownYardage,
      });
    },
  );

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const id = Number.parseInt(request.params.id, 10);
    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: 'Invalid id' });
    }

    const [row] = await db
      .select()
      .from(patterns)
      .where(and(patternsScope(userId), eq(patterns.id, id)));

    if (!row) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.send(row);
  });

  fastify.post('/', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const body = request.body as Record<string, unknown>;

    try {
      const row = {
        userId,
        title: readString(body.title, 'title'),
        designer: readOptionalString(body.designer) ?? null,
        craftType: readCraftType(body.craftType ?? body.craft_type),
        difficulty: readOptionalDifficulty(body.difficulty) ?? null,
        yarnWeight: readOptionalString(body.yarnWeight) ?? null,
        yardageNeeded: readOptionalInt(body.yardageNeeded) ?? null,
        sourceUrl: readOptionalString(body.sourceUrl) ?? null,
        pdfUrl: readOptionalString(body.pdfUrl) ?? null,
        notes: readOptionalString(body.notes) ?? null,
        tags: readOptionalTags(body.tags) ?? null,
      };

      const [inserted] = await db.insert(patterns).values(row).returning();
      return reply.code(201).send(inserted);
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
        if (body.designer !== undefined) {
          patch.designer = readOptionalString(body.designer);
        }
        if (body.craftType !== undefined || body.craft_type !== undefined) {
          patch.craftType = readCraftType(body.craftType ?? body.craft_type);
        }
        if (body.difficulty !== undefined) {
          patch.difficulty = readOptionalDifficulty(body.difficulty);
        }
        if (body.yarnWeight !== undefined) {
          patch.yarnWeight = readOptionalString(body.yarnWeight);
        }
        if (body.yardageNeeded !== undefined) {
          patch.yardageNeeded = readOptionalInt(body.yardageNeeded);
        }
        if (body.sourceUrl !== undefined) {
          patch.sourceUrl = readOptionalString(body.sourceUrl);
        }
        if (body.pdfUrl !== undefined) {
          patch.pdfUrl = readOptionalString(body.pdfUrl);
        }
        if (body.notes !== undefined) {
          patch.notes = readOptionalString(body.notes);
        }
        if (body.tags !== undefined) {
          patch.tags = readOptionalTags(body.tags);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid body';
        return reply.code(400).send({ error: msg });
      }

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      const [updated] = await db
        .update(patterns)
        .set(patch)
        .where(and(patternsScope(userId), eq(patterns.id, id)))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.send(updated);
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

      const [deleted] = await db
        .delete(patterns)
        .where(and(patternsScope(userId), eq(patterns.id, id)))
        .returning({ id: patterns.id });

      if (!deleted) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.code(204).send();
    },
  );
};

export default patternsRoutes;
