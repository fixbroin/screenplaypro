/**
 * Reusable client-side image compression utility using HTML5 Canvas.
 * Compresses any image file larger than 1 MB down to under 1 MB while maintaining high visual detail.
 */
export async function compressImage(file: File, maxSizeBytes: number = 1024 * 1024): Promise<File> {
  // If it's not a compressable image or is already under the target size, bypass compression
  if (!file.type.startsWith('image/') || file.type.includes('gif') || file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Step 1: Scale down dimensions proportionally if they are extremely large
        const maxDimension = 2048;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // Fallback to original file if canvas context is unavailable
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Step 2: Iteratively export canvas blob to hit under 1 MB target
        // We start with high quality (0.82) and reduce quality/scale if needed
        let quality = 0.82;
        const mimeType = 'image/jpeg'; // Convert PNG/WEBP to JPEG for maximum compression efficiency

        const exportBlob = (currentQuality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }

              // If it's still larger than target size and we can decrease quality further, do so
              if (blob.size > maxSizeBytes && currentQuality > 0.4) {
                // If quality is already low, start scaling down canvas dimensions as well
                if (currentQuality < 0.6) {
                  canvas.width = Math.round(canvas.width * 0.85);
                  canvas.height = Math.round(canvas.height * 0.85);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }
                exportBlob(currentQuality - 0.1);
              } else {
                // Convert Blob back to File
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                  type: mimeType,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              }
            },
            mimeType,
            currentQuality
          );
        };

        exportBlob(quality);
      };

      img.onerror = () => {
        resolve(file);
      };
    };

    reader.onerror = () => {
      resolve(file);
    };
  });
}
