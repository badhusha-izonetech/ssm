# Backend requirements — Site Visit / Equipment / Return Movement

No backend source is present in this repository or build context (only the
Expo/React Native client). The existing backend only exposes, under
`/field-movements`:

- `GET /field-movements/mine`
- `POST /field-movements/start`
- `POST /field-movements/{id}/stop`
- `PATCH /field-movements/{id}` — `{ current_location?, status?, destination? }`
- `POST /field-movements/{id}/location`
- `POST /field-movements/{id}/photo` — multipart, one file

Per the "do not invent API endpoints" / "do not use AsyncStorage as a
permanent replacement for backend persistence" instructions, everything
below is implemented **client-side as a local sync outbox** (see
`src/siteVisit/localSiteVisitStore.ts`) — clearly labeled "Pending sync" in
the UI — rather than pretending it's already integrated. Photos/selfies/
video/documents *do* reach the backend today, reusing the one existing
upload endpoint. Everything else (notes, measurements list, equipment
records, work-stage, return-movement intent) stays device-local until the
endpoints below exist, and will not be visible to the CEO web app until then.

This file is the exact contract the backend team needs to implement to
retire the local outbox.

## 1. Site Notes
`PATCH /field-movements/{id}/notes`
```json
{ "notes": "string, up to ~2000 chars" }
```
Response: `{ "notes": "...", "notes_saved_at": "2026-08-28T10:00:00Z" }`

## 2. Measurements (evidence images, not numeric values)
`POST /field-movements/{id}/measurements` (multipart)
```
file: <image>
category: "Length" | "Width" | "Height" | "Other"
```
`GET /field-movements/{id}/measurements` → array of
`{ id, category, url, taken_at }`

Numeric measurement values are NOT collected anywhere in this client per
spec ("do not invent numeric measurement values unless the existing
backend already supports them") — only category + evidence photo.

## 3. Documents
`POST /field-movements/{id}/documents` (multipart)
```
file: <pdf|doc|docx|jpg|png>
```
`GET /field-movements/{id}/documents` → array of
`{ id, name, size, mime_type, url, added_at }`
`DELETE /field-movements/{id}/documents/{document_id}`

## 4. Equipment custody (Before/After work)
`POST /field-movements/{id}/equipment` (or a standalone
`/equipment-custody` resource if custody can start before a field movement
exists — see note below)
```json
{
  "stage": "before" | "after",
  "photo_url": "string | null",
  "items": [{ "name": "string", "quantity": "string", "condition": "string" }],
  "remarks": "string",
  "confirmed_at": "ISO8601 | null"
}
```
**Note:** the Field Technician flow (spec: "Material/Tool Check" →
"Before-Work Equipment Confirmation" → *then* Start Tracking) records
equipment custody *before* a field movement exists. The client currently
holds this in the local outbox under a temporary local session id and
associates it with the real `field_movement.id` the moment tracking starts
(`src/siteVisit/localSiteVisitStore.ts` → `linkPendingEquipmentToFieldMovement`).
The backend contract should support either (a) a standalone equipment
resource keyed by employee + date that a field movement can later
reference, or (b) accepting equipment payloads on `POST
/field-movements/start` itself. Whichever shape is chosen, the "started
before a field movement exists" case must be handled — a technician can
check out tools and then get pulled onto a different job.

## 5. Work-stage (Field Technician)
Add a `work_stage` field to the field movement record so the CEO web app
can see technician progress, not just GPS status:
```
work_stage: "equipment_ready" | "travelling" | "arrived" | "site_verified"
          | "ready_to_start" | "in_progress" | "work_completed"
          | "returning" | "completed"
```
`PATCH /field-movements/{id}` extended to accept `work_stage`.
Today this is tracked purely client-side (not sent anywhere) since there is
nowhere to send it.

## 6. Return movement
The spec requires "Return Home" without asking for a destination, while
preserving start location / GPS route / arrival location / timestamps /
distance / return status / completion status.

This client reuses the **existing** endpoints for the return leg rather
than inventing new ones:
- On "Start Returning": `PATCH /field-movements/{id}` with
  `{ "status": "Returning" }` (the enum already has this value), then
  `trackingManager.start(id, ...)` resumes GPS collection on the *same*
  field movement id.
- On arrival: `POST /field-movements/{id}/stop` (existing endpoint) closes
  it out as `Checked Out`.

This means the return leg's GPS points land in the *same* location stream
as the outbound leg. If the backend/CEO web app needs to distinguish
outbound vs. return route segments, it should key off the timestamp when
`status` flipped to `Returning` (available via the field movement's status
history, if one exists, or by adding a `returning_since` timestamp field to
the model) rather than requiring a second field movement id.

## 7. Site evidence available to Field Technician
The Field Technician flow requires viewing Site Visit evidence (photos,
video, measurements, documents, notes) gathered by an earlier Site Visit
employee on the *same* job, without recreating it. This requires:
- A way to look up the relevant field movement(s)/evidence for a shared
  job/site (currently `GET /field-movements/mine` only returns the
  authenticated employee's own movements — there's no site/job id linking
  different employees' visits to the same location).
- `GET /field-movements/{id}/evidence` (or equivalent) returning the
  aggregated photo/video/measurement/document/note URLs for a movement,
  regardless of which employee created them.

Until a job/site identifier exists to link technician and site-visit
employee records together, this client's "Review Site Evidence" screen can
only show evidence attached to the *technician's own* current field
movement — it cannot pull in a different employee's earlier Site Visit
records. This is flagged directly in that screen's empty state.
