import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';
import { adminAuth } from '@/lib/firebaseAdmin';
import { ADMIN_EMAIL } from '@/lib/constants';

async function getRequesterInfo(req: NextRequest) {
  let requesterUid: string | null = null;
  let requesterEmail: string | null = null;
  let isAdminUser = false;

  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        requesterUid = decoded.uid;
        requesterEmail = decoded.email ? decoded.email.toLowerCase() : null;
      } catch (e) {
        // Token verify failed or expired
      }
    }
  }

  // Fallback to custom headers or searchParams
  if (!requesterUid) {
    requesterUid = req.headers.get('x-user-id') || new URL(req.url).searchParams.get('requesterId') || null;
  }
  if (!requesterEmail) {
    const headerEmail = req.headers.get('x-user-email') || new URL(req.url).searchParams.get('requesterEmail') || null;
    requesterEmail = headerEmail ? headerEmail.toLowerCase() : null;
  }

  // Check admin status
  if (requesterEmail && requesterEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    isAdminUser = true;
  } else if (requesterUid) {
    try {
      const userRows = await queryDb<any[]>('SELECT email, roles FROM users WHERE id = ?', [requesterUid]);
      if (userRows && userRows.length > 0) {
        const u = userRows[0];
        if (u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          isAdminUser = true;
          if (!requesterEmail) requesterEmail = u.email.toLowerCase();
        } else {
          const roles = typeof u.roles === 'string' ? JSON.parse(u.roles || '[]') : (u.roles || []);
          if (Array.isArray(roles) && roles.includes('admin')) {
            isAdminUser = true;
          }
        }
      }
    } catch (e) {
      // MySQL lookup skipped or failed
    }
  }

  return { requesterUid, requesterEmail, isAdminUser };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const scriptId = searchParams.get('scriptId');
    const shareId = searchParams.get('shareId');
    const all = searchParams.get('all');

    const { requesterUid, requesterEmail, isAdminUser } = await getRequesterInfo(req);

    // 1. Fetching via public shareId link
    if (shareId) {
      const rows = await queryDb<any[]>('SELECT * FROM scripts WHERE shareId = ?', [shareId]);
      if (rows.length === 0) return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 });
      const script = formatScriptRow(rows[0]);
      if (!script.isPublic) {
        return NextResponse.json({ success: false, error: 'This screenplay is private', isForbidden: true }, { status: 403 });
      }
      return NextResponse.json({ success: true, script });
    }

    // 2. Fetching specific script by scriptId (Direct script editing / viewing)
    if (scriptId) {
      const rows = await queryDb<any[]>('SELECT * FROM scripts WHERE id = ?', [scriptId]);
      if (rows.length === 0) return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 });
      const script = formatScriptRow(rows[0]);

      const isOwner = Boolean(
        (requesterUid && script.ownerId && requesterUid === script.ownerId) ||
        (requesterEmail && script.ownerEmail && requesterEmail === script.ownerEmail.toLowerCase())
      );

      const isCollaborator = Boolean(
        (requesterUid && script.collaborators?.some((c: any) => c.userId === requesterUid)) ||
        (requesterEmail && script.collaborators?.some((c: any) => c.email && c.email.toLowerCase() === requesterEmail))
      );

      // ACCESS RULE: Only Administrator, Author (Owner), or Collaborator can access the script!
      if (!isAdminUser && !isOwner && !isCollaborator) {
        return NextResponse.json({ 
          success: false, 
          error: 'Access denied: This screenplay is strictly private and only accessible by its author.',
          isForbidden: true 
        }, { status: 403 });
      }

      return NextResponse.json({ success: true, script });
    }

    // 3. Fetching scripts for a specific userId
    if (userId) {
      const isSelf = requesterUid === userId;
      if (!isAdminUser && !isSelf) {
        return NextResponse.json({ 
          success: false, 
          error: 'Access denied: You can only view your own screenplays.',
          isForbidden: true 
        }, { status: 403 });
      }

      const rows = await queryDb<any[]>('SELECT * FROM scripts WHERE ownerId = ? ORDER BY updatedAt DESC', [userId]);
      const scripts = rows.map(formatScriptRow);
      return NextResponse.json({ success: true, scripts });
    }

    // 4. Admin requesting all scripts (e.g., from Dashboard admin view)
    if (isAdminUser || all === 'true') {
      if (!isAdminUser) {
        return NextResponse.json({ 
          success: false, 
          error: 'Access denied: Only administrators can view all screenplays.',
          isForbidden: true 
        }, { status: 403 });
      }
      const rows = await queryDb<any[]>('SELECT * FROM scripts ORDER BY updatedAt DESC');
      const scripts = rows.map(formatScriptRow);
      return NextResponse.json({ success: true, scripts });
    }

    // 5. If requester is identified, return their scripts
    if (requesterUid) {
      const rows = await queryDb<any[]>('SELECT * FROM scripts WHERE ownerId = ? ORDER BY updatedAt DESC', [requesterUid]);
      const scripts = rows.map(formatScriptRow);
      return NextResponse.json({ success: true, scripts });
    }

    // 6. Anonymous / stats count query: return empty array with total count, NEVER dumping other users' scripts
    const countRows = await queryDb<any[]>('SELECT COUNT(*) as total FROM scripts');
    const total = countRows[0]?.total || 0;
    return NextResponse.json({ 
      success: true, 
      scripts: Array(total).fill({ id: '' }), 
      total 
    });

  } catch (error: any) {
    console.error('Error fetching scripts from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { requesterUid, requesterEmail, isAdminUser } = await getRequesterInfo(req);
    const body = await req.json();
    const { id, title, description, writtenBy, content, ownerId, ownerEmail, collaborators, isPublic, publicPermission, shareId, settings } = body;

    if (!id || !title || !ownerId) {
      return NextResponse.json({ success: false, error: 'Missing required fields: id, title, ownerId' }, { status: 400 });
    }

    // If script already exists in database, verify authorization to modify it
    const existingRows = await queryDb<any[]>('SELECT ownerId, ownerEmail, collaborators FROM scripts WHERE id = ?', [id]);
    if (existingRows.length > 0) {
      const existing = existingRows[0];
      const isOwner = Boolean(
        (requesterUid && existing.ownerId && requesterUid === existing.ownerId) ||
        (requesterEmail && existing.ownerEmail && requesterEmail === existing.ownerEmail.toLowerCase()) ||
        (ownerId && existing.ownerId && ownerId === existing.ownerId)
      );

      let collaboratorsList: any[] = [];
      try {
        collaboratorsList = typeof existing.collaborators === 'string' ? JSON.parse(existing.collaborators) : (existing.collaborators || []);
      } catch (e) {}

      const canCollaboratorEdit = collaboratorsList.some((c: any) => 
        (c.userId === requesterUid || (c.email && requesterEmail && c.email.toLowerCase() === requesterEmail)) && c.permission === 'edit'
      );

      if (!isAdminUser && !isOwner && !canCollaboratorEdit) {
        return NextResponse.json({ 
          success: false, 
          error: 'Access denied: You do not have permission to modify this screenplay.' 
        }, { status: 403 });
      }
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

    const { requesterUid, requesterEmail, isAdminUser } = await getRequesterInfo(req);

    const existingRows = await queryDb<any[]>('SELECT ownerId, ownerEmail FROM scripts WHERE id = ?', [scriptId]);
    if (existingRows.length > 0) {
      const existing = existingRows[0];
      const isOwner = Boolean(
        (requesterUid && existing.ownerId && requesterUid === existing.ownerId) ||
        (requesterEmail && existing.ownerEmail && requesterEmail === existing.ownerEmail.toLowerCase())
      );

      if (!isAdminUser && !isOwner) {
        return NextResponse.json({ 
          success: false, 
          error: 'Access denied: You do not have permission to delete this screenplay.' 
        }, { status: 403 });
      }
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
