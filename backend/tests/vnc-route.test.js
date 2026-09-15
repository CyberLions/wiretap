import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';

import { setDbRows, clearDbRows } from './helpers/db.js';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.join(here, '..');

const getConsoleUrlForProject = vi.fn();

let currentUser = { id: 'user-1', role: 'USER' };
let app;

function stubModule(relPath, exports) {
  const resolved = require.resolve(path.join(backend, relPath));
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    path: path.dirname(resolved),
    loaded: true,
    children: [],
    paths: [],
    exports
  };
}

beforeAll(() => {
  stubModule('middleware/auth.js', {
    authenticateToken: (req, _res, next) => {
      req.user = currentUser;
      next();
    },
    requireAdmin: (_req, _res, next) => next(),
    canAccessWorkshop: (_req, _res, next) => next(),
    canAccessInstance: (_req, _res, next) => next(),
    canAccessTeam: (_req, _res, next) => next()
  });

  stubModule('managers/openstack.js', { getConsoleUrlForProject });

  const vncRouter = require(path.join(backend, 'routes', 'vnc.js'));

  app = express();
  app.use(express.json());
  app.use('/api/vnc', vncRouter);
});

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: 'user-1', role: 'USER' };
  getConsoleUrlForProject.mockResolvedValue('ws://nova:6083/?token=a');
  setDbRows({
    instances: {
      'inst-1': { id: 'inst-1', workshop_id: 'ws-1', openstack_id: 'os-1', locked: 0 }
    },
    workshops: {
      'ws-1': { id: 'ws-1', provider_id: 'prov-1', openstack_project_name: 'team-1' }
    },
    providers: { 'prov-1': { id: 'prov-1' } }
  });
});

afterEach(() => {
  clearDbRows();
});

describe('POST /api/vnc/:instanceId/console', () => {
  it('accepts a serial console request', async () => {
    const res = await request(app)
      .post('/api/vnc/inst-1/console')
      .send({ console_type: 'SERIAL' });

    expect(res.status).toBe(200);
    expect(getConsoleUrlForProject).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      expect.anything(),
      'SERIAL'
    );
  });

  it('still defaults to novnc', async () => {
    const res = await request(app).post('/api/vnc/inst-1/console').send({});

    expect(res.status).toBe(200);
    expect(getConsoleUrlForProject).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'NOVNC'
    );
  });

  it('rejects a misspelled type instead of silently handing back a VNC console', async () => {
    // Without validation this returned a noVNC console with 'seriall' baked
    // into the signed session token.
    const res = await request(app)
      .post('/api/vnc/inst-1/console')
      .send({ console_type: 'seriall' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported console type/i);
    expect(getConsoleUrlForProject).not.toHaveBeenCalled();
  });

  it('rejects an unsupported type before touching the database', async () => {
    const res = await request(app)
      .post('/api/vnc/inst-1/console')
      .send({ console_type: 'telnet' });

    expect(res.status).toBe(400);
  });

  it('bakes the validated type into the session token', async () => {
    const res = await request(app)
      .post('/api/vnc/inst-1/console')
      .send({ console_type: 'SERIAL' });

    const payload = JSON.parse(
      Buffer.from(res.body.session_token.split('.')[1], 'base64url').toString()
    );
    expect(payload.consoleType).toBe('SERIAL');
  });
});
