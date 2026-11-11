/* Real HTTP/session/database regression checks; all identities and assets are disposable. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { startEnvironment } = require('./environment.cjs');
async function run() {
  const e = await startEnvironment();
  console.log('QA logs and synthetic screenshots: ' + e.dir);
  const interrupt = async () => { await e.stop(); process.exit(130); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  let checks = 0;
  const ok = (condition, label) => { assert.ok(condition, label); checks++; };
  async function request(path, cookie = '', method = 'GET', body) {
    const r = await fetch(e.origin + path, { method, headers: { cookie, origin: e.origin, 'x-aim4price-client-realm': 'owner', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { throw Error(`${path}: ${r.status} ${text.slice(0,200)}`); }
    return { status: r.status, data, text, cookie: r.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  }
  try {
    let ready = false;
    for (let i = 0; i < 90; i++) { try { if ((await request('/api/owner-app/session')).status === 401) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 1000)); }
    ok(ready, 'App starts with disposable database');
    const cookies = {};
    for (const [role, account] of Object.entries(e.accounts)) {
      const login = await request('/api/owner-app/login', '', 'POST', { username: account.username, password: account.password });
      ok(login.status === 200, `${role}: real password login`); cookies[role] = login.cookie;
      const session = await request('/api/owner-app/session', login.cookie);
      assert.deepEqual(session.data.session.teamPermissions, account.permissions); checks++;
      const list = await request('/api/owner-app/assets', login.cookie);
      ok(list.status === 200, `${role}: asset list`);
      assert.deepEqual(list.data.items.map(a => a.id), [e.assets.tractor]); checks++;
      const detail = await request('/api/owner-app/assets/' + e.assets.tractor, login.cookie);
      ok(detail.status === 200, `${role}: asset detail (${detail.text})`);
      ok(detail.data.item.valuesRestricted === !account.permissions.viewValues, `${role}: values gate`);
      if (!account.permissions.viewValues) ok(!/987654|1234567/.test(detail.text + list.text), `${role}: financial values absent from payload`);
      else ok(detail.data.item.value === 987654, 'Manager receives permitted value');
      for (const name of ['excluded', 'retired', 'deleted']) {
        const denied = await request('/api/owner-app/assets/' + e.assets[name], login.cookie);
        ok(denied.status === 404, `${role}: ${name} direct access denied`);
      }
      const patch = await request('/api/team-workspaces/' + account.id, login.cookie, 'PATCH', { assetId: e.assets.tractor, patch: { usage: 1401 + checks } });
      ok(patch.status === (account.permissions.updateUsage ? 200 : 403), `${role}: usage write (${patch.status} ${patch.text})`);
      const forbidden = await request('/api/team-workspaces/' + account.id, login.cookie, 'PATCH', { assetId: e.assets.excluded, patch: { usage: 1800 } });
      ok([403,404].includes(forbidden.status), `${role}: cannot write excluded asset`);
      const financial = await request('/api/team-workspaces/' + account.id, login.cookie, 'PATCH', { assetId: e.assets.tractor, patch: { usage: 2000, value: 1 } });
      ok([400,403].includes(financial.status), `${role}: financial fields cannot be smuggled into usage updates`);
      const details = await request('/api/team-workspaces/' + account.id, login.cookie, 'PATCH', { assetId: e.assets.tractor, patch: { yearModel: 2022 } });
      ok(details.status === (account.permissions.editDetails ? 200 : 403), `${role}: identity edit permission`);
      console.log(`PASS ${role}: login, scoped list/detail, values, denied assets and writes`);
    }
    await require('./browser.cjs')(e);
    const before = await request('/api/owner-app/assets/' + e.assets.tractor, cookies.operator);
    const stale = await request('/api/team-workspaces/' + e.accounts.operator.id, cookies.operator, 'PATCH', { assetId: e.assets.tractor, expectedUpdatedAtIso: '2000-01-01T00:00:00.000Z', patch: { usage: 1900 } });
    ok(stale.status === 409, 'Stale edits rejected');
    await e.db.query('UPDATE owner_app_users SET permissions=$1 WHERE id=$2', [JSON.stringify(e.accounts.viewer.permissions), e.accounts.operator.id]);
    const revoked = await request('/api/team-workspaces/' + e.accounts.operator.id, cookies.operator, 'PATCH', { assetId: e.assets.tractor, patch: { usage: 1900 } });
    ok(revoked.status === 403, 'Permission removal affects existing session');
    const after = await request('/api/owner-app/assets/' + e.assets.tractor, cookies.operator);
    ok(after.data.item.hours === before.data.item.hours, 'Denied writes leave usage unchanged');
    const stored = await e.db.query('SELECT value,hours FROM asset_register_items WHERE id=$1', [e.assets.tractor]);
    ok(Number(stored.rows[0].value) === 987654 && Number(stored.rows[0].hours) > 1400, 'Allowed edits persisted without altering value');
    await e.db.query('UPDATE owner_app_users SET is_active=false WHERE id=$1', [e.accounts.operator.id]);
    ok((await request('/api/owner-app/session', cookies.operator)).status === 401, 'Deactivated account loses existing session');
    console.log(`PASS ${checks} isolated real-route checks`);
  } catch (error) {
    console.error(fs.readFileSync(e.dir + '/server.log', 'utf8').slice(-12000));
    throw error;
  } finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); await e.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
