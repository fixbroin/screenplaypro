import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const scriptId = searchParams.get('scriptId');
    const shareId = searchParams.get('shareId');

    if (scriptId) {
      const rows = await queryDb<any[]>('SELECT * FROM scripts WHERE id = ?', [scriptId]);
      if (rows.length === 0) return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 });
      const script = formatScriptRow(rows[0]);
      return NextResponse.json({ success: true, script });
    }

    if (shareId) {
      const rows = await queryDb<any[]>('SELECT * FROM scripts WHERE shareId = ?', [shareId]);
      if (rows.length === 0) return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 });
      const script = formatScriptRow(rows[0]);
      return NextResponse.json({ success: true, script });
    }

    if (userId) {
      const rows = await queryDb<any[]>('SELECT * FROM scripts WHERE ownerId = ? ORDER BY updatedAt DESC', [userId]);
      const scripts = rows.map(formatScriptRow);
      return NextResponse.json({ success: true, scripts });
    }

    const rows = await queryDb<any[]>('SELECT * FROM scripts ORDER BY updatedAt DESC');
    const scripts = rows.map(formatScriptRow);
    return NextResponse.json({ success: true, scripts });

  } catch (error: any) {
    console.error('Error fetching scripts from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, description, writtenBy, content, ownerId, ownerEmail, collaborators, isPublic, publicPermission, shareId, settings } = body;

    if (!id || !title || !ownerId) {
      return NextResponse.json({ success: false, error: 'Missing required fields: id, title, ownerId' }, { status: 400 });
    }

    const contentJson = typeof content === 'string' ? content : JSON.stringify(content || []);
    const collaboratorsJson = typeof collaborators === 'string' ? collaborators : JSON.stringify(collaborators || []);
    const settingsJson = typeof settings === 'string' ? settings : JSON.stringify(settings || {});

    await queryDb(
      `INSERT INTO scripts (id, title, description, writtenBy, content, ownerId, ownerEmail, collaborators, isPublic, publicPermission, shareId, settings, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
         title = VALUES(title),
         description = VALUES(description),
         writtenBy = VALUES(writtenBy),
         content = VALUES(content),
         collaborators = VALUES(collaborators),
         isPublic = VALUES(isPublic),
         publicPermission = VALUES(publicPermission),
         settings = VALUES(settings),
         updatedAt = NOW()`,
      [
        id,
        title || '',
        description || '',
        writtenBy || '',
        contentJson,
        ownerId,
        ownerEmail || '',
        collaboratorsJson,
        isPublic ? 1 : 0,
        publicPermission || 'view',
        shareId || '',
        settingsJson
      ]
    );

    return NextResponse.json({ success: true, message: 'Script saved to MySQL successfully.', id });

  } catch (error: any) {
    console.error('Error saving script to MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scriptId = searchParams.get('scriptId');

    if (!scriptId) {
      return NextResponse.json({ success: false, error: 'Missing scriptId parameter' }, { status: 400 });
    }

    await queryDb('DELETE FROM scripts WHERE id = ?', [scriptId]);
    return NextResponse.json({ success: true, message: 'Script deleted from MySQL successfully.' });

  } catch (error: any) {
    console.error('Error deleting script from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function formatScriptRow(row: any) {
  let content = [];
  try {
    content = typeof row.content === 'string' ? JSON.parse(row.content) : (row.content || []);
  } catch (e) {
    content = [];
  }

  let collaborators = [];
  try {
    collaborators = typeof row.collaborators === 'string' ? JSON.parse(row.collaborators) : (row.collaborators || []);
  } catch (e) {
    collaborators = [];
  }

  let settings = {};
  try {
    settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : (row.settings || {});
  } catch (e) {
    settings = {};
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    writtenBy: row.writtenBy || '',
    content,
    ownerId: row.ownerId,
    ownerEmail: row.ownerEmail || '',
    collaborators,
    isPublic: Boolean(row.isPublic),
    publicPermission: row.publicPermission || 'view',
    shareId: row.shareId || '',
    settings,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
