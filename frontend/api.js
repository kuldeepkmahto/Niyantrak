// api.js — Shared API helper layer for all dashboards (employee/firemen/admin)
// Loaded before script.js / employee.js / firemen.js / admin.js on every
// dashboard page. Provides authentication helpers and the apiFetch()
// wrapper that every dashboard script calls.

const API_BASE = 'http://localhost:5000/api';

/* ── TOKEN / SESSION HELPERS ─────────────────────────────── */
function getToken() {
    return sessionStorage.getItem('token') || localStorage.getItem('token');
}

function getCurrentUser() {
    try {
        return JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}');
    } catch (err) {
        return {};
    }
}

// Redirects to login if there's no valid session, or if the logged-in
// user's role doesn't match the role this page requires.
// Returns true if the session is valid, false otherwise (caller should
// `return` immediately when this returns false).
function requireAuth(expectedRole) {
    const token = getToken();
    const user = getCurrentUser();

    if (!token || !user || !user.role) {
        window.location.href = 'index.html#login';
        return false;
    }
    if (expectedRole && user.role !== expectedRole) {
        window.location.href = `${user.role}.html`;
        return false;
    }
    return true;
}

/* ── CORE FETCH WRAPPER ──────────────────────────────────── */
// Every dashboard script calls this the same way:
//   const { ok, data } = await apiFetch('/incidents?limit=20');
// - `path` is relative to API_BASE (e.g. '/incidents', '/ai/triage')
// - Automatically attaches the JWT bearer token if present
// - JSON-encodes plain object bodies automatically unless FormData is passed
// - Never throws: network/parse errors resolve to { ok: false, data: null }
async function apiFetch(path, options = {}) {
    try {
        const token = getToken();
        const isFormData = options.body instanceof FormData;

        const headers = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        };

        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
        });

        let data = null;
        try {
            data = await response.json();
        } catch (parseErr) {
            data = null;
        }

        if (response.status === 401) {
            // Session expired / invalid — clear it and bounce to login.
            sessionStorage.clear();
            localStorage.removeItem('token');
            window.location.href = 'index.html#login';
            return { ok: false, data };
        }

        return { ok: response.ok, data };
    } catch (err) {
        // Backend unreachable, CORS failure, offline, etc.
        return { ok: false, data: null };
    }
}

/* ── REPORT SUBMISSION (near-miss / unsafe / permit / incident) ── */
// `payload` is the plain JS object built by employee.js's submitForm().
// `files` is an optional FileList from a <input type="file"> element.
// Sends multipart/form-data when files are present (matching the backend's
// multer field name 'attachments' and JSON-in-a-field 'data' pattern),
// otherwise sends a plain JSON body.
async function submitIncidentReport(payload, files) {
    if (files && files.length) {
        const formData = new FormData();
        formData.append('data', JSON.stringify(payload));
        Array.from(files).forEach(file => formData.append('attachments', file));
        return apiFetch('/incidents', { method: 'POST', body: formData });
    }
    return apiFetch('/incidents', { method: 'POST', body: JSON.stringify(payload) });
}

/* ── AI HELPERS ───────────────────────────────────────────── */
async function getAiTriage({ description, type, zone }) {
    return apiFetch('/ai/triage', {
        method: 'POST',
        body: JSON.stringify({ description, type, zone }),
    });
}

async function getAiSensorFusion(payload) {
    return apiFetch('/ai/sensor-fusion', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

async function getAiChecklistAnalysis(payload) {
    return apiFetch('/ai/analyze-checklist', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

async function detectFireImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    return apiFetch('/ai/detect-fire-image', { method: 'POST', body: formData });
}