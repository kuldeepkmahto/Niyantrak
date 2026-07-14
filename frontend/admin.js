// ========================================
// NIYANTRAK — ADMIN DASHBOARD JS
// ========================================

// ── Navigation ───────────────────────────
const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = document.querySelectorAll('.admin-section');

function showAdminSection(id) {
    sections.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${id}`);
    if (target) target.classList.add('active');

    navItems.forEach(btn => btn.classList.toggle('active', btn.dataset.section === id));

    const titles = {
        overview:  '🔥 Admin Command Center',
        analytics: '📊 Analytics',
        users:     '👥 User Management',
        alerts:    '🔔 Alert Management',
        detection: '🤖 AI Detection',
        reports:   '📄 Submitted Reports'
    };
    const el = document.getElementById('pageTitle');
    if (el) el.textContent = titles[id] || 'Admin';

    // Lazy-init charts when analytics tab first opens
    if (id === 'analytics' && !window._analyticsChartsBuilt) {
        buildAnalyticsCharts();
        window._analyticsChartsBuilt = true;
    }
}

navItems.forEach(btn => btn.addEventListener('click', () => showAdminSection(btn.dataset.section)));

// Sidebar toggle
document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('collapsed');
    document.querySelector('.dashboard-main')?.classList.toggle('expanded');
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
});

// ── Evacuation modal ─────────────────────
document.getElementById('evacuateBtn')?.addEventListener('click', () => {
    document.getElementById('evacuationModal').style.display = 'flex';
});

function closeModal() {
    document.getElementById('evacuationModal').style.display = 'none';
}

function confirmEvacuation() {
    closeModal();
    showToast('🚨 Evacuation Protocol Activated! All teams notified.', 'danger');
    const btn = document.getElementById('evacuateBtn');
    if (btn) { btn.textContent = '✓ Evacuation Active'; btn.disabled = true; btn.style.opacity = '0.7'; }
}

// ── Toast ─────────────────────────────────
function showToast(msg, type = 'success') {
    const icons = { success: 'fa-check-circle', warning: 'fa-exclamation-triangle', danger: 'fa-radiation', error: 'fa-times-circle' };
    document.getElementById('toastIcon').className = `fas ${icons[type] || icons.success}`;
    document.getElementById('toastMsg').textContent = msg;
    const toast = document.getElementById('toast');
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// ── Chart.js Global Defaults ──────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'DM Sans', sans-serif";
Chart.defaults.font.size = 12;

const ORANGE = '#ff5722';
const ORANGE_LIGHT = 'rgba(255,87,34,0.18)';
const GREEN  = '#4caf50';
const RED    = '#f44336';
const YELLOW = '#ff9800';
const BLUE   = '#2196f3';

// ── Line Chart: Alert Trend ───────────────
function buildAlertTrendChart() {
    const ctx = document.getElementById('alertTrendChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
            datasets: [
                {
                    label: 'Alerts',
                    data: [18, 24, 15, 22, 19, 27],
                    borderColor: ORANGE,
                    backgroundColor: 'rgba(255,87,34,0.12)',
                    borderWidth: 2.5,
                    pointBackgroundColor: ORANGE,
                    pointRadius: 5,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Resolved',
                    data: [15, 20, 14, 18, 17, 23],
                    borderColor: GREEN,
                    backgroundColor: 'rgba(76,175,80,0.08)',
                    borderWidth: 2,
                    pointBackgroundColor: GREEN,
                    pointRadius: 4,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,15,35,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, beginAtZero: true }
            }
        }
    });
}

// ── Donut: Compliance ─────────────────────
function buildComplianceChart() {
    const ctx = document.getElementById('complianceChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Compliant', 'Non-compliant'],
            datasets: [{
                data: [94, 6],
                backgroundColor: [GREEN, RED],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(15,15,35,0.95)' }
            }
        }
    });
}

// ── Bar: Incidents by Zone ────────────────
function buildZoneChart() {
    const ctx = document.getElementById('zoneChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['WH-A Zone 1', 'WH-A Zone 2', 'WH-A Zone 3', 'WH-B Zone 1', 'Office Block', 'Loading Dock'],
            datasets: [{
                label: 'Incidents',
                data: [7, 4, 9, 2, 1, 3],
                backgroundColor: [
                    'rgba(255,87,34,0.8)', 'rgba(255,152,0,0.8)', 'rgba(244,67,54,0.9)',
                    'rgba(33,150,243,0.7)', 'rgba(76,175,80,0.7)', 'rgba(156,39,176,0.7)'
                ],
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,15,35,0.95)' } },
            scales: {
                x: { grid: { display: false }, border: { display: false } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, beginAtZero: true, ticks: { stepSize: 2 } }
            }
        }
    });
}

// Zone filter (re-renders with new data)
document.getElementById('zoneFilter')?.addEventListener('change', function() {
    const datasets = {
        'This Month':     [7,4,9,2,1,3],
        'Last 3 Months':  [18,12,22,8,4,9],
        'This Year':      [62,44,81,28,13,31]
    };
    const chart = Chart.getChart('zoneChart');
    if (chart) {
        chart.data.datasets[0].data = datasets[this.value] || datasets['This Month'];
        chart.update('active');
    }
});

// ── Analytics Charts ─────────────────────
function buildAnalyticsCharts() {
    // Response time line
    const ctx1 = document.getElementById('responseChart');
    if (ctx1) {
        new Chart(ctx1, {
            type: 'line',
            data: {
                labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
                datasets: [{
                    label: 'Avg Response (min)',
                    data: [8.2, 7.5, 9.1, 6.8, 7.2, 5.9],
                    borderColor: BLUE,
                    backgroundColor: 'rgba(33,150,243,0.1)',
                    borderWidth: 2.5,
                    pointBackgroundColor: BLUE,
                    pointRadius: 5,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,15,35,0.95)' } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, beginAtZero: true, title: { display: true, text: 'Minutes' } }
                }
            }
        });
    }

    // Alert types donut
    const ctx2 = document.getElementById('alertTypeChart');
    if (ctx2) {
        new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Fire', 'Smoke', 'Temp', 'Chemical', 'Other'],
                datasets: [{
                    data: [38, 24, 18, 12, 8],
                    backgroundColor: [ORANGE, RED, YELLOW, BLUE, '#9c27b0'],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } }, tooltip: { backgroundColor: 'rgba(15,15,35,0.95)' } }
            }
        });
    }

    // Analytics table
    buildAnalyticsTable();
}

function buildAnalyticsTable() {
    const data = [
        { month: 'March 2025', alerts: 27, resolved: 23, response: '5.9 min', compliance: '94%' },
        { month: 'February',   alerts: 19, resolved: 17, response: '7.2 min', compliance: '92%' },
        { month: 'January',    alerts: 22, resolved: 18, response: '6.8 min', compliance: '91%' },
        { month: 'December',   alerts: 15, resolved: 14, response: '9.1 min', compliance: '89%' },
        { month: 'November',   alerts: 24, resolved: 20, response: '7.5 min', compliance: '90%' },
        { month: 'October',    alerts: 18, resolved: 15, response: '8.2 min', compliance: '88%' },
    ];
    const tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;
    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.month}</td>
            <td><span style="color:#ff5722;font-weight:600">${r.alerts}</span></td>
            <td><span style="color:#4caf50;font-weight:600">${r.resolved}</span></td>
            <td>${r.response}</td>
            <td><span class="compliance-pill">${r.compliance}</span></td>
        </tr>`).join('');
}

// ── Users Table (real data) ───────────────
const ROLE_COLORS = { admin: '#ff5722', employee: '#2196f3', firemen: '#f44336', safetyofficer: '#9c27b0' };

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} day(s) ago`;
}

async function renderUsersTable(filter = '') {
    const roleF   = document.getElementById('roleFilter')?.value || '';
    const statusF = document.getElementById('statusFilter')?.value || '';
    const tbody   = document.getElementById('usersTableBody');
    if (!tbody) return;

    const params = new URLSearchParams({ limit: '100' });
    if (filter) params.set('search', filter);
    if (roleF)  params.set('role', roleF);
    if (statusF) params.set('isActive', statusF === 'active' ? 'true' : 'false');

    const { ok, data } = await apiFetch(`/users?${params.toString()}`);
    if (!ok || !data?.data) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:2rem">Could not load users — check the backend is running</td></tr>';
        return;
    }

    const users = data.data;
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:2rem">No users found</td></tr>'; return; }

    tbody.innerHTML = users.map(u => {
        const status = u.isActive ? 'active' : 'inactive';
        const color  = ROLE_COLORS[u.role] || '#94a3b8';
        return `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background:${color}22;color:${color}">${(u.fullname || u.email)[0].toUpperCase()}</div>
                    ${u.fullname || '—'}
                </div>
            </td>
            <td style="color:#94a3b8">${u.email}</td>
            <td><span class="role-badge" style="background:${color}22;color:${color};border-color:${color}44">${u.role}</span></td>
            <td>${u.department || '—'}</td>
            <td><span class="status-dot ${status}"></span> ${status}</td>
            <td style="color:#94a3b8;font-size:0.85rem">${timeAgo(u.lastLogin)}</td>
            <td>
                <div class="action-btns">
                    ${u.isActive
                        ? `<button class="act-btn del" title="Deactivate" onclick="deactivateUser('${u._id}')"><i class="fas fa-ban"></i></button>`
                        : `<span style="color:#64748b;font-size:0.78rem">Deactivated</span>`}
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function deactivateUser(id) {
    if (!confirm('Deactivate this user? They will no longer be able to log in.')) return;
    const { ok, data } = await apiFetch(`/users/${id}/deactivate`, { method: 'PUT' });
    if (ok) { showToast('User deactivated', 'success'); renderUsersTable(document.getElementById('userSearch')?.value.toLowerCase() || ''); }
    else showToast(data?.message || 'Could not deactivate user', 'error');
}

document.getElementById('userSearch')?.addEventListener('input', e => renderUsersTable(e.target.value.toLowerCase()));
document.getElementById('roleFilter')?.addEventListener('change', () => renderUsersTable(document.getElementById('userSearch')?.value.toLowerCase() || ''));
document.getElementById('statusFilter')?.addEventListener('change', () => renderUsersTable(document.getElementById('userSearch')?.value.toLowerCase() || ''));

// ── Alerts Admin Grid (real data) ─────────
const SEV_COLORS = { critical: '#f44336', high: '#ff5722', medium: '#ff9800', low: '#4caf50' };

async function renderAlertsGrid() {
    const grid = document.getElementById('alertsAdminGrid');
    if (!grid) return;

    const { ok, data } = await apiFetch('/alerts?limit=50');
    if (!ok || !data?.data) {
        grid.innerHTML = '<p style="color:#64748b;padding:1rem">Could not load alerts — check the backend is running.</p>';
        return;
    }

    const alerts = data.data;
    const activeCount = alerts.filter(a => a.status === 'active').length;
    const kpiEl = document.getElementById('activeAlerts');
    if (kpiEl) kpiEl.textContent = activeCount;

    if (!alerts.length) { grid.innerHTML = '<p style="color:#64748b;padding:1rem">No alerts yet.</p>'; return; }

    grid.innerHTML = alerts.map(a => `
        <div class="alert-admin-card ${a.level}">
            <div class="aac-header">
                <span class="aac-type"><i class="fas fa-fire"></i> ${a.type}${a.aiGenerated ? ' <i class="fas fa-wand-magic-sparkles" title="AI-generated" style="color:#c4b5fd"></i>' : ''}</span>
                <span class="aac-status ${a.status}">${a.status}</span>
            </div>
            <div class="aac-zone">${a.location}${a.zone ? ' — ' + a.zone : ''}</div>
            <div class="aac-metrics">
                <span style="color:${SEV_COLORS[a.level]};font-size:1.6rem;font-weight:800">${a.temperature ? a.temperature + '°C' : a.level.toUpperCase()}</span>
                <span class="aac-smoke">${a.detail || ''}</span>
            </div>
            <div class="aac-footer">
                <small>${timeAgo(a.createdAt)}</small>
                ${a.status !== 'resolved'
                    ? `<button class="act-btn resolve" onclick="resolveAlert('${a._id}')">Resolve</button>`
                    : `<span style="color:#4caf50;font-size:0.85rem"><i class="fas fa-check"></i> Resolved</span>`}
            </div>
        </div>`).join('');
}

async function resolveAlert(id) {
    const { ok, data } = await apiFetch(`/alerts/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'resolved' }),
    });
    if (ok) { showToast('Alert resolved successfully', 'success'); renderAlertsGrid(); }
    else showToast(data?.message || 'Could not resolve alert', 'error');
}


// ── Reports (real data from backend) ──────
async function renderReportsTable() {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;

    const { ok, data } = await apiFetch('/incidents?limit=20');
    if (!ok || !data?.data?.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:2rem">No reports yet — employees haven\'t submitted any, or the backend is unreachable</td></tr>';
        return;
    }

    const LABEL = { 'near-miss': 'Near Miss', 'unsafe-condition': 'Unsafe Condition', 'work-permit': 'Work Permit', 'incident-report': 'Incident Report' };
    const SEV_MAP = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };

    tbody.innerHTML = data.data.map(s => {
        const sev = s.severity || 'submitted';
        const ts  = new Date(s.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const submitter = s.submittedBy?.fullname || s.submittedBy?.email || 'Employee';
        const aiTag = s.aiTriage?.suggestedSeverity
            ? `<div style="font-size:0.72rem;color:#c4b5fd;margin-top:0.2rem"><i class="fas fa-wand-magic-sparkles"></i> AI: ${s.aiTriage.suggestedSeverity} · ${s.aiTriage.hazardCategory || ''}</div>`
            : '';
        return `
        <tr>
            <td><span class="role-badge" style="background:rgba(255,87,34,0.15);color:#ff7043;border-color:rgba(255,87,34,0.3)">${LABEL[s.type] || s.type}</span>${aiTag}</td>
            <td>${submitter}</td>
            <td>${s.zone || s.location || '—'}</td>
            <td><span class="sub-badge ${SEV_MAP[sev] || 'badge-info'}">${sev}</span></td>
            <td style="color:#94a3b8;font-size:0.85rem">${ts}</td>
            <td><span class="status-dot active"></span> ${s.status || 'open'}</td>
        </tr>`;
    }).join('');
}

// ── AI Detection Functionality ───────────
async function runDetection() {
    const btn = document.getElementById('runDetectionBtn');
    if (!btn) return;

    // Get sensor values
    const smokePPM = parseInt(document.getElementById('smokePPM')?.value) || 0;
    const temperature = parseInt(document.getElementById('temperature')?.value) || 0;
    const carbonMonoxide = parseInt(document.getElementById('carbonMonoxide')?.value) || 0;
    const soundLevel = parseInt(document.getElementById('soundLevel')?.value) || 0;
    const cameraAlert = document.getElementById('cameraAlert')?.checked || false;
    const zone = document.getElementById('detectionZone')?.value || 'Warehouse A - Zone 3';

    // Show loading state
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    btn.disabled = true;

    try {
        // Get auth token
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        if (!token) {
            showToast('Please login first', 'error');
            return;
        }

        // Check if it's a demo token
        if (token.startsWith('demo-token')) {
            // Use demo mode
            const demoResult = {
                score: Math.floor(Math.random() * 40) + 60, // 60-100
                riskLevel: Math.random() > 0.5 ? 'warning' : 'critical',
                riskLabel: Math.random() > 0.5 ? '🟡 Warning Hazard' : '🔴 Critical Hazard',
                flags: [
                    'Demo: Simulated sensor readings detected.',
                    'Demo: Risk assessment completed.',
                    'Demo: Analysis based on input parameters.'
                ],
                sensorReadings: { smokePPM, temperature, carbonMonoxide, soundLevel, cameraAlert },
                zone,
                location: '28.6139,77.2090',
                analyzedAt: new Date().toISOString()
            };
            displayDetectionResults(demoResult);
            showToast('Demo detection completed', 'success');
            return;
        }

        // Call API
        const response = await fetch(`${API_BASE}/ai/sensor-fusion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                smokePPM,
                temperature,
                carbonMonoxide,
                soundLevel,
                cameraAlert,
                zone,
                location: '28.6139,77.2090' // Default Delhi coordinates
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            displayDetectionResults(result.data);
            showToast('AI Detection completed successfully', 'success');
        } else {
            showToast(result.message || 'Detection failed', 'error');
        }
    } catch (error) {
        console.error('Detection error:', error);
        // Fallback to demo data if API fails
        const demoResult = {
            score: 85,
            riskLevel: 'warning',
            riskLabel: '🟡 Warning Hazard',
            flags: [
                'Temperature slightly elevated.',
                'Sound levels above normal.',
                'Camera detected minor anomaly.'
            ],
            sensorReadings: { smokePPM, temperature, carbonMonoxide, soundLevel, cameraAlert },
            zone,
            location: '28.6139,77.2090',
            analyzedAt: new Date().toISOString()
        };
        displayDetectionResults(demoResult);
        showToast('Using demo detection (API offline)', 'warning');
    } finally {
        btn.innerHTML = '<i class="fas fa-play"></i> Run Detection';
        btn.disabled = false;
    }
}

function displayDetectionResults(data) {
    const resultsDiv = document.getElementById('detectionResults');
    const riskSummary = document.getElementById('riskSummary');
    const sensorFlags = document.getElementById('sensorFlags');

    if (!resultsDiv || !riskSummary || !sensorFlags) return;

    // Risk summary
    const riskColors = {
        critical: '#f44336',
        high: '#ff5722',
        warning: '#ff9800',
        low: '#4caf50',
        safe: '#4caf50'
    };

    riskSummary.innerHTML = `
        <div class="risk-level" style="color: ${riskColors[data.riskLevel] || '#4caf50'}">
            <h4>${data.riskLabel}</h4>
            <div class="risk-score">Risk Score: ${data.score}/100</div>
            <div class="risk-zone">Zone: ${data.zone}</div>
            <div class="risk-time">Analyzed: ${new Date(data.analyzedAt).toLocaleString()}</div>
        </div>
    `;

    // Sensor flags
    sensorFlags.innerHTML = `
        <h4>Sensor Flags:</h4>
        <ul>
            ${data.flags.map(flag => `<li><i class="fas fa-exclamation-circle"></i> ${flag}</li>`).join('')}
        </ul>
    `;

    // Show results
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

async function createAlertFromDetection() {
    const riskSummary = document.getElementById('riskSummary');
    if (!riskSummary || !riskSummary.querySelector('.risk-level')) {
        showToast('Run detection first', 'warning');
        return;
    }

    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token?.startsWith('demo-token')) {
        showToast('Demo: Alert created successfully', 'success');
        // Update active alerts count
        const kpiEl = document.getElementById('activeAlerts');
        if (kpiEl) kpiEl.textContent = (parseInt(kpiEl.textContent) || 0) + 1;
        return;
    }

    try {

        // Get current detection data
        const zone = document.getElementById('detectionZone')?.value || 'Warehouse A - Zone 3';
        const smokePPM = parseInt(document.getElementById('smokePPM')?.value) || 0;
        const temperature = parseInt(document.getElementById('temperature')?.value) || 0;

        const response = await fetch(`${API_BASE}/alerts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type: 'AI Detection',
                zone,
                severity: 'high',
                description: `AI detected potential hazard in ${zone}. Smoke: ${smokePPM} PPM, Temp: ${temperature}°C`,
                coordinates: { lat: 28.6139, lng: 77.2090 }
            })
        });

        const result = await response.json();
        if (response.ok) {
            showToast('Alert created successfully', 'success');
            // Update active alerts count
            const kpiEl = document.getElementById('activeAlerts');
            if (kpiEl) kpiEl.textContent = (parseInt(kpiEl.textContent) || 0) + 1;
        } else {
            showToast(result.message || 'Failed to create alert', 'error');
        }
    } catch (error) {
        console.error('Create alert error:', error);
        showToast('Failed to create alert', 'error');
    }
}

async function logComplianceFromDetection() {
    const riskSummary = document.getElementById('riskSummary');
    if (!riskSummary || !riskSummary.querySelector('.risk-level')) {
        showToast('Run detection first', 'warning');
        return;
    }

    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token?.startsWith('demo-token')) {
        showToast('Demo: Compliance logged successfully', 'success');
        return;
    }

    try {

        const zone = document.getElementById('detectionZone')?.value || 'Warehouse A - Zone 3';
        const score = parseInt(riskSummary.querySelector('.risk-score')?.textContent?.split(':')[1]?.split('/')[0]) || 0;
        const status = score > 80 ? 'non-compliant' : score > 50 ? 'partial' : 'compliant';

        const response = await fetch(`${API_BASE}/compliance/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                zone,
                standard: 'NFPA 101',
                status,
                completionPct: Math.max(0, 100 - score),
                requiredPct: 100,
                notes: `AI compliance check for ${zone} - Risk score: ${score}`
            })
        });

        const result = await response.json();
        if (response.ok) {
            showToast('Compliance logged successfully', 'success');
        } else {
            showToast(result.message || 'Failed to log compliance', 'error');
        }
    } catch (error) {
        console.error('Log compliance error:', error);
        showToast('Failed to log compliance', 'error');
    }
}

// Event listeners for detection
document.getElementById('runDetectionBtn')?.addEventListener('click', runDetection);
document.getElementById('createAlertBtn')?.addEventListener('click', createAlertFromDetection);
document.getElementById('logComplianceBtn')?.addEventListener('click', logComplianceFromDetection);

// ── Init ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    
    if (!token || !user.role || user.role !== 'admin') {
        showToast('Please login as admin first', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    // Build overview charts
    buildAlertTrendChart();
    buildComplianceChart();
    buildZoneChart();

    // Populate tables
    renderUsersTable();
    renderAlertsGrid();
    renderReportsTable();

    // Set admin name from session
    const profileSpan = document.querySelector('.profile span');
    if (profileSpan && user.email) profileSpan.textContent = user.email.split('@')[0];
});
