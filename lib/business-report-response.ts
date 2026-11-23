import { NextResponse } from 'next/server';
import { CreditLimitError, recordBusinessReport } from './business-credits';

export async function meteredReport(response: NextResponse, request: Request, actorId: string | undefined, label: string) {
  if (actorId && response.ok && request.method !== 'HEAD') {
    try {
      await recordBusinessReport(actorId, label);
    } catch (error) {
      if (!(error instanceof CreditLimitError)) throw error;
      return NextResponse.json({error:error.message, code:'BUSINESS_CREDIT_LIMIT'}, {status:402});
    }
  }
  return response;
}
