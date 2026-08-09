import { NextResponse } from 'next/server';
import { calculateRiskPreview } from '@/core/engine/risk/RiskCalculator';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Ensure the payload has the required fields
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const {
      accountBalance,
      direction,
      entryReferencePrice,
      stopLoss,
      takeProfit,
      riskPercent,
      maxAllocationPercent,
      leverage
    } = body;

    const result = calculateRiskPreview({
      accountBalance,
      direction,
      entryReferencePrice,
      stopLoss,
      takeProfit,
      riskPercent,
      maxAllocationPercent,
      leverage: leverage || 1 // Enforce leverage 1 as per current contract
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[RiskPreviewAPI] Error:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
