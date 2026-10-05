import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');
    const id = searchParams.get('id');

    if (!name) {
      return NextResponse.json({ success: false, error: 'Collection name is required' }, { status: 400 });
    }

    if (id) {
      const rows = await queryDb<any[]>(
        'SELECT data FROM generic_collections WHERE collection_name = ? AND id = ?',
        [name, id]
      );
      if (!rows || rows.length === 0) {
        return NextResponse.json({ success: true, data: null });
      }
      return NextResponse.json({ success: true, data: JSON.parse(rows[0].data) });
    }

    const rows = await queryDb<any[]>(
      'SELECT id, data, createdAt, updatedAt FROM generic_collections WHERE collection_name = ? ORDER BY createdAt DESC',
      [name]
    );

    const items = rows.map((row) => {
      try {
        const item = JSON.parse(row.data);
        return { ...item, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
      } catch {
        return { id: row.id, raw: row.data };
      }
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    console.error('Error fetching collection from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { collectionName, id, data } = body;

    if (!collectionName) {
      return NextResponse.json({ success: false, error: 'Collection name is required' }, { status: 400 });
    }

    const docId = id || data?.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullData = { ...data, id: docId };
    const valueStr = JSON.stringify(fullData);

    await queryDb(
      `INSERT INTO generic_collections (id, collection_name, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = ?`,
      [docId, collectionName, valueStr, valueStr]
    );

    return NextResponse.json({ success: true, id: docId, data: fullData });
  } catch (error: any) {
    console.error('Error saving collection document to MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll');

    if (!name) {
      return NextResponse.json({ success: false, error: 'Collection name is required' }, { status: 400 });
    }

    if (clearAll === 'true') {
      await queryDb('DELETE FROM generic_collections WHERE collection_name = ?', [name]);
      return NextResponse.json({ success: true, message: 'Entire collection cleared successfully' });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Document ID is required' }, { status: 400 });
    }

    await queryDb('DELETE FROM generic_collections WHERE collection_name = ? AND id = ?', [name, id]);

    return NextResponse.json({ success: true, message: 'Document deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting collection document from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
