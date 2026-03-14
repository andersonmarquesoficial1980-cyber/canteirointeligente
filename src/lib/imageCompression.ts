import imageCompression from "browser-image-compression";

/**
 * Compress an image file to under maxSizeMB (default 1).
 * Uses browser-image-compression for reliable cross-browser compression.
 */
export async function compressImage(file: File, maxSizeMB = 1): Promise<File> {
  const options = {
    maxSizeMB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/jpeg" as const,
  };
  const compressed = await imageCompression(file, options);
  return new File([compressed], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
  });
}
