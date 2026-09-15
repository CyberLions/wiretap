import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

import openstack from '../managers/openstack.js';

const { getConsoleUrl, getConsoleUrlForProject } = openstack;

const KEYSTONE = 'https://keystone.example.org';
const NOVA = 'https://nova.example.org';

const INSTANCE = { id: 'inst-1', openstack_id: 'aaaa-bbbb-cccc' };

let provider;

/**
 * Stub the Keystone token call. The auth cache is keyed on provider id +
 * project, so each test gets a fresh provider id and therefore a fresh token.
 */
function stubAuth() {
  return nock(KEYSTONE)
    .post('/v3/auth/tokens')
    .reply(
      201,
      {
        token: {
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          catalog: [
            {
              type: 'compute',
              endpoints: [
                { interface: 'public', region: 'RegionOne', url: `${NOVA}/v2.1/` }
              ]
            }
          ]
        }
      },
      { 'x-subject-token': 'tok-123' }
    );
}

/**
 * Stub the remote-consoles call and capture the body Nova was sent.
 * Returns a holder whose `.body` is filled in once the request is made.
 */
function stubRemoteConsole(responseUrl, status = 200) {
  const captured = { body: null };

  nock(NOVA)
    .post(`/v2.1/servers/${INSTANCE.openstack_id}/remote-consoles`)
    .reply(status, (uri, requestBody) => {
      captured.body = requestBody;
      return status >= 400
        ? { badRequest: { message: 'Unavailable console type serial.' } }
        : { remote_console: { url: responseUrl } };
    });

  return captured;
}

beforeEach(() => {
  nock.disableNetConnect();
  provider = {
    // Unique per test so the module-level auth cache never carries over.
    id: `provider-${Math.random().toString(36).slice(2)}`,
    auth_url: KEYSTONE,
    username: 'svc',
    password: 'hunter2',
    region_name: 'RegionOne'
  };
  stubAuth();
});

afterEach(() => {
  nock.cleanAll();
  nock.enableNetConnect();
});

describe('getConsoleUrlForProject', () => {
  it('asks Nova for a serial console and returns its URL unaltered', async () => {
    const sent = stubRemoteConsole('ws://nova.example.org:6083/?token=abc');

    const url = await getConsoleUrlForProject(provider, 'team-1', INSTANCE, 'SERIAL');

    expect(sent.body.remote_console).toEqual({ protocol: 'serial', type: 'serial' });
    expect(url).toBe('ws://nova.example.org:6083/?token=abc');
  });

  it('never adds noVNC query params to a serial URL', async () => {
    stubRemoteConsole('ws://nova.example.org:6083/?token=abc');

    const url = await getConsoleUrlForProject(provider, 'team-1', INSTANCE, 'SERIAL');

    expect(url).not.toContain('scale=true');
  });

  it('leaves an already-wss serial URL alone', async () => {
    stubRemoteConsole('wss://nova.example.org:6083/?token=abc');

    const url = await getConsoleUrlForProject(provider, 'team-1', INSTANCE, 'SERIAL');

    expect(url).toBe('wss://nova.example.org:6083/?token=abc');
  });

  it('asks Nova for novnc and returns a scaled https:// URL', async () => {
    const sent = stubRemoteConsole('http://nova.example.org:6080/vnc_auto.html?token=abc');

    const url = await getConsoleUrlForProject(provider, 'team-1', INSTANCE, 'NOVNC');

    expect(sent.body.remote_console).toEqual({ protocol: 'vnc', type: 'novnc' });
    expect(url).toBe('https://nova.example.org:6080/vnc_auto.html?token=abc&scale=true');
  });

  it('accepts a lowercase console type, as it arrives from the query string', async () => {
    const sent = stubRemoteConsole('ws://nova.example.org:6083/?token=abc');

    await getConsoleUrlForProject(provider, 'team-1', INSTANCE, 'serial');

    expect(sent.body.remote_console).toEqual({ protocol: 'serial', type: 'serial' });
  });

  it('defaults to novnc when no type is given', async () => {
    const sent = stubRemoteConsole('https://nova.example.org/vnc_auto.html?token=abc');

    await getConsoleUrlForProject(provider, 'team-1', INSTANCE);

    expect(sent.body.remote_console).toEqual({ protocol: 'vnc', type: 'novnc' });
  });

  it('falls back to novnc for an unrecognized type', async () => {
    const sent = stubRemoteConsole('https://nova.example.org/vnc_auto.html?token=abc');

    await getConsoleUrlForProject(provider, 'team-1', INSTANCE, 'xtermjs');

    expect(sent.body.remote_console).toEqual({ protocol: 'vnc', type: 'novnc' });
  });

  it('returns null when the cloud has no serial console configured', async () => {
    // What a cloud without [serial_console] enabled actually answers with.
    stubRemoteConsole(null, 400);

    const url = await getConsoleUrlForProject(provider, 'team-1', INSTANCE, 'SERIAL');

    expect(url).toBeNull();
  });

  it('returns nothing usable when the response carries no URL', async () => {
    nock(NOVA)
      .post(`/v2.1/servers/${INSTANCE.openstack_id}/remote-consoles`)
      .reply(200, {});

    const url = await getConsoleUrlForProject(provider, 'team-1', INSTANCE, 'SERIAL');

    expect(url).toBeFalsy();
  });
});

describe('getConsoleUrl', () => {
  it('maps serial the same way the project-scoped variant does', async () => {
    const sent = stubRemoteConsole('ws://nova.example.org:6083/?token=xyz');

    const url = await getConsoleUrl(provider, INSTANCE, 'SERIAL');

    expect(sent.body.remote_console).toEqual({ protocol: 'serial', type: 'serial' });
    expect(url).toBe('ws://nova.example.org:6083/?token=xyz');
  });

  it('maps novnc the same way the project-scoped variant does', async () => {
    const sent = stubRemoteConsole('http://nova.example.org:6080/vnc_auto.html?token=xyz');

    const url = await getConsoleUrl(provider, INSTANCE, 'NOVNC');

    expect(sent.body.remote_console).toEqual({ protocol: 'vnc', type: 'novnc' });
    expect(url).toBe('https://nova.example.org:6080/vnc_auto.html?token=xyz&scale=true');
  });
});
