import { NextResponse } from 'next/server';
import { store } from '@/lib/verifier-store';

export async function GET() {
  return NextResponse.json({
    totalDumps: store.dumps.length,
    dumps: store.dumps
  });
}
