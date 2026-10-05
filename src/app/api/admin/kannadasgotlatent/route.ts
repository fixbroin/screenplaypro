import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';

async function checkAdminAuth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  const token = authHeader.split('Bearer ')[1];
  return await adminAuth.verifyIdToken(token);
}

export async function GET(req: NextRequest) {
  try {
    await checkAdminAuth(req);
    
    const snapshot = await adminDb.collection('kannadaGotLatentApplications')
      .orderBy('createdAt', 'desc')
      .get();
      
    const applications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate().toISOString() : null,
        updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate().toISOString() : null,
      };
    });

    return NextResponse.json({ success: true, applications });
  } catch (error: any) {
    console.error('Error fetching admin applications:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await checkAdminAuth(req);
    
    const body = await req.json();
    const { id, status, internalNotes, callScheduled, auditionDate, judgeComments } = body;
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Application ID is required' }, { status: 400 });
    }

    const docRef = adminDb.collection('kannadaGotLatentApplications').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    const updateData: any = {
      updatedAt: Timestamp.now(),
    };

    if (status !== undefined) updateData.status = status;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
    if (callScheduled !== undefined) updateData.callScheduled = !!callScheduled;
    if (auditionDate !== undefined) updateData.auditionDate = auditionDate; 
    if (judgeComments !== undefined) updateData.judgeComments = judgeComments;

    await docRef.update(updateData);

    return NextResponse.json({ success: true, message: 'Application updated successfully' });
  } catch (error: any) {
    console.error('Error updating application:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await checkAdminAuth(req);
    
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Application ID is required' }, { status: 400 });
    }

    const docRef = adminDb.collection('kannadaGotLatentApplications').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    const appData = docSnap.data();

    // 1) Gather all file paths that are hosted locally on disk
    const filesToDelete: string[] = [];
    
    if (appData?.introVideoUrl && appData.introVideoUrl.startsWith('/uploads/')) {
      filesToDelete.push(appData.introVideoUrl);
    }
    if (appData?.talentVideoUrl && appData.talentVideoUrl.startsWith('/uploads/')) {
      filesToDelete.push(appData.talentVideoUrl);
    }
    if (Array.isArray(appData?.photos)) {
      for (const photo of appData.photos) {
        if (photo.startsWith('/uploads/')) {
          filesToDelete.push(photo);
        }
      }
    }

    // 2) Delete files from server local disk
    for (const fileRelativePath of filesToDelete) {
      try {
        const fullPath = path.join(process.cwd(), 'public', fileRelativePath);
        await fs.unlink(fullPath);
      } catch (err) {
        console.warn(`Failed to delete local file ${fileRelativePath}:`, err);
      }
    }

    // 3) Delete Firestore document
    await docRef.delete();

    return NextResponse.json({ success: true, message: 'Application and associated files deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting application:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
