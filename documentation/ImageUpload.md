# Image Upload & Storage

## Overview

ConvoFlow supports image sharing in standard chats. Users paste images from their clipboard into the chat input, which are staged as previews before being uploaded to Supabase S3-compatible storage. Images are stored as chat messages with `message_type: 'image'` and the S3 key in the `content` field. The API layer generates short-lived signed URLs on read so the S3 bucket remains private.

## Architecture

```
Clipboard Paste          ChatInput                  ChatView                Express API               Supabase S3
     │                      │                         │                        │                         │
     │  paste image         │                         │                        │                         │
     │ ──────────────────►  │                         │                        │                         │
     │                      │  store File + preview   │                        │                         │
     │                      │  show thumbnail above   │                        │                         │
     │                      │  textarea               │                        │                         │
     │                      │                         │                        │                         │
     │  click Send ────────►│  handleSend()           │                        │                         │
     │                      │ ──────────────────────► │                        │                         │
     │                      │                         │  sendImageWithText()   │                         │
     │                      │                         │ ──────────────────────►│  POST /:chatId/image    │
     │                      │                         │                        │ ──────────────────────► │
     │                      │                         │                        │  PutObjectCommand       │
     │                      │                         │                        │  ◄── S3 key ─────────── │
     │                      │                         │                        │                         │
     │                      │                         │                        │  signImageUrl(key)      │
     │                      │                         │                        │ ──────────────────────► │
     │                      │                         │                        │  ◄── signed URL ─────── │
     │                      │                         │                        │                         │
     │                      │                         │                        │  DB: store S3 key       │
     │                      │                         │                        │  broadcast: signed URL  │
     │                      │                         │  ◄── message:new ──────│                         │
     │                      │  ◄── clear preview ─────│                        │                         │
     │                      │                         │                        │                         │
     │  click image ────────│────────────────────────►│  open ImageModal       │                         │
     │  ◄── full-size ──────│─────────────────────────│                        │                         │
```

## Storage Layer

### S3 Client (`backend/src/supabase/supabaseS3Client.ts`)

Configures an `S3Client` pointing to Supabase's S3-compatible storage endpoint:

- **Region**: `SUPABASE_PROJECT_REGION` (default: `us-east-1`)
- **Endpoint**: `SUPABASE_S3_BUCKET_ENDPOINT`
- **Credentials**: `SUPABASE_S3_ACCESS_KEY_ID` / `SUPABASE_S3_SECRET_ACCESS_KEY`
- **`forcePathStyle: true`** — required for Supabase S3 compatibility

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_PROJECT_REGION` | AWS region (default `us-east-1`, actual `us-east-2`) |
| `SUPABASE_S3_BUCKET_ENDPOINT` | Full S3 endpoint URL |
| `SUPABASE_S3_ACCESS_KEY_ID` | S3 access key |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | S3 secret key |
| `SUPABASE_S3_BUCKET_NAME` | Bucket name (`images`) |
| `SUPABASE_STORAGE_BUCKET` | Fallback bucket name |
| `SUPA_BASE_URL` | Supabase project base URL |

### Upload Service (`backend/src/services/imageUpload.ts`)

**Supported types**: `image/png`, `image/jpeg`, `image/jpg`, `image/gif`, `image/webp`, `image/avif`

#### Key Functions

| Function | Purpose |
|----------|---------|
| `normalizeUploadBuffer(input)` | Validates MIME type, converts base64 or buffer to `{ buffer, contentType }` |
| `buildStorageObjectPath(userId, fileName, contentType)` | Generates S3 key: `{userId}/{timestamp}-{uuid}-{sanitizedFilename}{ext}` |
| `uploadImageToStorage(input)` | Uploads to S3 via `PutObjectCommand`, returns `{ url, path }` |
| `signImageUrl(key)` | Generates a presigned `GetObjectCommand` URL (1-hour expiry) |

#### S3 Key Format

```
{userId}/{timestamp}-{uuid}-{sanitizedFilename}.{extension}

Example:
a1b2c3d4-e5f6-7890-abcd-ef1234567890/1720000000000-a1b2c3d4-e5f6-photo.png
```

- Path segments: `{userId}/` prefix for isolation
- Filename is sanitized (special chars replaced with `-`)
- UUID appended to prevent collisions
- Original extension preserved from filename or inferred from content type

#### Signed URLs

- Generated via `@aws-sdk/s3-request-presigner` with `GetObjectCommand`
- Expiry: `SIGNED_URL_EXPIRES_IN = 3600` (1 hour)
- Generated at the API layer on every read — never stored in the database
- The S3 bucket stays **private** — no public access required

## Database Schema

### `StandardChatMessages` (relevant fields)

```prisma
model StandardChatMessages {
  id            String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  chat_id       String        @db.Uuid
  sender_id     String        @db.Uuid
  message_type  String        @default("text") @db.VarChar(15)  // "text" or "image"
  content       String                                    // S3 key for images, text for text messages
  created_at    DateTime      @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  // ... other fields
}
```

For image messages, `content` stores the **S3 key** (e.g., `userId/timestamp-uuid-filename.png`), not the full URL. The signed URL is generated at read time.

## Backend Routes

### `POST /api/chats/:chatId/image`

**Middleware**: `authenticate`, `upload.single('image')` (multer, 5MB limit, image-only filter)

**Flow**:
1. Validate user is a chat member via `requireChatMembership()`
2. Upload image buffer to S3 via `uploadImageToStorage()`
3. Create `StandardChatMessages` record with `message_type: 'image'` and `content: s3Key`
4. Update `StandardChats.updated_at`
5. Broadcast `message:new` to the chat room (includes `messageType` and the signed URL as `content`)
6. Return `{ success, message, url, path }`

**Request**:
```
POST /api/chats/:chatId/image
Content-Type: multipart/form-data
Cookie: <auth cookie>

 FormData field: image (File)
```

**Response**:
```json
{
  "success": true,
  "message": {
    "id": "...",
    "chatId": "...",
    "senderId": "...",
    "senderName": "...",
    "senderImage": "...",
    "content": "https://...supabase.co/storage/v1/object/sign/images/...",
    "messageType": "image",
    "createdAt": "..."
  },
  "url": "https://...supabase.co/storage/v1/object/sign/images/...",
  "path": "userId/timestamp-uuid-filename.png"
}
```

### `GET /api/chats/:chatId/messages`

**Flow**:
1. Validate membership
2. Fetch messages from DB (paginated, 20 per page)
3. For each message with `message_type === 'image'`, replace the stored S3 key in `content` with a fresh signed URL via `signImageUrl()`
4. Return messages with signed URLs

**Key detail**: The DB stores S3 keys, but the API response always contains signed URLs. The client never sees raw S3 keys.

## Frontend

### Image Paste & Preview (`src/components/ChatInput.tsx`)

**State**:
| State | Type | Purpose |
|-------|------|---------|
| `pendingImage` | `File \| null` | The staged image file |
| `pendingImagePreview` | `string \| null` | Object URL for thumbnail preview |
| `sending` | `boolean` | True while upload is in progress |

**Flow**:
1. User pastes image via clipboard (`handlePaste`)
2. Image is stored in `pendingImage` state, object URL created for preview
3. Thumbnail (96x96) appears above the input bar with an X button to remove
4. Placeholder changes to "Add a caption..."
5. User optionally types a caption
6. User presses Enter or clicks Send
7. `handleSend()` calls `onSendWithImage(file, text)` — send button is disabled during upload (`sending` state)
8. After upload completes, preview is cleared and input resets

**Behavior**:
- Pasting a new image replaces any existing pending image
- Escape key removes the pending image
- Paste is blocked while `sending` is true (prevents stacking)
- Object URLs are revoked on remove and on component unmount
- `canSend` requires: (`hasContent` OR `pendingImage`) AND NOT `disabled` AND NOT `sending`

### Upload Handler (`src/pages/ChatView.tsx`)

**`sendImage(file: File)`**:
- POSTs `FormData` with the image to `/api/chats/:chatId/image`
- The image message appears via WebSocket broadcast (no optimistic update)

**`sendImageWithText(file: File, text: string)`**:
- Calls `sendImage(file)` first (awaits completion)
- If text is provided, sends it as a separate text message via WebSocket or REST fallback
- Text message gets optimistic UI with a `temp-` prefixed ID

### Message Rendering (`src/components/MessageList.tsx`)

Images are rendered when either condition is true:
```tsx
isImageUrl(msg.content) || msg.messageType === 'image'
```

**`isImageUrl(value)`** — checks if the string is a valid URL ending with a known image extension (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif`, `.svg`, `.bmp`).

**Image element**:
```tsx
<img
  src={msg.content}           // signed URL from API
  alt="Uploaded image"
  onClick={() => onImageClick?.(msg.content)}
  className="max-h-75 w-full rounded-2xl object-contain border border-zinc-700 bg-zinc-950 cursor-pointer hover:opacity-90 transition-opacity"
/>
```

### Image Modal (`src/modals/ImageModal.tsx`)

- MUI `Dialog` with transparent background
- Shows full-size image (max `90vh` height)
- Close button (X) in top-right corner
- Closes on backdrop click or Escape key
- Triggered by clicking any image in `MessageList`

### Message Query (`src/hooks/useChatMessagesQuery.ts`)

Maps `message_type` from the backend to `messageType` in the `ChatMessages` type. This ensures image messages loaded from the initial query (not just WebSocket) render correctly as images.

```typescript
messageType: m.message_type,  // "text" or "image"
```

## Security Model

```
Paste image → stage in memory (no network)
Click Send  → auth check (cookie) → membership check → S3 upload → store key in DB
Read messages → auth check → membership check → sign keys → return signed URLs
```

- **S3 keys never reach the client** — only signed URLs are returned
- **Signed URLs expire** after 1 hour
- **Bucket stays private** — no public access policy needed
- **Membership enforced** — `requireChatMembership()` checked on upload and read
- **File size limited** — multer rejects files over 5MB
- **Type restricted** — multer filter accepts only `image/*` MIME types

## WebSocket Broadcast

When an image is uploaded, the `message:new` broadcast includes:

```json
{
  "type": "message:new",
  "payload": {
    "id": "...",
    "chatId": "...",
    "senderId": "...",
    "senderName": "...",
    "senderImage": "...",
    "content": "https://...signed-url...",
    "createdAt": "...",
    "messageType": "image"
  }
}
```

The `content` field contains the **signed URL** (not the S3 key), so recipients can display the image immediately without an additional API call.

## Key Files

| File | Role |
|------|------|
| `backend/src/supabase/supabaseS3Client.ts` | S3Client configuration for Supabase |
| `backend/src/services/imageUpload.ts` | Upload service, signed URL generation, path building |
| `backend/src/chat/chat.ts` | Upload route (`POST /:chatId/image`), message fetch with signing (`GET /:chatId/messages`) |
| `src/components/ChatInput.tsx` | Image paste detection, preview thumbnail, send blocking |
| `src/pages/ChatView.tsx` | `sendImage()` and `sendImageWithText()` handlers |
| `src/components/MessageList.tsx` | Image rendering with `isImageUrl()` check, click handler |
| `src/modals/ImageModal.tsx` | Full-size image viewer (MUI Dialog) |
| `src/hooks/useChatMessagesQuery.ts` | Message query with `messageType` mapping |
| `src/context/WebSocketContext.tsx` | Handles `message:new` with `messageType` field |

## Known Limitations

- **No file picker** — images can only be uploaded via clipboard paste (the Paperclip button is a visual placeholder)
- **Single image at a time** — pasting a new image replaces the pending one
- **No image optimization** — images are uploaded at original resolution
- **No delete from S3** — deleting a message removes the DB record but the S3 object persists
- **Signed URL expiry** — if a user keeps a chat open for >1 hour, older images may need a page refresh to display
- **No drag-and-drop** — only clipboard paste is supported
