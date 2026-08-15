# Clinic Assistant — API Reference

> **Base URL:** `/api/v1`  
> **Format:** All requests and responses are JSON unless noted.  
> **Version:** v1 (stable)  
> **Versioning policy:** See [Versioning & Deprecation](#versioning--deprecation-policy)

---

## Table of Contents

- [Authentication](#authentication)
- [Roles & Permissions](#roles--permissions)
- [Response Format](#response-format)
- [Patients](#patients)
- [Appointments](#appointments)
- [Treatments](#treatments)
- [Check-ins (Recovery)](#check-ins-recovery)
- [AI Endpoints](#ai-endpoints)
- [Intake (WhatsApp)](#intake-whatsapp)
- [Doctors](#doctors)
- [Receptionists](#receptionists)
- [Products & Consent](#products--consent)
- [Clinical Notes & Documents](#clinical-notes--documents)
- [Complications](#complications)
- [Photos](#photos)
- [Notifications](#notifications)
- [Webhooks](#webhooks)
- [Monitoring](#monitoring)
- [Patient Portal](#patient-portal)
- [Clinics (SuperAdmin)](#clinics-superadmin)
- [Analytics](#analytics)
- [Versioning & Deprecation Policy](#versioning--deprecation-policy)
- [Changelog](#changelog)

---

## Authentication

Two auth mechanisms exist — one for staff, one for patients.

### Staff Authentication (NextAuth session cookie)

All `/api/v1/*` staff endpoints require a valid NextAuth session.

```
1. GET  /api/auth/csrf              → obtain CSRF token
2. POST /api/auth/callback/credentials
   Body: { "email": "...", "password": "...", "csrfToken": "..." }
   → sets next-auth.session-token cookie
3. Include session cookie on all subsequent requests
```

### Patient Authentication (custom JWT cookie)

Patient portal endpoints use a separate `patient-session` JWT cookie, **not** NextAuth.

```
1. POST /api/v1/patient/auth
   Body: { "email": "...", "password": "..." }
   → sets patient-session cookie (HttpOnly, SameSite=Strict)
2. Include patient-session cookie on /api/v1/patient/* requests
3. POST /api/v1/patient/auth/logout  → clears cookie
```

> Patient endpoints **reject** NextAuth sessions. Staff endpoints **reject** patient-session cookies.

---

## Roles & Permissions

| Role | Description |
|------|-------------|
| `SUPERADMIN` | System-wide access. Manages all clinics. No clinic scoping. |
| `ADMIN` | Clinic admin. Full access within their own clinic. |
| `DOCTOR` | Clinical staff. Read/write clinical data within their clinic. |
| `RECEPTIONIST` | Front-desk staff. Appointments, patients (limited). |
| `PATIENT` | Portal access only via patient-session cookie. |

All non-SUPERADMIN roles are **clinic-scoped** — every query is automatically filtered to the caller's `clinicId`. A user from Clinic A cannot read or modify Clinic B's data.

---

## Response Format

### Success

HTTP `200 OK` or `201 Created` with a JSON body.

### Error

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| `200` | OK |
| `201` | Created |
| `400` | Bad request / validation error |
| `401` | Unauthenticated |
| `403` | Authenticated but insufficient role |
| `404` | Resource not found (or cross-clinic access denied) |
| `500` | Internal server error |

> Cross-clinic access returns `404`, not `403`, to avoid information leakage.

---

## Patients

### `GET /api/v1/patients`

List active patients in the caller's clinic.

**Roles:** `ADMIN`, `DOCTOR`, `RECEPTIONIST`

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Filter by name, email, or phone |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 50, max: 100) |

**Response:**
```json
[
  {
    "id": "clx...",
    "firstName": "Alice",
    "lastName": "Smith",
    "email": "alice@example.com",
    "phone": "+1-555-0101",
    "dateOfBirth": "1985-03-15T00:00:00Z",
    "gender": "FEMALE",
    "clinicId": "clx...",
    "consentGiven": true,
    "treatments": [...],
    "_count": { "treatments": 2, "checkIns": 5, "appointments": 3 },
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

---

### `POST /api/v1/patients`

Create a new patient record.

**Roles:** `DOCTOR`, `RECEPTIONIST`

**Request body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "+1234567891",
  "dateOfBirth": "1985-06-20",
  "gender": "FEMALE",
  "address": "123 Main St",
  "medicalHistory": "No significant history",
  "allergies": "Penicillin",
  "initialPassword": "secure123"
}
```

**Response:** `201 Created` — patient object.

---

### `GET /api/v1/patients/[id]`

Get full patient detail.

**Roles:** `ADMIN`, `DOCTOR`, `RECEPTIONIST`

> Returns `404` if patient belongs to a different clinic.

---

### `PATCH /api/v1/patients/[id]`

Update patient record.

**Roles:** `ADMIN`, `DOCTOR`, `RECEPTIONIST`

**Allowed fields:** `firstName`, `lastName`, `email`, `phone`, `dateOfBirth`, `gender`, `address`, `medicalHistory`, `allergies`, `medications`, `emergencyContact`

---

### `DELETE /api/v1/patients/[id]`

Soft-delete (sets `isActive: false`).

**Roles:** `ADMIN`

---

## Appointments

### `GET /api/v1/appointments`

**Roles:** `ADMIN`, `DOCTOR`, `RECEPTIONIST`

**Query params:** `patientId`, `status`, `date`

---

### `POST /api/v1/appointments`

**Roles:** `ADMIN`, `RECEPTIONIST`

**Request body:**
```json
{
  "patientId": "clx...",
  "doctorId": "clx...",
  "appointmentDate": "2025-06-20T14:00:00Z",
  "duration": 30,
  "type": "CONSULTATION",
  "notes": "First visit"
}
```

---

### `PATCH /api/v1/appointments/[id]`

Update status or notes.

**Allowed fields:** `status`, `notes`, `appointmentDate`, `duration`

---

### `DELETE /api/v1/appointments/[id]`

Cancel appointment.

---

## Treatments

### `GET /api/v1/treatments`

**Roles:** `ADMIN`, `DOCTOR`, `RECEPTIONIST`

**Query params:** `patientId`, `doctorId`, `type`

---

### `POST /api/v1/treatments`

**Roles:** `DOCTOR`

**Request body:**
```json
{
  "patientId": "clx...",
  "doctorId": "clx...",
  "type": "BOTOX",
  "productName": "Botox 100u",
  "units": 20,
  "injectionAreas": ["Forehead", "Glabella"],
  "treatmentDate": "2025-06-10T09:00:00Z",
  "notes": "Standard forehead treatment",
  "aftercareNotes": "Avoid lying down for 4 hours"
}
```

---

## Check-ins (Recovery)

### `GET /api/v1/checkins`

**Roles:** `ADMIN`, `DOCTOR`

**Query params:** `patientId`, `status`, `riskLevel`

---

### `POST /api/v1/checkins`

Manually create a check-in record.

---

### `POST /api/v1/checkins/trigger`

Trigger check-in creation for all active treatments.

**Roles:** `ADMIN`

---

### `GET /api/v1/patient/checkin/pending`

Get pending check-ins for the authenticated patient.

**Auth:** `patient-session` cookie

---

### `POST /api/v1/patient/checkin`

Submit a check-in response.

**Auth:** `patient-session` cookie

**Request body:**
```json
{
  "checkInId": "clx...",
  "patientMessage": "Feeling much better today",
  "symptoms": ["mild_swelling"]
}
```

---

### `POST /api/v1/patient/checkin/upload`

Upload a recovery photo and trigger AI analysis.

**Auth:** `patient-session` cookie

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | binary | JPEG/PNG image |
| `checkInId` | string | ID of the check-in |

**Response:**
```json
{
  "riskLevel": "GREEN",
  "clinicalSummary": "Normal recovery...",
  "recommendations": [...],
  "confidenceScore": 0.87
}
```

---

## AI Endpoints

### `POST /api/v1/ai/analyze`

Analyze a check-in photo.

**Roles:** `ADMIN`, `DOCTOR`

---

### `POST /api/v1/ai/patient-summary`

Generate an AI-powered patient summary.

**Roles:** `ADMIN`, `DOCTOR`

**Request body:** `{ "patientId": "clx..." }`

---

### `POST /api/v1/ai/soap-notes`

Generate SOAP notes for a treatment/check-in.

**Roles:** `DOCTOR`

---

### `POST /api/v1/ai/suggest-slots`

Suggest follow-up appointment slots.

**Roles:** `ADMIN`, `DOCTOR`

---

## Intake (WhatsApp)

### `GET /api/v1/intake`

**Roles:** `ADMIN`, `RECEPTIONIST`

**Query params:** `status` — `pending | approved | rejected`

---

### `POST /api/v1/intake/[id]/approve`

Approve a WhatsApp intake, optionally creating a patient record.

**Roles:** `ADMIN`, `RECEPTIONIST`

---

### `POST /api/v1/intake/[id]/reject`

**Request body:** `{ "reason": "Incomplete information" }`

---

## Doctors

### `GET /api/v1/doctors`

**Roles:** `ADMIN`

---

### `POST /api/v1/doctors`

**Roles:** `ADMIN`

**Request body:**
```json
{
  "userId": "clx...",
  "specialty": "Aesthetic Medicine",
  "licenseNo": "MD-12345"
}
```

---

## Receptionists

### `GET /api/v1/receptionists`

**Roles:** `ADMIN`

---

### `POST /api/v1/receptionists`

**Roles:** `ADMIN`

---

## Products & Consent

### `GET /api/v1/products`

**Roles:** `ADMIN`, `DOCTOR`

---

### `POST /api/v1/products`

**Roles:** `ADMIN`

---

### `GET /api/v1/consent`

**Roles:** `ADMIN`, `DOCTOR`

---

### `POST /api/v1/consent`

**Roles:** `ADMIN`, `DOCTOR`

---

## Clinical Notes & Documents

### `GET /api/v1/clinical-notes`

**Roles:** `ADMIN`, `DOCTOR`

---

### `POST /api/v1/clinical-notes`

**Roles:** `DOCTOR`

---

### `DELETE /api/v1/clinical-notes/[id]`

**Roles:** `DOCTOR` (own notes only), `ADMIN`

---

## Complications

### `GET /api/v1/complications`

**Roles:** `ADMIN`, `DOCTOR`

---

### `POST /api/v1/complications`

**Roles:** `DOCTOR`

---

### `PATCH /api/v1/complications/[id]`

**Roles:** `DOCTOR`, `ADMIN`

---

## Photos

### `GET /api/v1/photos`

**Roles:** `ADMIN`, `DOCTOR`

---

### `POST /api/v1/photos`

Upload a photo (staff-side).

**Roles:** `DOCTOR`

---

## Notifications

### `GET /api/v1/notifications`

**Roles:** All staff

---

### `PATCH /api/v1/notifications`

Mark as read.

**Request body:** `{ "ids": ["clx..."] }`

---

## Webhooks

### `GET /api/v1/webhooks/whatsapp`

WhatsApp webhook verification.

**Query params:** `hub.mode`, `hub.verify_token`, `hub.challenge`

---

### `POST /api/v1/webhooks/whatsapp`

Receive incoming WhatsApp messages.

**Headers required:** `X-Hub-Signature-256` (HMAC-SHA256 of request body using `WHATSAPP_APP_SECRET`)

> Requests with invalid signatures are rejected with `403`.

---

## Monitoring

All monitoring endpoints are clinic-scoped:
- `ADMIN` sees only their own clinic's error logs
- `SUPERADMIN` sees all clinics

### `GET /api/v1/monitoring/stats`

**Roles:** `ADMIN`, `SUPERADMIN`

**Response:**
```json
{
  "summary": {
    "totalErrors": 42,
    "errors24h": 3,
    "unresolvedCount": 5,
    "recentCritical": 0,
    "whatsappErrors24h": 1,
    "scope": "clinic"
  },
  "errorsByLevel": { "ERROR": 10, "WARN": 32 },
  "errorsByCategory": { "cron_job": 5, "api_route": 15 },
  "errorsBySource": { "CRON": 5, "API": 37 },
  "cronHealth": { "recentErrors": 0, "lastError": null }
}
```

---

### `GET /api/v1/monitoring/errors`

**Roles:** `ADMIN`, `SUPERADMIN`

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Default: 1 |
| `limit` | number | Default: 50, max: 100 |
| `level` | string | `INFO \| WARN \| ERROR \| CRITICAL` |
| `category` | string | `cron_job \| api_route \| ai_analysis \| whatsapp_webhook \| ...` |
| `source` | string | `API \| CRON \| WEBHOOK \| AUTH` |
| `resolved` | boolean | `true \| false` |
| `search` | string | Search message or endpoint |

---

### `PATCH /api/v1/monitoring/errors`

Mark an error as resolved.

**Request body:** `{ "id": "clx...", "resolved": true }`

---

## Patient Portal

### `POST /api/v1/patient/auth`

Patient login.

**Request body:** `{ "email": "patient@example.com", "password": "secret" }`

**Response:** Sets `patient-session` cookie.

---

### `GET /api/v1/patient/data`

Get the authenticated patient's own profile, treatments, and check-ins.

**Auth:** `patient-session` cookie

---

### `GET /api/v1/patient/appointments`

**Auth:** `patient-session` cookie

---

## Clinics (SuperAdmin)

### `GET /api/v1/clinics`

**Roles:** `SUPERADMIN`, `ADMIN`

---

### `POST /api/v1/clinics`

**Roles:** `SUPERADMIN`

**Request body:**
```json
{
  "name": "Glow Aesthetics",
  "address": "456 Oak Ave",
  "phone": "+1987654321",
  "email": "info@glow.com",
  "timezone": "America/New_York"
}
```

---

### `PATCH /api/v1/clinics/[id]`

**Roles:** `SUPERADMIN`

---

### `GET /api/v1/clinics/[id]/admin`

Get the admin assigned to a clinic.

**Roles:** `SUPERADMIN`

---

### `POST /api/v1/clinics/[id]/admin`

Assign a new admin to a clinic. Only one admin allowed per clinic.

**Roles:** `SUPERADMIN`

**Request body:**
```json
{
  "name": "Admin Name",
  "email": "admin@clinic.com",
  "password": "securePassword"
}
```

> Returns `400` if a clinic already has an assigned admin.

---

### `DELETE /api/v1/clinics/[id]/admin`

Remove the assigned admin from a clinic.

**Roles:** `SUPERADMIN`

**Request body:** `{ "adminId": "clx..." }`

---

## Analytics

### `GET /api/v1/analytics`

**Roles:** `ADMIN`, `SUPERADMIN`

Returns clinic-level statistics: patient counts, treatment types, check-in completion rates, risk distribution.

---

## Versioning & Deprecation Policy

### Current version: v1

All routes under `/api/v1/*` are the **stable public API**. The unversioned `/api/*` routes are internal implementation routes — do not depend on them in integrations.

### Guarantees for v1

- Response shapes will not have fields removed without a deprecation notice
- New optional fields may be added to responses without a version bump
- Breaking changes (removed fields, changed types, new required body fields) will result in a new major version (`/api/v2`)

### Deprecation process

1. A deprecation notice is added to this document with a target removal date
2. A `Deprecation` header is added to responses from deprecated endpoints
3. A minimum 90-day window is given before removal
4. Breaking changes are listed in [CHANGELOG.md](./CHANGELOG.md)

### Current deprecations

_None._

---
