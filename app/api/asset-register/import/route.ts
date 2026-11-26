import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';
import { getAssetRegisterForUser } from '../../../../lib/asset-registers';
import { withAssetInputTransaction, prepareAssetRegisterRevaluation, createManualAssetRegisterItem, listAssetRegisterItemsForRegisters } from '../../../../lib/asset-register-db';
import { ensureCreditSchema, CreditLimitError } from '../../../../lib/business-credits';
import { withDatabaseClient } from '../../../../lib/db';
import { ensureAssetLifecycleSchema, recordManualAssetLifecycle } from '../../../../lib/asset-lifecycle';
import { assetTitle, columnLabel, conditionKey, sheetAssetKind, sheetStatus, importKeyRow, readSheetColumns, readSheetRow, maxAssets, parseAmount, rowErrors, usageUnit, type CustomColumn, type AssetRow } from '../../../../lib/asset-sheet';
import { getBillingAgreement } from '../../../../lib/billing';
import { hostedRegisterBand, ownerHosting, rand } from '../../../../lib/hosting-pricing';
import { pricingInputExVat } from '../../../../lib/pricing-vat';
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const serialKey = (s: string) => s.trim().toUpperCase();
export async function POST(req: NextRequest) {
  const session = await getServerSession({ requireActive: true, allowDealerApp: true, allowBusinessWorkspace: true });
  if (!session?.user?.id)
    return fail('Please sign in.', 401);
  const workspace = await resolveOwnerWorkspaceContext(req);
  if (!workspace.ok)
    return workspace.response;
  const access = await getAssetRegisterAccountAccess(session);
  if (workspace.context.team || !access)
    return fail('This account cannot add assets here.', 403);
  const owner = workspace.context.ownerUserId;
  const body = await req.json().catch(() => null);
  if (!body || !uuid.test(String(body.registerId)) || !['preview', 'save'].includes(body.action) ||
    !['', 'included', 'excluded'].includes(body.basis) || !Array.isArray(body.rows) ||
    body.rows.length < 1 || body.rows.length > maxAssets)
    return fail('Choose a register and review the sheet.');
  const rows: AssetRow[] = [];
  let custom: CustomColumn[];
  try {
    custom = readSheetColumns(body.customColumns);
    for (const raw of body.rows) {
      const row = readSheetRow(raw, custom);
      const error = Object.values(rowErrors(row, body.basis))[0];
      if (error) throw Error(error);
      rows.push(row);
    }
  } catch (error) {
    return fail(`Row ${rows.length + 1}: ${(error as Error).message}`);
  }
  const register = await getAssetRegisterForUser(owner, body.registerId);
  if (!register)
    return fail('Register unavailable.', 404);
  const metered = Boolean(workspace.context.meteredBusiness);
  // A repeat of the same sheet also matches rows that have no serial number.
  const batch = createHash('sha256').update(JSON.stringify([body.basis, rows.map(importKeyRow)])).digest('hex');
  const agreement = access.accountType === 'dealer' && !metered && !register.isPrimary && access.profile?.accountSubtype !== 'equipment-middleman' ? await getBillingAgreement(owner) : null;
  async function inspect() {
    const existing = await listAssetRegisterItemsForRegisters(owner, [body.registerId]);
    const serials = new Set(existing.map(a => serialKey(a.serialNumber || '')).filter(Boolean));
    const keys = new Set(existing.map(a => a.specsJson?.assetImportKey));
    const checks = rows.map((row, i) => {
      const key = batch + '-' + i;
      const serial = serialKey(row.serial);
      const skip = keys.has(key) ? 'Already imported' : serial && serials.has(serial) ? 'Matching serial / VIN' : '';
      if (serial)
        serials.add(serial);
      return { key, skip };
    });
    const count = existing.length + checks.filter(c => !c.skip).length;
    let hosting = '';
    if (agreement?.enabled && agreement.includeHostedRegisters) {
      const period = agreement.interval === 'annual' ? 'annually' : 'monthly';
      hosting = count > 300 ? 'This register will need custom hosting pricing.' :
        'Hosted register after import: ' + count + ' assets · ' + rand(ownerHosting[hostedRegisterBand(count)][period] / 4) + ' ' + period + '.';
    }
    const token = createHash('sha256').update(JSON.stringify([batch, checks, hosting, metered])).digest('hex');
    return { checks, hosting, metered, token };
  }
  try {
    if (body.action === 'preview') {
      return NextResponse.json(await inspect());
    }
    await Promise.all([ensureAssetLifecycleSchema(), prepareAssetRegisterRevaluation(), metered && ensureCreditSchema()]);
    const result = await withAssetInputTransaction(client => withDatabaseClient(client, async () => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [owner + ':' + register.id]);
      const { checks, token } = await inspect();
      if (checks.some(c => !c.skip) && token !== body.token)
        throw Error('IMPORT_PREVIEW_CHANGED');
      const exVat = (amount: string) => amount ? pricingInputExVat(parseAmount(amount), body.basis === 'included') : null;
      let added = 0;
      for (const [i, row] of rows.entries()) {
        if (checks[i].skip)
          continue;
        const unit = usageUnit(row.unit);
        const reading = row.usage ? parseAmount(row.usage) : null;
        const insurance = sheetStatus(row, 'insurance');
        const finance = sheetStatus(row, 'finance');
        const license = sheetStatus(row, 'license');
        const asset = await createManualAssetRegisterItem(owner, {
          registerId: register.id, kind: sheetAssetKind(row.category), title: assetTitle(row),
          brandName: row.make, modelName: row.model, yearModel: row.year ? Number(row.year) : null,
          serialNumber: row.serial, hours: unit === 'percentage' ? null : reading,
          lifeWorkedPercent: unit === 'percentage' ? reading : null, usageMetric: unit === 'km' ? 'km' : 'hours',
          value: exVat(row.value) ?? 0, replacementPriceExVat: exVat(row.replacement),
          condition: conditionKey(row.condition) ?? null, note: row.note,
          isInsured: insurance === 'yes', insuredValueExVat: exVat(row.insuredValue),
          isFinanced: finance === 'yes', financeNote: row.financeNote,
          isLicensed: license === 'yes', licenseRegistrationNumber: row.registration,
          specsJson: {
            ...(custom.length ? { assetSheetFields: custom.map(key => ({ name: columnLabel(key), value: row[key] })) } : {}),
            assetImportKey: checks[i].key, importedCategory: row.category, usageTypeConfirmed: Boolean(unit),
            usageMode: unit === 'percentage' ? 'percent' : unit, insuranceStatus: insurance, insuranceNote: row.insuranceNote,
            financeStatus: finance, licenseStatus: license
          },
        }, { client, register });
        await recordManualAssetLifecycle({ ownerUserId: owner, asset, newlyAcquired: false, actorName: session?.user?.name });
        added++;
      }
      return { added, skipped: rows.length - added };
    }));
    return NextResponse.json(result);
  }
  catch (err) {
    if (err instanceof Error && err.message === 'IMPORT_PREVIEW_CHANGED')
      return fail('The register changed. Go back and review the assets again.', 409);
    if (err instanceof CreditLimitError)
      return fail(err.message + ' No assets were added.', 409);
    console.error('Asset sheet import failed', err);
    return fail('Could not complete the import. Review your sheet and retry.', 500);
  }
}
