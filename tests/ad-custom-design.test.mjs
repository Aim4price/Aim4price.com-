import assert from 'node:assert/strict';
import test from 'node:test';
import loadTs from './helpers/load-ts.cjs';
import { PGlite } from '@electric-sql/pglite';
const designApi = loadTs('lib/ad-custom-design.ts');
const { normalizeAdCustomDesign, createAdCustomDesign, createAdDesignElement, resizeAdDesign, customDesignPhotoCount } = designApi;
const brandApi = loadTs('lib/ad-studio.ts');
const { renderCustomAd, customElementText } = loadTs('lib/ad-custom-renderer.ts');
function example() {
  return { ...createAdCustomDesign(), elements: [createAdDesignElement('photo'), createAdDesignElement('text', 'price')] };
}
test('custom designs survive saved snapshots and JSON round trips; old templates stay standard', () => {
  const customDesign = example();
  const kit = brandApi.sanitizeAdBrandKitInput({ name: 'My design', customDesign });
  const snapshot = brandApi.toAdBrandSnapshot({ ...kit, id: 'kit' });
  assert.deepEqual(brandApi.normalizeAdBrandSnapshot(JSON.parse(JSON.stringify(snapshot))).customDesign, customDesign);
  assert.equal(brandApi.normalizeAdBrandSnapshot({ templateId: 'classic' }).customDesign, null);
  assert.equal(normalizeAdCustomDesign({ version: 99, elements: [] }), null);
});
test('untrusted designs have bounded dimensions, counts, text, images and safe fields', () => {
  const raw = { ...example(), size: '__proto__', background: 'url(evil)', elements: Array.from({ length: 70 }, () => ({ ...createAdDesignElement('text'), id: 'duplicate', x: Infinity, y: -80, width: 99999, height: -1, fontSize: NaN, field: '__proto__', text: 'a'.repeat(4000), image: 'https://evil.test/image.svg' })) };
  const d = normalizeAdCustomDesign(raw);
  assert.equal(d.elements.length, 40); assert.equal(d.size, 'landscape'); assert.equal(d.background, '#ffffff');
  assert.equal(new Set(d.elements.map(e => e.id)).size, 40);
  for (const e of d.elements) { assert.ok(e.width <= 1600 && e.height >= 24 && e.y >= 0); assert.equal(e.field, undefined); assert.equal(e.image, ''); assert.equal(e.text.length, 1000); }
});
test('resize preserves proportions and required photo slots exclude uploaded artwork', () => {
  const d = example(); d.elements[0].photoIndex = 3;
  assert.equal(customDesignPhotoCount(d), 4);
  const resized = resizeAdDesign(d, 'portrait');
  assert.equal(resized.size, 'portrait');
  assert.equal(resized.elements[0].x, d.elements[0].x * 1080 / 1600);
  d.elements[0].image = 'data:image/png;base64,AAAA'; assert.equal(customDesignPhotoCount(d), 0);
});
test('renderer uses design dimensions, field bindings and rejects missing required asset photos', async () => {
  const calls = [];
  const ctx = { fillRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, measureText: text => ({ width: text.length * 8 }), fillText: text => calls.push(text), drawImage() {} };
  const canvas = { getContext: () => ctx, width: 0, height: 0 };
  const customDesign = { ...example(), size: 'portrait' };
  const content = { title: 'John Deere 5090E', askingPriceExVat: 465000, imageUrls: [], brand: { ...brandApi.sanitizeAdBrandKitInput({}), customDesign } };
  assert.match(customElementText(customDesign.elements[1], content), /465.*VAT/);
  await assert.rejects(renderCustomAd(canvas, content, async () => null, { requireImages: true }), /photo/);
  await renderCustomAd(canvas, content, async () => null, {});
  assert.equal(canvas.width, 1080); assert.equal(canvas.height, 1350); assert.ok(calls.some(text => text.includes('465')));
});
test('database creates, updates and reloads designs while enforcing account ownership', async () => {
  const pg = new PGlite();
  await pg.exec('create table asset_register_items (id text);');
  const client = { query: async (sql, values) => {
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (!values && sql.includes('create table')) { await pg.exec(sql); return { rows: [] }; }
    return pg.query(sql, values);
  }, release() {} };
  const db = { ...client, connect: async () => client };
  const api = loadTs('lib/ad-studio-db.ts', { './db': { getDb: () => db } });
  try {
    const original = await api.saveAdBrandKit('owner-a', { name: 'Custom', customDesign: example() });
    assert.deepEqual((await api.listAdBrandKits('owner-a'))[0].customDesign, original.customDesign);
    assert.equal((await api.listAdBrandKits('owner-b')).length, 0);
    await assert.rejects(api.saveAdBrandKit('owner-b', { id: original.id, name: 'Hijack', customDesign: example() }));
    const updated = await api.saveAdBrandKit('owner-a', { ...original, customDesign: resizeAdDesign(original.customDesign, 'square') });
    assert.equal(updated.customDesign.size, 'square');
    assert.equal((await api.getAdBrandKitForUser('owner-a', original.id)).customDesign.size, 'square');
    assert.equal(await api.getAdBrandKitForUser('owner-b', original.id), null);
    const standard = await api.saveAdBrandKit('owner-a', { ...updated, customDesign: null });
    assert.equal(standard.customDesign, null);
  } finally { await pg.close(); }
});
test('starter layouts stay editable and bound fields resolve per asset', () => {
  const d = designApi.createStarterAdDesign('#223344', '#ffeedd');
  assert.deepEqual(normalizeAdCustomDesign(d), d);
  assert.equal(d.elements[0].color, '#223344');
  const title = d.elements.find(e => e.field === 'title');
  const brand = brandApi.sanitizeAdBrandKitInput({});
  assert.equal(customElementText(title, { title: 'Tractor A', brand }), 'Tractor A');
  assert.equal(customElementText(title, { title: 'Tractor B', brand }), 'Tractor B');
});

test('all resize corners keep the opposite corner fixed and respect canvas bounds', () => {
  const source = { ...createAdDesignElement('photo'), x: 100, y: 80, width: 200, height: 120 };
  const expected = { se: [100,80,230,140], sw: [130,80,170,140], ne: [100,100,230,100], nw: [130,100,170,100] };
  for (const corner of ['se','sw','ne','nw']) {
    const result = designApi.resizeAdElementFromCorner(source, corner, 30, 20, 1600, 900);
    assert.deepEqual([result.x,result.y,result.width,result.height], expected[corner]);
    for (const delta of [-10000,10000]) {
      const bounded = designApi.resizeAdElementFromCorner(source, corner, delta, delta, 1600, 900);
      assert.ok(bounded.x >= 0 && bounded.y >= 0 && bounded.width >= 24 && bounded.height >= 24);
      assert.ok(bounded.x + bounded.width <= 1600 && bounded.y + bounded.height <= 900);
      assert.equal(corner.endsWith('w') ? bounded.x + bounded.width : bounded.x, corner.endsWith('w') ? 300 : 100);
      assert.equal(corner.startsWith('n') ? bounded.y + bounded.height : bounded.y, corner.startsWith('n') ? 200 : 80);
    }
  }
  assert.deepEqual([source.x,source.y,source.width,source.height], [100,80,200,120]);
});
