import { NextRequest, NextResponse } from 'next/server';
import { accountantWorkspaceError, getAccountantLedger } from '../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string } };

export async function GET(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  const searchParams = new URL(request.url).searchParams;
  const kind = searchParams.get('kind') === 'fuel' ? 'fuel' : 'cost';
  try {
    const data = await getAccountantLedger({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      kind,
      registerId: searchParams.get('registerId'),
    });

    if (kind === 'cost' && 'cost' in data && data.cost) {
      const assetId = searchParams.get('assetId') || '';
      const year = Number(searchParams.get('year'));
      const month = Number(searchParams.get('month'));
      const invoices = data.cost.invoices.filter((invoice) => {
        if (assetId && assetId !== 'all' && invoice.assetId !== assetId) return false;
        if (Number.isInteger(year) && year >= 2000) {
          const invoiceDate = invoice.invoiceDate ? new Date(`${invoice.invoiceDate}T00:00:00`) : null;
          if (!invoiceDate || Number.isNaN(invoiceDate.getTime()) || invoiceDate.getFullYear() !== year) return false;
          if (Number.isInteger(month) && month >= 1 && month <= 12 && invoiceDate.getMonth() + 1 !== month) return false;
        }
        return true;
      });
      const summary = invoices.reduce((current, invoice) => ({
        totalSpent: current.totalSpent + invoice.totalIncVat,
        maintenanceSpend: current.maintenanceSpend + (invoice.blocks.find((block) => block.blockType === 'maintenance')?.totalIncVat ?? 0),
        partsSpend: current.partsSpend + (invoice.blocks.find((block) => block.blockType === 'parts')?.totalIncVat ?? 0),
        repairSpend: current.repairSpend + (invoice.blocks.find((block) => block.blockType === 'repair')?.totalIncVat ?? 0),
        otherSpend: current.otherSpend + (invoice.blocks.find((block) => block.blockType === 'other')?.totalIncVat ?? 0),
        vatTotal: current.vatTotal + (invoice.vatAmount ?? 0),
        invoiceCount: current.invoiceCount + 1,
      }), { totalSpent: 0, maintenanceSpend: 0, partsSpend: 0, repairSpend: 0, otherSpend: 0, vatTotal: 0, invoiceCount: 0 });

      return NextResponse.json({ ok: true, ...data, cost: { ...data.cost, invoices, summary } });
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error('accountant ledger GET failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
