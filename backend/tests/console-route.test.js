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

// The route pulls getConsoleUrlForProject in with a plain require() at call
// time, so we swap the manager in Node's require cache rather than mocking it.
const getConsoleUrlForProject = vi.fn();

// Who the request is coming from; individual tests reassign this.
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

  // Required after the stubs are in place so the router picks them up.
  const instancesRouter = require(path.join(backend, 'routes', 'instances.js'));

  app = express();
  app.use(express.json());
  app.use('/api/instances', instancesRouter);
});

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: 'user-1', role: 'USER' };
  setDbRows({
    instances: {
      'inst-1': { id: 'inst-1', workshop_id: 'ws-1', openstack_id: 'os-1', locked: 0 }
    },
    workshops: {
      'ws-1': { id: 'ws-1', provider_id: 'prov-1', openstack_project_name: 'team-1' }
    },
    providers: {
      'prov-1': { id: 'prov-1', auth_url: 'https://keystone.example.org' }
    }
  });
});

afterEach(() => {
  clearDbRows();
});

describe('GET /api/instances/:id/console', () => {
  it('defaults to novnc when no type is given', async () => {
    getConsoleUrlForProject.mockResolvedValue('https://nova/vnc_auto.html?token=a&scale=true');

    const res = await request(app).get('/api/instances/inst-1/console');

    expect(res.status).toBe(200);
    expect(res.body.console_type).toBe('NOVNC');
    expect(getConsoleUrlForProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'prov-1' }),
      'team-1',
      expect.objectContaining({ id: 'inst-1' }),
      'NOVNC'
    );
  });

  it('passes serial through to the manager and echoes the type back', async () => {
    getConsoleUrlForProject.mockResolvedValue('wss://nova:6083/?token=a');

    const res = await request(app).get('/api/instances/inst-1/console?type=serial');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      console_url: 'wss://nova:6083/?token=a',
      console_type: 'SERIAL'
    });
    expect(getConsoleUrlForProject).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      expect.anything(),
      'SERIAL'
    );
  });

  it('normalizes the type before handing it to the manager', async () => {
    getConsoleUrlForProject.mockResolvedValue('wss://nova:6083/?token=a');

    await request(app).get('/api/instances/inst-1/console?type=SeRiAl');

    expect(getConsoleUrlForProject).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'SERIAL'
    );
  });

  it('rejects an unknown console type with 400 rather than silently using novnc', async () => {
    const res = await request(app).get('/api/instances/inst-1/console?type=xtermjs');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported console type/i);
    expect(getConsoleUrlForProject).not.toHaveBeenCalled();
  });

  it('answers 502 with the console type when the cloud cannot provide one', async () => {
    // A cloud without [serial_console] enabled ends up here.
    getConsoleUrlForProject.mockResolvedValue(null);

    const res = await request(app).get('/api/instances/inst-1/console?type=serial');

    expect(res.status).toBe(502);
    expect(res.body.console_type).toBe('SERIAL');
    expect(res.body.error).toMatch(/serial/i);
  });

  it('404s for an unknown instance', async () => {
    const res = await request(app).get('/api/instances/nope/console?type=serial');

    expect(res.status).toBe(404);
    expect(getConsoleUrlForProject).not.toHaveBeenCalled();
  });

  it('still refuses a locked instance for a serial console', async () => {
    setDbRows({
      instances: {
        'inst-1': { id: 'inst-1', workshop_id: 'ws-1', openstack_id: 'os-1', locked: 1 }
      },
      workshops: { 'ws-1': { id: 'ws-1', provider_id: 'prov-1', openstack_project_name: 'team-1' } },
      providers: { 'prov-1': { id: 'prov-1' } }
    });

    const res = await request(app).get('/api/instances/inst-1/console?type=serial');

    expect(res.status).toBe(403);
    expect(getConsoleUrlForProject).not.toHaveBeenCalled();
  });

  it('lets an admin through a lockout window', async () => {
    currentUser = { id: 'admin-1', role: 'ADMIN' };
    getConsoleUrlForProject.mockResolvedValue('wss://nova:6083/?token=a');
    setDbRows({
      instances: {
        'inst-1': { id: 'inst-1', workshop_id: 'ws-1', openstack_id: 'os-1', locked: 1 }
      },
      workshops: { 'ws-1': { id: 'ws-1', provider_id: 'prov-1', openstack_project_name: 'team-1' } },
      providers: { 'prov-1': { id: 'prov-1' } }
    });

    const res = await request(app).get('/api/instances/inst-1/console?type=serial');

    expect(res.status).toBe(200);
  });

  it('refuses during a workshop lockout window', async () => {
    const now = Date.now();
    setDbRows({
      instances: {
        'inst-1': { id: 'inst-1', workshop_id: 'ws-1', openstack_id: 'os-1', locked: 0 }
      },
      workshops: {
        'ws-1': {
          id: 'ws-1',
          provider_id: 'prov-1',
          openstack_project_name: 'team-1',
          lockout_start: new Date(now - 60_000).toISOString(),
          lockout_end: new Date(now + 60_000).toISOString()
        }
      },
      providers: { 'prov-1': { id: 'prov-1' } }
    });

    const res = await request(app).get('/api/instances/inst-1/console?type=serial');

    expect(res.status).toBe(403);
  });

  it('500s when the manager throws', async () => {
    getConsoleUrlForProject.mockRejectedValue(new Error('boom'));

    const res = await request(app).get('/api/instances/inst-1/console?type=serial');

    expect(res.status).toBe(500);
  });
});
