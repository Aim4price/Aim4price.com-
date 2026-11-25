// Native media requests use the same website session context as the workspace page.
import { GET as serveRecording } from '../../../api/hover-videos/[id]/route';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest, context: {params: {id:string}}) {
  return serveRecording(request, context);
}
