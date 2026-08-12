'use client';

import { useState } from 'react';

const toc = [
  { id: 'auth', label: 'Authentication' },
  { id: 'patients', label: 'Patients' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'treatments', label: 'Treatments' },
  { id: 'checkins', label: 'Check-ins (Recovery)' },
  { id: 'ai', label: 'AI Endpoints' },
  { id: 'intake', label: 'Intake (WhatsApp)' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'products-consent', label: 'Products & Consent' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'patient-portal', label: 'Patient Portal' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'clinics', label: 'Clinics (SuperAdmin)' },
  { id: 'rate-limits', label: 'Rate Limits & Notes' },
  { id: 'response-format', label: 'Response Format' },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PATCH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

interface Endpoint {
  method: string;
  path: string;
  desc: string;
  roles?: string;
  query?: string;
  body?: string;
  response?: string;
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${methodColors[method] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
    >
      {method}
    </span>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  const hasDetails = ep.query || ep.body || ep.response;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <button
        onClick={() => hasDetails && setOpen(!open)}
        className="w-full text-left flex items-center gap-3"
      >
        <MethodBadge method={ep.method} />
        <code className="text-sm text-gray-200 font-mono break-all">{ep.path}</code>
        {hasDetails && (
          <span className="ml-auto text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
        )}
      </button>
      <p className="text-gray-400 text-sm mt-2 ml-1">{ep.desc}</p>
      {ep.roles && (
        <p className="text-xs text-gray-500 mt-1 ml-1">
          <span className="text-gray-400">Roles:</span> {ep.roles}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3 border-t border-gray-700/50 pt-4">
          {ep.query && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Query Parameters
              </h4>
              <pre className="bg-gray-900/60 rounded-lg p-3 text-xs text-green-300 font-mono overflow-x-auto">
                {ep.query}
              </pre>
            </div>
          )}
          {ep.body && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Request Body
              </h4>
              <pre className="bg-gray-900/60 rounded-lg p-3 text-xs text-blue-300 font-mono overflow-x-auto">
                {ep.body}
              </pre>
            </div>
          )}
          {ep.response && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Response
              </h4>
              <pre className="bg-gray-900/60 rounded-lg p-3 text-xs text-purple-300 font-mono overflow-x-auto">
                {ep.response}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  endpoints,
  children,
}: {
  id: string;
  title: string;
  endpoints?: Endpoint[];
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
        {title}
      </h2>
      {endpoints && (
        <div className="space-y-3">
          {endpoints.map((ep, i) => (
            <EndpointCard key={i} ep={ep} />
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState('auth');

  const patients: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/patients',
      desc: 'List all patients.',
      roles: 'Admin, Doctor',
      query: '?search=&page=&limit=',
      response: `[
  {
    "id": "clx...",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "dateOfBirth": "1990-01-15",
    "gender": "male",
    "createdAt": "2025-01-01T00:00:00Z"
  }
]`,
    },
    {
      method: 'POST',
      path: '/api/v1/patients',
      desc: 'Create a new patient record.',
      roles: 'Doctor only',
      body: `{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1234567891",
  "dateOfBirth": "1985-06-20",
  "gender": "female",
  "address": "123 Main St",
  "medicalHistory": "No significant history",
  "allergies": "Penicillin"
}`,
      response: `{ "id": "clx...", "name": "Jane Smith", ... }`,
    },
    {
      method: 'GET',
      path: '/api/v1/patients/[id]',
      desc: 'Get detailed patient information.',
      roles: 'Admin, Doctor',
    },
    {
      method: 'PATCH',
      path: '/api/v1/patients/[id]',
      desc: 'Update an existing patient record.',
      roles: 'Admin, Doctor',
      body: `{ "name": "Jane Doe Updated", "phone": "+1234567892" }`,
    },
    {
      method: 'DELETE',
      path: '/api/v1/patients/[id]',
      desc: 'Delete a patient record.',
      roles: 'Admin only',
    },
  ];

  const appointments: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/appointments',
      desc: 'List all appointments with optional filters.',
      roles: 'Admin, Doctor, Receptionist',
      query: '?patientId=&date=&status=',
      response: `[
  {
    "id": "clx...",
    "patientId": "clx...",
    "doctorId": "clx...",
    "date": "2025-06-15T10:00:00Z",
    "type": "follow-up",
    "status": "scheduled",
    "notes": "Post-treatment check"
  }
]`,
    },
    {
      method: 'POST',
      path: '/api/v1/appointments',
      desc: 'Create a new appointment.',
      roles: 'Receptionist',
      body: `{
  "patientId": "clx...",
  "doctorId": "clx...",
  "date": "2025-06-20T14:00:00Z",
  "type": "initial",
  "notes": "First consultation"
}`,
    },
    {
      method: 'PATCH',
      path: '/api/v1/appointments/[id]',
      desc: 'Update an appointment status.',
      body: `{ "status": "completed", "notes": "Patient arrived on time" }`,
    },
    {
      method: 'DELETE',
      path: '/api/v1/appointments/[id]',
      desc: 'Cancel an appointment.',
    },
  ];

  const treatments: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/treatments',
      desc: 'List all treatments.',
      query: '?patientId=&doctorId=',
      response: `[
  {
    "id": "clx...",
    "patientId": "clx...",
    "doctorId": "clx...",
    "type": "Botox",
    "area": "Forehead",
    "dosage": "20 units",
    "notes": "Follow-up in 2 weeks",
    "createdAt": "2025-06-10T09:00:00Z"
  }
]`,
    },
    {
      method: 'POST',
      path: '/api/v1/treatments',
      desc: 'Create a new treatment record.',
      roles: 'Doctor only',
      body: `{
  "patientId": "clx...",
  "type": "Dermal Fillers",
  "area": "Lips",
  "dosage": "1ml Juvederm",
  "notes": "Patient requested natural look"
}`,
    },
    {
      method: 'PATCH',
      path: '/api/v1/treatments/[id]',
      desc: 'Update a treatment record.',
    },
    {
      method: 'DELETE',
      path: '/api/v1/treatments/[id]',
      desc: 'Delete a treatment record.',
    },
  ];

  const checkins: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/checkins',
      desc: 'List all check-ins for recovery monitoring.',
      roles: 'Staff',
      query: '?patientId=&status=',
      response: `[
  {
    "id": "clx...",
    "patientId": "clx...",
    "treatmentId": "clx...",
    "status": "pending",
    "imageUrl": null,
    "aiAnalysis": null,
    "createdAt": "2025-06-11T08:00:00Z"
  }
]`,
    },
    {
      method: 'POST',
      path: '/api/v1/checkins',
      desc: 'Create a new check-in record.',
      body: `{ "patientId": "clx...", "treatmentId": "clx..." }`,
    },
    {
      method: 'GET',
      path: '/api/v1/patient/checkin/pending',
      desc: 'Get pending check-ins for the authenticated patient.',
      roles: 'Patient',
    },
    {
      method: 'POST',
      path: '/api/v1/patient/checkin',
      desc: 'Submit a check-in response.',
      roles: 'Patient',
      body: `{ "checkInId": "clx...", "notes": "Feeling better today" }`,
    },
    {
      method: 'POST',
      path: '/api/v1/patient/checkin/upload',
      desc: 'Upload a photo for a check-in and trigger AI analysis.',
      roles: 'Patient',
      body: `multipart/form-data: { "checkInId": "clx...", "file": <binary> }`,
    },
  ];

  const aiEndpoints: Endpoint[] = [
    {
      method: 'POST',
      path: '/api/v1/ai/analyze',
      desc: 'Analyze a check-in photo using AI.',
      body: `{ "checkInId": "clx...", "imageUrl": "https://..." }`,
      response: `{
  "analysis": "Healing progressing well. No signs of infection.",
  "confidence": 0.92,
  "flags": []
}`,
    },
    {
      method: 'POST',
      path: '/api/v1/ai/patient-summary',
      desc: 'Generate an AI-powered patient summary.',
      body: `{ "patientId": "clx..." }`,
      response: `{
  "summary": "Patient has undergone 3 treatments...",
  "riskLevel": "low",
  "recommendations": [...]
}`,
    },
    {
      method: 'POST',
      path: '/api/v1/ai/soap-notes',
      desc: 'Generate SOAP notes for a treatment.',
      body: `{ "patientId": "clx...", "treatmentId": "clx..." }`,
      response: `{
  "subjective": "Patient reports mild discomfort...",
  "objective": "Treatment area shows expected swelling...",
  "assessment": "Normal post-procedure recovery",
  "plan": "Continue monitoring, follow up in 1 week"
}`,
    },
    {
      method: 'POST',
      path: '/api/v1/ai/suggest-slots',
      desc: 'Suggest appointment slots based on patient history.',
      body: `{ "patientId": "clx...", "doctorId": "clx..." }`,
      response: `{
  "suggestions": [
    { "date": "2025-06-20T10:00:00Z", "reason": "Follow-up window" },
    { "date": "2025-06-21T14:00:00Z", "reason": "Doctor availability" }
  ]
}`,
    },
  ];

  const intake: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/intake',
      desc: 'List WhatsApp intake submissions.',
      roles: 'Staff',
      query: '?status=pending | approved | rejected',
      response: `[
  {
    "id": "clx...",
    "phone": "+1234567890",
    "message": "Hi, I need a consultation...",
    "status": "pending",
    "createdAt": "2025-06-12T11:00:00Z"
  }
]`,
    },
    {
      method: 'POST',
      path: '/api/v1/intake/[id]/approve',
      desc: 'Approve a WhatsApp intake submission.',
      body: `{ "patientId": "clx..." }`,
    },
    {
      method: 'POST',
      path: '/api/v1/intake/[id]/reject',
      desc: 'Reject a WhatsApp intake submission.',
      body: `{ "reason": "Incomplete information" }`,
    },
  ];

  const doctors: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/doctors',
      desc: 'List all doctors.',
      roles: 'Admin',
    },
    {
      method: 'POST',
      path: '/api/v1/doctors',
      desc: 'Create a new doctor profile.',
      roles: 'Admin',
      body: `{
  "userId": "clx...",
  "specialty": "Dermatology",
  "licenseNo": "MD-12345"
}`,
    },
    {
      method: 'PATCH',
      path: '/api/v1/doctors/[id]',
      desc: 'Update a doctor profile.',
    },
    {
      method: 'DELETE',
      path: '/api/v1/doctors/[id]',
      desc: 'Deactivate a doctor.',
    },
  ];

  const productsConsent: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/products',
      desc: 'List all products.',
    },
    {
      method: 'POST',
      path: '/api/v1/products',
      desc: 'Create a new product.',
      roles: 'Admin',
      body: `{
  "name": "Juvederm Ultra",
  "category": "Filler",
  "price": 650,
  "description": "Hyaluronic acid dermal filler"
}`,
    },
    {
      method: 'GET',
      path: '/api/v1/consent',
      desc: 'List consent records.',
    },
    {
      method: 'POST',
      path: '/api/v1/consent',
      desc: 'Create a consent record.',
      body: `{
  "patientId": "clx...",
  "treatmentId": "clx...",
  "consentText": "I consent to...",
  "signed": true
}`,
    },
  ];

  const webhooks: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/webhooks/whatsapp',
      desc: 'WhatsApp webhook verification endpoint.',
      query: '?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE',
      response: 'Returns hub.challenge value on success',
    },
    {
      method: 'POST',
      path: '/api/v1/webhooks/whatsapp',
      desc: 'Receive incoming WhatsApp messages (Cloud API payload). Signature verification required.',
    },
  ];

  const monitoring: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/monitoring/stats',
      desc: 'Get error statistics and cron job health.',
      roles: 'Admin',
      response: `{
  "summary": { "total": 42, "unresolved": 5 },
  "errorsByLevel": { "error": 10, "warn": 32 },
  "errorsByCategory": { "api": 15, "ai": 8, "webhook": 5 },
  "cronHealth": { "checkinReminder": "ok", "errorCleanup": "ok" }
}`,
    },
    {
      method: 'GET',
      path: '/api/v1/monitoring/errors',
      desc: 'List errors with pagination and filters.',
      roles: 'Admin',
      query: '?page=1&level=error&category=api&resolved=false&search=timeout',
    },
    {
      method: 'PATCH',
      path: '/api/v1/monitoring/errors',
      desc: 'Mark an error as resolved or unresolved.',
      roles: 'Admin',
      body: `{ "id": "clx...", "resolved": true }`,
    },
  ];

  const patientPortal: Endpoint[] = [
    {
      method: 'POST',
      path: '/api/v1/patient/auth',
      desc: 'Patient login. Returns a JWT in the patient-session cookie.',
      body: `{ "email": "patient@example.com", "password": "secret" }`,
      response: `{ "message": "Login successful", "patient": { "id": "clx...", "name": "..." } }`,
    },
    {
      method: 'POST',
      path: '/api/v1/patient/auth/logout',
      desc: 'Patient logout. Clears the patient-session cookie.',
    },
    {
      method: 'GET',
      path: '/api/v1/patient/data',
      desc: 'Get the authenticated patient\'s own data.',
      roles: 'Patient',
    },
    {
      method: 'GET',
      path: '/api/v1/patient/appointments',
      desc: 'List the authenticated patient\'s appointments.',
      roles: 'Patient',
    },
  ];

  const notifications: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/notifications',
      desc: 'List all notifications for the current user.',
      roles: 'Staff',
    },
    {
      method: 'PATCH',
      path: '/api/v1/notifications',
      desc: 'Mark notifications as read.',
      roles: 'Staff',
      body: `{ "ids": ["clx...", "clx..."] }`,
    },
  ];

  const clinics: Endpoint[] = [
    {
      method: 'GET',
      path: '/api/v1/clinics',
      desc: 'List all clinics.',
      roles: 'SuperAdmin',
    },
    {
      method: 'POST',
      path: '/api/v1/clinics',
      desc: 'Create a new clinic.',
      roles: 'SuperAdmin',
      body: `{
  "name": "Glow Aesthetics",
  "address": "456 Oak Ave",
  "phone": "+1987654321",
  "email": "info@glow.com"
}`,
    },
    {
      method: 'PATCH',
      path: '/api/v1/clinics/[id]',
      desc: 'Update clinic details.',
      roles: 'SuperAdmin',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            API Documentation
          </h1>
          <p className="text-gray-400 mt-3 text-lg">
            Clinic Assistant — REST API Reference
          </p>
          <p className="text-gray-500 mt-1 text-sm">
            Base URL: <code className="text-gray-300">/api/v1</code> &nbsp;|&nbsp; All responses are JSON
          </p>
        </header>

        <div className="flex gap-8 relative">
          {/* Sidebar TOC */}
          <aside className="hidden lg:block w-56 shrink-0">
            <nav className="sticky top-8 space-y-1">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeSection === item.id
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 space-y-16 min-w-0">
            {/* Authentication */}
            <Section id="auth" title="Authentication">
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 space-y-4">
                <p className="text-gray-300 text-sm leading-relaxed">
                  All <code className="bg-gray-900/60 px-1.5 py-0.5 rounded text-blue-400">/api/v1/*</code>{' '}
                  endpoints require authentication. There are two authentication mechanisms:
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-gray-900/40 rounded-xl p-4 border border-gray-700/30">
                    <h3 className="font-semibold text-white text-sm mb-2">Staff Authentication</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Uses <strong className="text-gray-300">NextAuth session cookies</strong>.
                    </p>
                    <div className="mt-3 space-y-1 text-xs text-gray-500">
                      <p>
                        1. <code className="text-green-400">POST /api/auth/csrf</code> → get CSRF token
                      </p>
                      <p>
                        2. <code className="text-blue-400">POST /api/auth/callback/credentials</code> → get session
                      </p>
                      <p>
                        3. Use session cookie for subsequent requests
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-900/40 rounded-xl p-4 border border-gray-700/30">
                    <h3 className="font-semibold text-white text-sm mb-2">Patient Authentication</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Uses a custom <strong className="text-gray-300">JWT in <code className="text-purple-400">patient-session</code> cookie</strong>.
                    </p>
                    <div className="mt-3 space-y-1 text-xs text-gray-500">
                      <p>
                        1. <code className="text-blue-400">POST /api/v1/patient/auth</code> → get JWT cookie
                      </p>
                      <p>
                        2. Use <code className="text-purple-400">patient-session</code> cookie (NOT NextAuth)
                      </p>
                      <p>
                        3. Patient endpoints reject NextAuth sessions
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section id="patients" title="Patients" endpoints={patients} />
            <Section id="appointments" title="Appointments" endpoints={appointments} />
            <Section id="treatments" title="Treatments" endpoints={treatments} />
            <Section id="checkins" title="Check-ins (Recovery)" endpoints={checkins} />
            <Section id="ai" title="AI Endpoints" endpoints={aiEndpoints} />
            <Section id="intake" title="Intake (WhatsApp)" endpoints={intake} />
            <Section id="doctors" title="Doctors" endpoints={doctors} />
            <Section id="products-consent" title="Products & Consent" endpoints={productsConsent} />
            <Section id="webhooks" title="Webhooks" endpoints={webhooks} />
            <Section id="monitoring" title="Monitoring" endpoints={monitoring} />
            <Section id="patient-portal" title="Patient Portal" endpoints={patientPortal} />
            <Section id="notifications" title="Notifications" endpoints={notifications} />
            <Section id="clinics" title="Clinics (SuperAdmin)" endpoints={clinics} />

            {/* Rate Limits */}
            <Section id="rate-limits" title="Rate Limits & Notes">
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                <ul className="space-y-3 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>All endpoints are rate-limited by server capacity.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>
                      Patient endpoints use <code className="text-purple-400">patient-session</code> cookie, NOT NextAuth.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>AI endpoints use Groq API and may have their own rate limits.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>WhatsApp webhook requires signature verification (X-Hub-Signature-256).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>
                      Versioned routes (<code className="text-blue-400">/api/v1/*</code>) are aliases — same handlers as
                      unversioned routes.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>
                      Future breaking changes will increment to <code className="text-blue-400">/api/v2/*</code>.
                    </span>
                  </li>
                </ul>
              </div>
            </Section>

            {/* Response Format */}
            <Section id="response-format" title="Response Format">
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 space-y-4">
                <p className="text-gray-300 text-sm">
                  All endpoints return JSON. Successful responses use appropriate HTTP status codes (200, 201, 204).
                  Error responses follow a consistent format:
                </p>
                <pre className="bg-gray-900/60 rounded-xl p-4 text-xs text-red-300 font-mono overflow-x-auto">
{`{
  "error": "Patient not found",
  "status": 404
}`}
                </pre>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                    <span className="text-green-400 font-mono font-bold">200</span>
                    <p className="text-gray-500 mt-0.5">OK</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
                    <span className="text-blue-400 font-mono font-bold">201</span>
                    <p className="text-gray-500 mt-0.5">Created</p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                    <span className="text-amber-400 font-mono font-bold">400</span>
                    <p className="text-gray-500 mt-0.5">Bad Request</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                    <span className="text-red-400 font-mono font-bold">401</span>
                    <p className="text-gray-500 mt-0.5">Unauthorized</p>
                  </div>
                </div>
              </div>
            </Section>
          </main>
        </div>
      </div>
    </div>
  );
}
