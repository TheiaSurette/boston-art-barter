import type { APIRoute } from "astro";
import { google } from "googleapis";
import { Readable } from "node:stream";

export const prerender = false;

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function getGoogleAuth(): InstanceType<typeof google.auth.GoogleAuth> {
  const raw = import.meta.env.GOOGLE_CREDENTIALS;
  if (!raw) throw new Error("GOOGLE_CREDENTIALS is not set");

  const credentials: {
    client_email: string;
    private_key: string;
    project_id: string;
  } = JSON.parse(raw);

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    const name = formData.get("name");
    const bio = formData.get("bio");
    const imageFile = formData.get("image");
    const website = formData.get("website") ?? "";
    const twitter = formData.get("twitter") ?? "";
    const instagram = formData.get("instagram") ?? "";

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return jsonError("Name is required.", 400);
    }
    if (!bio || typeof bio !== "string" || !bio.trim()) {
      return jsonError("Bio is required.", 400);
    }
    if (!imageFile || !(imageFile instanceof File) || imageFile.size === 0) {
      return jsonError("Image is required.", 400);
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(imageFile.type)) {
      return jsonError(
        "Invalid image type. Allowed: JPEG, PNG, WebP, GIF.",
        400,
      );
    }

    // Validate file size
    if (imageFile.size > MAX_FILE_SIZE) {
      return jsonError("Image must be under 4 MB.", 400);
    }

    // Authenticate with Google
    const auth = getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const sheets = google.sheets({ version: "v4", auth });

    const folderId = import.meta.env.GOOGLE_DRIVE_FOLDER_ID;
    const sheetId = import.meta.env.GOOGLE_SHEET_ID;

    if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

    // Upload image to Google Drive
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const stream = Readable.from(buffer);

    const ext = imageFile.name.split(".").pop() ?? "jpg";
    const safeFileName = `${name.toString().trim().replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.${ext}`;

    const driveResponse = await drive.files.create({
      requestBody: {
        name: safeFileName,
        parents: [folderId],
      },
      media: {
        mimeType: imageFile.type,
        body: stream,
      },
      fields: "id",
    });

    const fileId = driveResponse.data.id;
    if (!fileId) throw new Error("Drive upload returned no file ID");

    // Set public read permission so image is accessible
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // Append row to Google Sheet
    const timestamp = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A:G",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            name.toString().trim(),
            bio.toString().trim(),
            fileId,
            website.toString().trim(),
            twitter.toString().trim(),
            instagram.toString().trim(),
            timestamp,
          ],
        ],
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Submit error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return jsonError(message, 500);
  }
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
