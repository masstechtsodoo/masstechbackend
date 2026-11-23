import { v2 as cloudinary } from "cloudinary";
import { cloudinaryEnabled, env } from "../env.js";
import type { ImageRef } from "../db/schema.js";
import { HttpError } from "./http.js";

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const UPLOAD_FOLDERS = ["products", "projects"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/**
 * Signature for a direct browser → Cloudinary upload.
 * The file never passes through Render, so there is no request-size limit or extra bandwidth.
 */
export function signUpload(folder: UploadFolder) {
  if (!cloudinaryEnabled) throw new HttpError(503, "cloudinary_not_configured");
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp, folder: `${env.CLOUDINARY_FOLDER}/${folder}` };
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET!);
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey: env.CLOUDINARY_API_KEY!,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    ...params,
    signature,
  };
}

/** Best-effort removal of images that are no longer referenced. Never throws. */
export async function destroyImages(publicIds: (string | null | undefined)[]) {
  if (!cloudinaryEnabled) return;
  const ids = [...new Set(publicIds.filter((x): x is string => !!x))];
  await Promise.all(
    ids.map((id) =>
      cloudinary.uploader.destroy(id, { invalidate: true }).catch((e) => console.warn("Cloudinary destroy failed", id, e)),
    ),
  );
}

/** publicIds present in `before` but missing from `after` */
export function removedImages(before: (ImageRef | null | undefined)[], after: (ImageRef | null | undefined)[]) {
  const keep = new Set(after.map((i) => i?.publicId).filter(Boolean));
  return before.map((i) => i?.publicId).filter((id): id is string => !!id && !keep.has(id));
}
