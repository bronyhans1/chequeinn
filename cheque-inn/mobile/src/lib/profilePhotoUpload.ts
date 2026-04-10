import { getAuthToken } from "@/lib/api/client";
import { ENV } from "@/lib/env";

const BUCKET = "profile-photos";

/**
 * Upload a local image URI to Supabase Storage using the Storage REST API and the
 * same JWT the app uses for the backend (Bearer on Authorization).
 * Matches web bucket/path: `profile-photos` / `profile-photos/{userId}-{timestamp}.ext`
 */
export async function uploadProfilePhotoFromUri(
  localUri: string,
  userId: string,
  mimeHint?: string | null
): Promise<{ publicUrl: string } | { error: string }> {
  const token = await getAuthToken();
  const base = ENV.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!token) return { error: "Not signed in" };
  if (!base || !anon) return { error: "Storage not configured" };

  const response = await fetch(localUri);
  const blob = await response.blob();
  const mime = mimeHint || blob.type || "image/jpeg";
  const ext =
    mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const objectPath = `profile-photos/${userId}-${Date.now()}.${ext}`;

  const uploadUrl = `${base}/storage/v1/object/${BUCKET}/${objectPath}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
      "Content-Type": mime,
      "x-upsert": "true",
    },
    body: blob,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      error: text || `Upload failed (${res.status}). Check storage policies and bucket name.`,
    };
  }

  const publicUrl = `${base}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  return { publicUrl };
}
