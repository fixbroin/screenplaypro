import { NextRequest, NextResponse } from 'next/server';
import { triggerRefresh } from '@/lib/revalidateUtils';

export async function POST(req: NextRequest) {
  try {
    const { tag } = await req.json();
    if (!tag) {
      return NextResponse.json({ error: 'Tag is required' }, { status: 400 });
    }

    // You can add security checks here if needed (e.g. check for admin session)
    await triggerRefresh(tag);
    
    return NextResponse.json({ success: true, tag });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
