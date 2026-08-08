import { NextResponse } from "next/server";
import { isAim4priceAdminEmail } from "../../../../../lib/account-constants";
import {
  buildLifecycleWorkbook,
  lifecycleWorkbookFileName,
  type LifecycleReportRequest,
} from "../../../../../lib/admin-lifecycle-calculator-report";
import { getAnyServerSession } from "../../../../../lib/auth-session";
import { createXlsxWorkbook } from "../../../../../lib/simple-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isAim4priceAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Aim4price admin access required" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as LifecycleReportRequest;
    const generatedAt = new Date();
    const workbook = createXlsxWorkbook(
      buildLifecycleWorkbook(payload, generatedAt),
    );
    const fileName = lifecycleWorkbookFileName(
      payload.clientName,
      payload.assetDescription,
      generatedAt,
    );

    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Lifecycle financial model export failed", error);
    return NextResponse.json(
      { error: "Unable to generate the financial model" },
      { status: 400 },
    );
  }
}
