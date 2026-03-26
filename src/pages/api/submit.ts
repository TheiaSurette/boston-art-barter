import type { APIRoute } from "astro";
import { Readable } from "node:stream";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES } from "../../lib/validation";
import { normalizeInstagram, safeName } from "../../lib/utils";

// Lazy-load googleapis to avoid cold start failures in serverless
async function getGoogleApis() {
  const { google } = await import("googleapis");
  return google;
}

export const prerender = false;

interface ParsedPiece {
  title: string;
  medium: string;
  type: string;
  tradingFor: string;
  image: File | null;
}

interface PieceData {
  title: string;
  medium: string;
  type: string;
  tradingFor: string;
  imageFileName?: string;
}

interface SubmissionData {
  name: string;
  email: string;
  pronouns: string;
  instagram: string;
  website: string;
  bio: string;
  groupChat: string;
  artistPhotoFileName?: string;
  pieces: PieceData[];
  timestamp: string;
}

function getString(formData: FormData, key: string): string {
  const val = formData.get(key);
  if (val === null || val instanceof File) return "";
  return val.toString().trim();
}

function isGoogleConfigured(): boolean {
  return !!(
    import.meta.env.GOOGLE_CLIENT_ID &&
    import.meta.env.GOOGLE_CLIENT_SECRET &&
    import.meta.env.GOOGLE_REFRESH_TOKEN &&
    import.meta.env.GOOGLE_DRIVE_FOLDER_ID &&
    import.meta.env.GOOGLE_SHEET_ID
  );
}

async function getGoogleAuth() {
  const google = await getGoogleApis();
  const clientId = import.meta.env.GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = import.meta.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth2 credentials are not set");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return { auth: oauth2, google };
}

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return `Invalid image type. Allowed: JPEG, PNG, WebP, GIF.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Image exceeds 4 MB limit.`;
  }
  return null;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonSuccess(): Response {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    const name = getString(formData, "name");
    const email = getString(formData, "email");
    const pronouns = getString(formData, "pronouns");
    const instagram = getString(formData, "instagram");
    const website = getString(formData, "website");
    const bio = getString(formData, "bio");
    const groupChat = getString(formData, "groupChat");
    const pieceCount = parseInt(getString(formData, "pieceCount") || "0", 10);

    // Validate required fields
    if (!name) return jsonError("Name is required.", 400);
    if (!email) return jsonError("Email is required.", 400);
    if (!instagram) return jsonError("Instagram handle is required.", 400);

    // Get artist photo (optional)
    const artistPhotoFile = formData.get("artistPhoto");
    let validArtistPhoto: File | null = null;
    if (artistPhotoFile instanceof File && artistPhotoFile.size > 0) {
      const err = validateImageFile(artistPhotoFile);
      if (err) return jsonError(`Artist photo: ${err}`, 400);
      validArtistPhoto = artistPhotoFile;
    }

    // Parse pieces
    const pieces: ParsedPiece[] = [];
    for (let i = 0; i < pieceCount; i++) {
      const title = getString(formData, `piece_${i}_title`);
      const medium = getString(formData, `piece_${i}_medium`);
      const type = getString(formData, `piece_${i}_type`);
      const tradingFor = getString(formData, `piece_${i}_tradingFor`);
      const pieceImageFile = formData.get(`piece_${i}_image`);

      if (!title) return jsonError(`Piece ${i + 1}: Title is required.`, 400);
      if (!medium) return jsonError(`Piece ${i + 1}: Medium & dimensions is required.`, 400);

      if (!(pieceImageFile instanceof File) || pieceImageFile.size === 0) {
        return jsonError(`Piece ${i + 1}: An image is required.`, 400);
      }
      const err = validateImageFile(pieceImageFile);
      if (err) return jsonError(`Piece ${i + 1}: ${err}`, 400);

      pieces.push({ title, medium, type, tradingFor, image: pieceImageFile });
    }

    const timestamp = new Date().toISOString();
    const safe = safeName(name);

    const submissionData: SubmissionData = {
      name,
      email,
      pronouns,
      instagram: normalizeInstagram(instagram),
      website,
      bio,
      groupChat,
      pieces: [],
      timestamp,
    };

    if (!isGoogleConfigured()) {
      return handleLocalSubmission(submissionData, validArtistPhoto, pieces, safe);
    }

    return handleGoogleSubmission(submissionData, validArtistPhoto, pieces, safe);
  } catch (err) {
    console.error("Submit error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return jsonError(message, 500);
  }
};

async function handleLocalSubmission(
  data: SubmissionData,
  artistPhoto: File | null,
  pieces: ParsedPiece[],
  safe: string,
): Promise<Response> {
  const uploadsDir = join(process.cwd(), ".submissions");
  await mkdir(uploadsDir, { recursive: true });

  // Save artist photo
  if (artistPhoto) {
    const ext = artistPhoto.name.split(".").pop() ?? "jpg";
    const fileName = `${safe}_photo_${Date.now()}.${ext}`;
    const filePath = join(uploadsDir, fileName);
    const buffer = Buffer.from(await artistPhoto.arrayBuffer());
    await writeFile(filePath, buffer);
    data.artistPhotoFileName = fileName;
  }

  // Save piece images and build piece data
  const pieceData: PieceData[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    let imageFileName: string | undefined;

    if (piece.image) {
      const ext = piece.image.name.split(".").pop() ?? "jpg";
      const fileName = `${safe}_piece${i}_${Date.now()}.${ext}`;
      const filePath = join(uploadsDir, fileName);
      const buffer = Buffer.from(await piece.image.arrayBuffer());
      await writeFile(filePath, buffer);
      imageFileName = fileName;
    }

    pieceData.push({
      title: piece.title,
      medium: piece.medium,
      type: piece.type,
      tradingFor: piece.tradingFor,
      imageFileName,
    });
  }

  data.pieces = pieceData;

  const jsonPath = join(uploadsDir, `${safe}_${Date.now()}.json`);
  await writeFile(jsonPath, JSON.stringify(data, null, 2));

  console.log("[LOCAL] Submission saved:", data);

  return jsonSuccess();
}

async function handleGoogleSubmission(
  data: SubmissionData,
  artistPhoto: File | null,
  pieces: ParsedPiece[],
  safe: string,
): Promise<Response> {
  const { auth, google } = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  const folderId = import.meta.env.GOOGLE_DRIVE_FOLDER_ID;
  const sheetId = import.meta.env.GOOGLE_SHEET_ID;

  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

  // Upload artist photo
  let artistPhotoId = "";
  if (artistPhoto) {
    artistPhotoId = await uploadFileToDrive(drive, artistPhoto, safe, "photo", folderId);
  }

  // Upload piece images and build piece data
  const pieceData: { title: string; medium: string; type: string; tradingFor: string; imageId: string }[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    let imageId = "";
    if (piece.image) {
      imageId = await uploadFileToDrive(drive, piece.image, safe, `piece${i}`, folderId);
    }
    pieceData.push({
      title: piece.title,
      medium: piece.medium,
      type: piece.type,
      tradingFor: piece.tradingFor,
      imageId,
    });
  }

  // Participants sheet — one row per person
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Participants!A:I",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          data.name,
          data.email,
          data.pronouns,
          data.instagram,
          data.website,
          data.bio,
          data.groupChat,
          artistPhotoId ? `https://drive.google.com/file/d/${artistPhotoId}/view` : "",
          data.timestamp,
        ],
      ],
    },
  });

  // Pieces sheet — one row per piece, linked by name + email for filtering
  if (pieceData.length > 0) {
    const pieceRows = pieceData.map((p, i) => [
      data.name,
      data.email,
      i + 1,
      p.title,
      p.medium,
      p.type,
      p.tradingFor,
      p.imageId ? `https://drive.google.com/file/d/${p.imageId}/view` : "",
      data.timestamp,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Pieces!A:I",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: pieceRows,
      },
    });
  }

  return jsonSuccess();
}

async function uploadFileToDrive(
  drive: ReturnType<Awaited<ReturnType<typeof getGoogleApis>>["drive"]>,
  file: File,
  safe: string,
  label: string,
  folderId: string,
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const stream = Readable.from(buffer);
  const ext = file.name.split(".").pop() ?? "jpg";
  const safeFileName = `${safe}_${label}_${Date.now()}.${ext}`;

  const driveResponse = await drive.files.create({
    requestBody: {
      name: safeFileName,
      parents: [folderId],
    },
    media: {
      mimeType: file.type,
      body: stream,
    },
    fields: "id",
  });

  const fileId = driveResponse.data.id;
  if (!fileId) throw new Error("Drive upload returned no file ID");

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return fileId;
}
