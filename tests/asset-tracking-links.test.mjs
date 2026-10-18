import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrackerCode,trackerPairingUrl,trackerPairingIntent} from '../lib/asset-tracking-links.ts';
test('pairing QR keeps the credential in the fragment and targets the tracker app',()=>{
 const code='ABCDEF0123456789',url=new URL(trackerPairingUrl(code));
 assert.equal(url.pathname,'/tracker/pair');assert.equal(url.search,'');assert.equal(url.hash,`#${code}`);
 assert.equal(normalizeTrackerCode(' abcdef0123456789 '),code);
 assert.equal(trackerPairingUrl('ABCD-EF01-2345-6789'),trackerPairingUrl(code));
 assert.equal(trackerPairingIntent('ABCD-EF01-2345-6789'),trackerPairingIntent(code));
 assert.equal(trackerPairingIntent(code),`intent://pair?code=${code}#Intent;scheme=aim4price-tracker;package=com.aim4price.tracker.pilot;end`);
});
test('malformed pairing codes cannot inject an intent or URL',()=>{
 for(const code of ['', 'A'.repeat(15), 'A'.repeat(17),'ZZZZZZZZZZZZZZZZ','ABCDEF0123456789;end','%23Intent','../pair']){
 assert.equal(normalizeTrackerCode(code),null);assert.equal(trackerPairingUrl(code),null);assert.equal(trackerPairingIntent(code),null);
 }
});
