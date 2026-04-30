import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from './app.js';

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

test(
  'yarn + patterns + projects with test auth',
  { skip: !hasDb },
  async (t) => {
    const app = await buildApp({ testUserId: 'user_integration_test' });
    t.after(async () => {
      await app.close();
    });

    const createYarn = await app.inject({
      method: 'POST',
      url: '/yarn',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        brand: 'TestBrand',
        colorway: 'Sunset',
        weight: 'DK',
        skeins: 2,
        yardage: 150,
      }),
    });
    assert.equal(createYarn.statusCode, 201, createYarn.payload);
    const yarnRow = JSON.parse(createYarn.payload) as { id: number };
    assert.ok(yarnRow.id > 0);

    const listYarn = await app.inject({ method: 'GET', url: '/yarn' });
    assert.equal(listYarn.statusCode, 200);
    const yarns = JSON.parse(listYarn.payload) as { id: number }[];
    assert.ok(yarns.some((y) => y.id === yarnRow.id));

    const createPattern = await app.inject({
      method: 'POST',
      url: '/patterns',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        title: 'Test Pattern',
        craftType: 'knit',
        yardageNeeded: 100,
      }),
    });
    assert.equal(createPattern.statusCode, 201, createPattern.payload);
    const patternRow = JSON.parse(createPattern.payload) as { id: number };

    const yardageRes = await app.inject({
      method: 'GET',
      url: `/patterns/${patternRow.id}/yardage-check`,
    });
    assert.equal(yardageRes.statusCode, 200);
    const yardage = JSON.parse(yardageRes.payload) as {
      sufficient: boolean | null;
      availableYards: number;
    };
    assert.equal(yardage.sufficient, true);
    assert.ok(yardage.availableYards >= 300);

    const createProject = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        title: 'Sock WIP',
        status: 'wip',
        patternId: patternRow.id,
        yarnLinks: [{ yarnId: yarnRow.id, skeinsUsed: 1 }],
      }),
    });
    assert.equal(createProject.statusCode, 201, createProject.payload);
    const projectRow = JSON.parse(createProject.payload) as { id: number };

    const detail = await app.inject({
      method: 'GET',
      url: `/projects/${projectRow.id}`,
    });
    assert.equal(detail.statusCode, 200);
    const bundle = JSON.parse(detail.payload) as {
      yarnLinks: { yarnId: number | null }[];
    };
    assert.equal(bundle.yarnLinks.length, 1);
    assert.equal(bundle.yarnLinks[0]?.yarnId, yarnRow.id);

    const delProj = await app.inject({
      method: 'DELETE',
      url: `/projects/${projectRow.id}`,
    });
    assert.equal(delProj.statusCode, 204);

    const delPat = await app.inject({
      method: 'DELETE',
      url: `/patterns/${patternRow.id}`,
    });
    assert.equal(delPat.statusCode, 204);

    const delYarn = await app.inject({
      method: 'DELETE',
      url: `/yarn/${yarnRow.id}`,
    });
    assert.equal(delYarn.statusCode, 204);
  },
);

test(
  'production auth rejects missing bearer',
  { skip: !hasDb || !process.env.CLERK_SECRET_KEY?.trim() },
  async (t) => {
    const app = await buildApp();
    t.after(async () => {
      await app.close();
    });

    const res = await app.inject({ method: 'GET', url: '/yarn' });
    assert.equal(res.statusCode, 401);
  },
);
