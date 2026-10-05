export async function uploadLocalImage(file: File, folderName: string = 'general', oldImageUrl?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folderName);
  if (oldImageUrl) {
    formData.append('oldFileUrl', oldImageUrl);
  }

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to upload image.');
  }

  return data.fileUrl || data.url;
}

export async function deleteLocalImage(imageUrl: string): Promise<boolean> {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return true;

  try {
    const res = await fetch('/api/delete-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl: imageUrl })
    });
    const data = await res.json();
    return data.success;
  } catch (err) {
    console.error("Error calling delete-file API:", err);
    return false;
  }
}
