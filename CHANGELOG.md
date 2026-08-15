# Changelog

All notable API changes are documented here.

Format: [Semantic Versioning](https://semver.org) — `MAJOR.MINOR.PATCH`

> **Breaking changes** increment MAJOR and require a new `/api/vN` prefix.  
> **New features** (backwards-compatible) increment MINOR.  
> **Bug fixes** increment PATCH.

---

## [1.3.0] — 2026-08-15

### Added
- `GET /api/v1/clinics/[id]/admin` — fetch assigned admin for a clinic
- `POST /api/v1/clinics/[id]/admin` — assign admin to clinic (one per clinic enforced)
- `DELETE /api/v1/clinics/[id]/admin` — remove clinic admin
- `GET/POST /api/v1/super-admin/stats` — system-wide stats for SUPERADMIN
- `GET /api/v1/super-admin/admins` — list all clinic admins
- `GET/PATCH /api/v1/monitoring/errors` — error log viewer with pagination and filters
- `GET /api/v1/monitoring/stats` — error statistics and cron health

### Changed
- **Monitoring endpoints now clinic-scoped**: `ADMIN` sees only their clinic's error logs; `SUPERADMIN` sees all. `summary.scope` field added to stats response (`"clinic"` or `"global"`).
- All 7 cron routes now write failures to `ErrorLog` via `logCronJobError()`. Previously only `webhooks/whatsapp` logged to the monitoring dashboard.

### Fixed
- Assign admin modal now shows API errors (e.g. "Email already in use") inside the popup instead of the background banner.

---

## [1.2.0] — 2026-07-20

### Added
- `/api/v1/*` versioned route layer — all 30 routes aliased under `/api/v1`
- Multi-clinic support: every route scopes queries to the caller's `clinicId`
- SUPERADMIN role: bypasses clinic scoping, manages all clinics
- Cross-clinic isolation test suite (`src/__tests__/cross-clinic-isolation.test.ts`)
- `GET/PATCH /api/v1/monitoring/errors` and `GET /api/v1/monitoring/stats`
- `src/lib/error-logger.ts` — centralized ErrorLog writer

### Changed
- `session.user` now includes `clinicId` (was absent in v1.1)
- `getClinicIdFromSession()` returns `null` for SUPERADMIN (previously returned user's clinicId)

### Security
- Cross-clinic access returns `404` (not `403`) to prevent information leakage about records in other clinics

---

## [1.1.0] — 2026-06-15

### Added
- AI photo analysis endpoint (`/api/ai/analyze`) using Groq vision model
- Photo trend tracking (`/api/ai/photo-trends`)
- SOAP notes generation (`/api/ai/soap-notes`)
- Patient summary generation (`/api/ai/patient-summary`)
- Aftercare chatbot (`/api/ai/aftercare-chatbot`)
- AI explainability rationale in analysis responses

### Changed
- Groq model updated from `meta-llama/llama-4-scout-17b-16e-instruct` to `llama-3.2-90b-vision-preview`

---

## [1.0.0] — 2026-05-01

### Initial release

- Patient management: CRUD for patients, treatments, check-ins
- Appointment scheduling and reminders
- Recovery monitoring with AI photo analysis
- WhatsApp webhook intake and two-way messaging
- Consent management and tracking
- Complication reporting
- Product batch and expiry management
- Role-based access control (ADMIN, DOCTOR, RECEPTIONIST, PATIENT)
- Cron jobs: appointment reminders, silence risk detection, consent reminders, expiry alerts, survey dispatch, complication reporting, rebooking triggers

---

## Deprecation Register

| Endpoint | Deprecated | Removal Target | Replacement |
|----------|-----------|----------------|-------------|
| _(none)_ | — | — | — |

---

## Upcoming (v2 candidates)

The following changes would require a `/api/v2` bump when implemented:

- Removing `injectionAreas` as a JSON string in favour of a structured array field
- Changing patient `gender` from free-form string to a typed enum in the API response
- Splitting the monolithic `GET /api/v1/patients/[id]` response into separate sub-resources
