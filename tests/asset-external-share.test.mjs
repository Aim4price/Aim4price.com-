import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEmailShareUrl,
  buildExternalAssetShareCopy,
  buildWhatsAppShareUrl,
} from '../lib/asset-external-share.ts';

const asset = {
  title: '2019 John Deere 6155M',
  serialNumber: '1L06155MHKH123456',
  yearModel: 2019,
  usage: '6 420 hours',
  condition: 'Good',
  replacementPriceExVat: 2_850_000,
  valueExVat: 1_675_000,
  photoUrls: ['https://images.example.com/front.jpg', 'https://images.example.com/rear.jpg'],
  publicUrl: 'https://www.aim4price.com/scan/asset-code',
};

test('outside share copy contains every requested field without claiming optional attachments', () => {
  const copy = buildExternalAssetShareCopy(asset.title, [asset]);

  assert.equal(copy.subject, '2019 John Deere 6155M asset details');
  assert.match(copy.body, /Serial number: 1L06155MHKH123456/);
  assert.match(copy.body, /Year: 2019/);
  assert.match(copy.body, /Usage: 6 420 hours/);
  assert.match(copy.body, /Condition: Good/);
  assert.match(copy.body, /Replacement price \(excl\. VAT\): R 2[ ,]850[ ,]000/);
  assert.match(copy.body, /Current value \(excl\. VAT\): R 1[ ,]675[ ,]000/);
  assert.doesNotMatch(copy.body, /Attachments:/);
  assert.doesNotMatch(copy.body, /Photos:/);
  assert.doesNotMatch(copy.body, /https:\/\//);
  assert.doesNotMatch(copy.body, /Aim4price asset link/);
});

test('multiple assets are numbered without exposing private attachment URLs', () => {
  const copy = buildExternalAssetShareCopy('Harvest fleet', [
    asset,
    {
      ...asset,
      title: 'Grain trailer',
      serialNumber: '',
      yearModel: null,
      usage: '—',
      condition: '',
      replacementPriceExVat: null,
      valueExVat: null,
      photoUrls: ['https://images.example.com/trailer.jpg'],
      publicUrl: null,
    },
  ]);

  assert.match(copy.body, /Harvest fleet\n2 assets/);
  assert.match(copy.body, /1\. 2019 John Deere 6155M/);
  assert.match(copy.body, /2\. Grain trailer/);
  assert.match(copy.body, /Serial number: Not saved/);
  assert.match(copy.body, /Year: Not saved/);
  assert.match(copy.body, /Usage: Not saved/);
  assert.doesNotMatch(copy.body, /Attachments:/);
  assert.doesNotMatch(copy.body, /images\.example\.com/);
});

test('the composed message summarizes only the attachments explicitly selected', () => {
  const copy = buildExternalAssetShareCopy(asset.title, [asset], {
    attachedPhotoCount: 2,
    attachedReportCount: 1,
  });

  assert.match(copy.body, /Attachments: 2 photos, 1 Aim4price report/);
  assert.equal((copy.body.match(/Attachments:/g) ?? []).length, 1);
  assert.doesNotMatch(copy.body, /attached separately/);
  assert.doesNotMatch(copy.body, /https:\/\//);
});

test('WhatsApp and email links carry the formatted message safely', () => {
  const copy = buildExternalAssetShareCopy(asset.title, [asset]);
  const whatsappUrl = new URL(buildWhatsAppShareUrl(copy));
  const emailUrl = buildEmailShareUrl(copy);

  assert.equal(whatsappUrl.hostname, 'wa.me');
  assert.equal(whatsappUrl.searchParams.get('text'), copy.body);
  assert.match(emailUrl, /^mailto:\?subject=/);
  assert.match(decodeURIComponent(emailUrl), /2019 John Deere 6155M asset details/);
  assert.match(decodeURIComponent(emailUrl), /Serial number: 1L06155MHKH123456/);
});
