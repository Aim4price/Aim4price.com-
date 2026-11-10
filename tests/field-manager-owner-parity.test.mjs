import assert from 'node:assert/strict';
import { readFileSync } from './helpers/light-theme-source.mjs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Field Manager asset cards stay vertically stacked on phones', () => {
  const assets = source('app/field-manager/field-manager-assets-client.tsx');
  const styles = source('app/field-manager/page.module.css');

  assert.match(assets, /<AppAssetChoice/);
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

test('Petrol station asset choices include serial, year and usage', () => {
  const client = source('app/owner-app/operations/fuel/petrol-station/petrol-station-fuel-client.tsx');
  const styles = source('app/owner-app/operations/fuel/petrol-station/page.module.css');

  assert.match(client, /<AppAssetChoice/);
  assert.match(client, /serial=\{asset.serialNumber\}/);
  assert.match(client, /yearDisplayText\(asset\)/);
  assert.match(client, /usageDisplayText\(asset\)/);
  assert.match(styles, /\.assetMetaGrid\s*\{\s*display:\s*grid;\s*gap:/s);
  assert.doesNotMatch(styles, /\.assetMetaGrid\s*\{[^}]*grid-template-columns:/s);
});

test('Home uses the Owner neutral treatment when paired with Back', () => {
  const nav = source('app/field-manager/field-manager-nav-link.tsx');
  const navStyles = source('app/field-manager/field-manager-nav-link.module.css');
  const fuelChoice = source('app/field-manager/diesel/page.tsx');
  const storageChoice = source('app/field-manager/field-manager-diesel-client.tsx');
  const petrolStation = source('app/field-manager/diesel/petrol-station/page.tsx');
  const assets = source('app/field-manager/field-manager-assets-client.tsx');

  assert.match(nav, /tone\?: 'default' \| 'home'/);
  assert.match(nav, /tone === 'home' \? styles\.homeLink/);
  assert.match(navStyles, /background: #eef5f0/);
  assert.match(navStyles, /color: #173c2e/);

  for (const pairedScreen of [fuelChoice, storageChoice, petrolStation]) {
    assert.match(pairedScreen, /label="Home" tone="home"/);
  }

  assert.match(assets, /label="Home"/);
  assert.doesNotMatch(assets, /label="Home" tone="home"/);
});

test('Field Manager home calls the asset workflow Record work', () => {
  const home = source('app/field-manager/field-manager-home-client.tsx');

  assert.match(home, /href="\/field-manager\/assets"[\s\S]*?<strong>Record work<\/strong>/);
  assert.doesNotMatch(home, /Manage Assets/);
});
