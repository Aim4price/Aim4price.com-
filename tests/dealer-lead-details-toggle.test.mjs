import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('dealer leads open with optional details and retain visible problem alerts', async () => {
  const source = await read('app/leads/leads-client.tsx');
  assert.match(source, /\[expandedLeadDetailsId, setExpandedLeadDetailsId\] = useState<string \| null>\(null\)/);
  assert.match(source, /setExpandedLeadDetailsId\(null\);\s*setOpenLeadId\(leadToOpen.id\)/);
  assert.match(source, /showLeadDetails = !isDealerLeadsMode \|\| expandedLeadDetailsId === lead.id/);
  assert.match(source, /aria-expanded=\{showLeadDetails\}/);
  assert.match(source, /aria-controls=\{`lead-details-\$\{lead.id\}`\}/);
  assert.match(source, /hidden=\{!showLeadDetails\}>\s*\{showLeadDetails \? renderLeadDetails\(lead\) : null\}/);
  const alerts = source.indexOf('notesOnly detailsVisible={isLeadOpen}');
  const card = source.indexOf('<LeadAssetCard expanded={showLeadDetails}');
  assert.ok(alerts > 0 && alerts < card, 'problem alerts stay outside the collapsed asset details');
});

test('dealer Send note is available from Manage and preserves the existing composer', async () => {
  const source = await read('app/leads/leads-client.tsx');
  const manage = source.slice(source.indexOf('{managedLead ? ('), source.indexOf('</LeadManageDialog>'));
  assert.match(manage, /isDealerLeadsMode && \([\s\S]*data-manage-action="sendNote"/);
  assert.match(manage, /onClick=\{\(\) => openNoteModal\(managedLead\)\}/);
  assert.match(manage, /<strong>Send note<\/strong>/);
  assert.match(await read('components/leads/LeadNoteDialog.tsx'), /<h3 id="lead-note-title">Send note<\/h3>/);
  assert.match(await read('components/leads/LeadAssetCard.tsx'), /expanded = true/);
});
