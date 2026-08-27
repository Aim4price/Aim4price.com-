import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const client = read('app/my-invoices/my-invoices-client.tsx');
const styles = read('app/my-invoices/page.module.css');
const modalStart = client.indexOf('{formOpen ? (');
const modalEnd = client.indexOf('{deleteCandidateInvoice ?', modalStart);
const costFormModal = client.slice(modalStart, modalEnd);

test('manual costs use a compact three-step wizard', () => {
  assert.ok(modalStart >= 0 && modalEnd > modalStart, 'cost form modal should be present');
  assert.match(client, /type ManualCostWizardStep = 1 \| 2 \| 3/);
  assert.match(client, /const \[manualCostWizardStep, setManualCostWizardStep\]/);
  assert.match(costFormModal, /\[\['Invoice', 1\], \['Work', 2\], \['Review', 3\]\]/);
  assert.match(costFormModal, /styles\.invoiceDropWizardProgress/);
  assert.match(costFormModal, /styles\.invoiceDropWizardPanel/);
  assert.match(costFormModal, /Add the invoice details/);
  assert.match(costFormModal, /Describe the work/);
  assert.match(costFormModal, /Review your cost/);
  assert.match(costFormModal, /onClick=\{continueManualCostWizard\}/);
  assert.match(costFormModal, /goBackManualCostWizard/);
});

test('manual wizard validates the total and saves only from review', () => {
  assert.match(client, /function manualCostInvoiceError\(\)/);
  assert.match(client, /manualCostTotalValue <= 0/);
  assert.match(client, /Enter the total amount including VAT before continuing/);
  assert.match(client, /function handleInvoiceFormSubmit\(event: FormEvent<HTMLFormElement>\)[\s\S]*?if \(manualCostWizardOpen\)[\s\S]*?if \(manualCostWizardStep < 3\) continueManualCostWizard\(\);[\s\S]*?return;[\s\S]*?void saveInvoiceDraft\(\);/);
  assert.match(client, /async function saveInvoiceDraft\(\)[\s\S]*?if \(flow === 'manual-form' && manualCostWizardStep !== 3\)[\s\S]*?Review the cost record before saving/);
  assert.match(client, /setManualCostWizardStep\(2\)/);
  assert.match(client, /setManualCostWizardStep\(3\)/);
  assert.match(costFormModal, /onSubmit=\{handleInvoiceFormSubmit\}/);
  assert.match(costFormModal, /manualCostWizardStep < 3[\s\S]*?>\s*Next\s*</);
  assert.match(costFormModal, /manualCostWizardOpen \? \([\s\S]*?<button type="button"[^>]*onClick=\{\(\) => void saveInvoiceDraft\(\)\}[^>]*>[\s\S]*?Save cost record/);
});

test('review preserves every manual cost field and attachment before save', () => {
  for (const label of [
    'Asset',
    'Supplier',
    'Invoice number',
    'Invoice date',
    'Usage',
    'Subtotal excl. VAT',
    'VAT amount',
    'Total incl. VAT',
    'Maintenance work',
    'Parts supplied',
    'Repair work',
    'Notes',
    'Attachment',
  ]) {
    assert.match(costFormModal, new RegExp(`<dt>${label}<\\/dt>`));
  }
  assert.match(costFormModal, /manualUploadFile\?\.name \|\| uploadedDocument\?\.fileName \|\| 'None'/);
  assert.match(client, /maintenanceWorkDone: draft\.maintenanceWorkDone/);
  assert.match(client, /partsSupplied: draft\.partsSupplied/);
  assert.match(client, /repairWorkDone: draft\.repairWorkDone/);
});

test('manual wizard manages focus, keyboard escape and visible errors', () => {
  assert.match(client, /manualCostWizardStepHeadingRef/);
  assert.match(client, /if \(!manualCostWizardOpen \|\| usageMetricDropdownOpen\) return undefined/);
  assert.match(client, /manualCostWizardStepHeadingRef\.current\?\.focus\(\)/);
  assert.match(client, /event\.key === 'Escape' && !isSaving/);
  assert.match(costFormModal, /role="alert">\{manualCostWizardError\}/);
  assert.match(costFormModal, /aria-current=\{manualCostWizardStep === step \? 'step' : undefined\}/);
});

test('manual wizard has responsive purpose-built styling', () => {
  assert.match(styles, /\.manualCostWizardModal\s*\{[^}]*width:\s*min\(100%, 940px\)/);
  assert.match(styles, /\.manualCostWizardModal\s*\{[^}]*max-height:\s*min\(94dvh, 880px\)/);
  assert.match(styles, /\.manualCostWizardModal \.manualCostInvoiceGrid\s*\{[^}]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.manualCostReviewWide dd\s*\{[^}]*white-space:\s*normal/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.manualCostWizardModal \.manualCostInvoiceGrid\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(styles, /\.manualCostWizardModal \.manualCostWizardFooter\s*\{[^}]*justify-content:\s*space-between/);
});
