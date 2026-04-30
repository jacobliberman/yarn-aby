import type { FastifyPluginAsync } from 'fastify';

import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import { yarnScope } from '../db/scope.js';
import { yarn } from '../db/schema.js';


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

function readSkeins(value: unknown): string {
  if (value === undefined || value === null) {
    throw new Error('skeins is required');
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return String(n);
  }
  throw new Error('skeins must be a finite number');
}

function readOptionalTags(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('tags must be an array of strings or null');
  }
  return value.map((t) => readString(t, 'tag'));
}

const yarnRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const q = request.query as Record<string, string | undefined>;
    const weight = q.weight;
    const tag = q.tag;

    const conditions = [yarnScope(userId)];
    if (weight) {
      conditions.push(eq(yarn.weight, weight));
    }
    if (tag) {
      conditions.push(sql`${yarn.tags} @> ARRAY[${tag}]::text[]`);
    }

    const rows = await db
      .select()
      .from(yarn)
      .where(and(...conditions))
      .orderBy(desc(yarn.createdAt));

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

    const [row] = await db
      .select()
      .from(yarn)
      .where(and(yarnScope(userId), eq(yarn.id, id)));

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
        brand: readString(body.brand, 'brand'),
        colorway: readString(body.colorway, 'colorway'),
        weight: readString(body.weight, 'weight'),
        fiber: readOptionalString(body.fiber) ?? null,
        yardage: readOptionalInt(body.yardage) ?? null,
        skeins: readSkeins(body.skeins),
        colorCode: readOptionalString(body.colorCode) ?? null,
        photoUrl: readOptionalString(body.photoUrl) ?? null,
        notes: readOptionalString(body.notes) ?? null,
        tags: readOptionalTags(body.tags) ?? null,
      };

      const [inserted] = await db.insert(yarn).values(row).returning();
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
        if (body.brand !== undefined) {
          patch.brand = readString(body.brand, 'brand');
        }
        if (body.colorway !== undefined) {
          patch.colorway = readString(body.colorway, 'colorway');
        }
        if (body.weight !== undefined) {
          patch.weight = readString(body.weight, 'weight');
        }
        if (body.fiber !== undefined) {
          patch.fiber = readOptionalString(body.fiber);
        }
        if (body.yardage !== undefined) {
          patch.yardage = readOptionalInt(body.yardage);
        }
        if (body.skeins !== undefined) {
          patch.skeins = readSkeins(body.skeins);
        }
        if (body.colorCode !== undefined) {
          patch.colorCode = readOptionalString(body.colorCode);
        }
        if (body.photoUrl !== undefined) {
          patch.photoUrl = readOptionalString(body.photoUrl);
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
        .update(yarn)
        .set(patch)
        .where(and(yarnScope(userId), eq(yarn.id, id)))
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
        .delete(yarn)
        .where(and(yarnScope(userId), eq(yarn.id, id)))
        .returning({ id: yarn.id });

      if (!deleted) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.code(204).send();
    },
  );
};

export default yarnRoutes;
