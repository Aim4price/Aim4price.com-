import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Field Manager asset cards stay vertically stacked on phones', () => {
  const assets = source('app/field-manager/field-manager-assets-client.tsx');
  const styles = source('app/field-manager/page.module.css');

  assert.match(assets, /assetMetaGridVertical/);
  assert.match(styles, /\.assetMetaGridVertical\s*\{\s*grid-template-columns:\s*1fr;/s);
  assert.doesNotMatch(styles, /\.assetMetaGridVertical\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1\.35fr\)/s);
});

test('Field Manager asset entry points use the shared standard location modal', () => {
  const assets = source('app/field-manager/field-manager-assets-client.tsx');
  const overview = source('app/field-manager/field-manager-overview-client.tsx');
  const modal = source('app/field-manager/field-manager-service-location-modal.tsx');

  assert.match(assets, /FieldManagerServiceLocationModal/);
  assert.match(overview, /FieldManagerServiceLocationModal/);
  assert.match(modal, /<FuelLocationModal/);
  assert.match(modal, /recordLabel="service"/);
  assert.match(modal, /saveFieldManagerServiceLocation/);
});

test('Field Manager fuel uses the Owner-style storage and petrol station choice', () => {
  const choice = source('app/field-manager/diesel/page.tsx');
  const storage = source('app/field-manager/diesel/storage/page.tsx');
  const petrol = source('app/field-manager/diesel/petrol-station/page.tsx');

  assert.match(choice, /href="\/field-manager\/diesel\/storage"/);
  assert.match(choice, />Storage tank</);
  assert.match(choice, /href="\/field-manager\/diesel\/petrol-station"/);
  assert.match(choice, />Petrol station</);
  assert.match(storage, /<FieldManagerDieselClient/);
  assert.match(petrol, /<PetrolStationFuelClient operatorName="" fieldManagerMode/);
});

test('Field Manager petrol station reuses the Owner flow with Field Manager endpoints', () => {
  const client = source('app/owner-app/operations/fuel/petrol-station/petrol-station-fuel-client.tsx');
  const route = source('app/api/field-manager/petrol-station/route.ts');
  const upload = source('app/api/field-manager/petrol-station/upload/route.ts');

  assert.match(client, /fieldManagerMode[\s\S]*fetch\('\/api\/field-manager\/petrol-station'/);
  assert.match(client, /\/api\/field-manager\/petrol-station\/upload/);
  assert.match(client, /fieldManagerMode \? '\/field-manager\/diesel' : '\/owner-app\/operations\/fuel'/);
  assert.match(route, /requireActiveFieldManagerSession/);
  assert.match(route, /fieldManagerCan\(access\.session\.managerId, 'record_fuel'\)/);
  assert.match(route, /listFieldManagerAssets/);
  assert.match(route, /getFieldManagerAssetForOpen/);
  assert.match(route, /operatorName: access\.session\.displayName/);
  assert.match(upload, /requireActiveFieldManagerSession/);
  assert.match(upload, /userId: access\.session\.ownerUserId/);
});

test('Petrol station asset information is stacked as Serial, Year, and Usage', () => {
  const client = source('app/owner-app/operations/fuel/petrol-station/petrol-station-fuel-client.tsx');
  const styles = source('app/owner-app/operations/fuel/petrol-station/page.module.css');

  assert.match(client, /<span>Serial<\/span>[\s\S]*<span>Year<\/span>[\s\S]*<span>Usage<\/span>/);
  assert.match(styles, /\.assetMetaGrid\s*\{\s*display:\s*grid;\s*gap:/s);
  assert.doesNotMatch(styles, /\.assetMetaGrid\s*\{[^}]*grid-template-columns:/s);
});
