import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    if (process.env.NODE_ENV !== 'production') {
      console.info('[rum]', payload?.name, payload?.value, payload?.path);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Invalid RUM payload', error);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
