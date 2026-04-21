import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

/**
 * Extracts the storage object path (relative to the bucket root) from a
 * Supabase Storage public URL.
 *
 * Public URL shape:
 *   https://<ref>.supabase.co/storage/v1/object/public/avatars/<path>
 *
 * Returns null if the URL cannot be parsed or doesn't belong to the
 * avatars bucket.
 */
function extractStoragePath(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl);
    const parts = u.pathname.split('/');
    const bucketIndex = parts.indexOf('avatars');
    if (bucketIndex === -1) return null;
    const path = parts.slice(bucketIndex + 1).join('/');
    return path || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/upload-avatar
 *
 * Accepts a multipart/form-data request with:
 *   - file        : WebP blob (already resized to 256×256 by the client)
 *   - submissionId: (optional) UUID — used as the filename so re-uploads
 *                   overwrite the previous photo for the same caregiver.
 *                   Falls back to a timestamp when creating a new submission
 *                   whose ID is not yet known.
 *
 * Uploads to the public "avatars" Supabase Storage bucket using the
 * service-role key (INSERT is restricted to admin — no public INSERT policy).
 *
 * Returns:
 *   200  { url: string }   — public URL of the uploaded file
 *   400  { error: string } — missing file
 *   500  { error: string } — Supabase Storage error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const submissionId = (formData.get('submissionId') as string | null) ?? '';
  const fileName = submissionId ? `${submissionId}.webp` : `${Date.now()}.webp`;

  // Convert to Node.js Buffer — raw ArrayBuffer is not reliably handled by
  // the Supabase JS storage client in the Node.js runtime.
  const buffer = Buffer.from(await file.arrayBuffer());

  console.log(`[upload-avatar] file.size=${file.size} buffer.byteLength=${buffer.byteLength} fileName=${fileName}`);

  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: 'Received an empty file buffer — nothing to upload.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, buffer, {
      contentType: file.type || 'image/webp',
      upsert: true,
    });

  console.log(`[upload-avatar] upload result: data=${JSON.stringify(uploadData)} error=${JSON.stringify(uploadError)}`);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl: basePublicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(fileName);

  // Append a timestamp cache-buster so the browser and Supabase CDN never
  // serve a stale version when the same filename is reused (e.g. <id>.webp
  // is deleted then a new photo is uploaded under the same path).
  // extractStoragePath() uses URL.pathname so the ?t= suffix is ignored
  // there — delete operations still resolve to the correct storage path.
  const publicUrl = `${basePublicUrl}?t=${Date.now()}`;

  console.log(`[upload-avatar] publicUrl=${publicUrl}`);

  return NextResponse.json({ url: publicUrl });
}

/**
 * DELETE /api/upload-avatar
 *
 * Removes an avatar file from the "avatars" storage bucket.
 *
 * Body (JSON):
 *   { "url": "<full public URL of the file to delete>" }
 *
 * The path inside the bucket is extracted from the URL automatically.
 * Deletion failures are intentionally non-fatal (returns 200 with a
 * `warning` field) so that UI state is never blocked by a cleanup error.
 *
 * Returns:
 *   200  { deleted: true }            — file removed
 *   200  { deleted: false, warning }  — path could not be parsed (no-op)
 *   400  { error: string }            — missing url
 *   500  { error: string }            — Supabase Storage error
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: 'Missing url field' }, { status: 400 });
  }

  const path = extractStoragePath(body.url);
  if (!path) {
    // URL doesn't belong to this bucket — nothing to delete, treat as no-op.
    return NextResponse.json({
      deleted: false,
      warning: 'Could not parse a valid avatars bucket path from the provided URL.',
    });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from('avatars').remove([path]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
