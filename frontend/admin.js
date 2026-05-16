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

// ── Users Table ───────────────────────────
const DEMO_USERS = [
    { name: 'Arjun Sharma',   email: 'arjun@niyantrak.com',    role: 'admin',         zone: 'All Zones',     status: 'active',   last: '2 min ago' },
    { name: 'Priya Mehta',    email: 'priya@niyantrak.com',    role: 'employee',      zone: 'WH-A Zone 1',   status: 'active',   last: '15 min ago' },
    { name: 'Ravi Patel',     email: 'ravi@niyantrak.com',     role: 'firemen',       zone: 'WH-A Zone 3',   status: 'active',   last: '3 min ago' },
    { name: 'Sneha Iyer',     email: 'sneha@niyantrak.com',    role: 'employee',      zone: 'WH-B Zone 1',   status: 'inactive', last: '2 days ago' },
    { name: 'Kiran Reddy',    email: 'kiran@niyantrak.com',    role: 'safetyofficer', zone: 'Office Block',  status: 'active',   last: '1 hr ago' },
    { name: 'Ananya Desai',   email: 'ananya@niyantrak.com',   role: 'firemen',       zone: 'Loading Dock',  status: 'active',   last: '8 min ago' },
    { name: 'Vikram Joshi',   email: 'vikram@niyantrak.com',   role: 'employee',      zone: 'WH-A Zone 2',   status: 'active',   last: '45 min ago' },
    { name: 'Meera Nair',     email: 'meera@niyantrak.com',    role: 'employee',      zone: 'WH-A Zone 3',   status: 'inactive', last: '5 days ago' },
];

const ROLE_COLORS = { admin: '#ff5722', employee: '#2196f3', firemen: '#f44336', safetyofficer: '#9c27b0' };

function renderUsersTable(filter = '') {
    const roleF   = document.getElementById('roleFilter')?.value || '';
    const statusF = document.getElementById('statusFilter')?.value || '';
    const tbody   = document.getElementById('usersTableBody');
    if (!tbody) return;

    let users = DEMO_USERS.filter(u => {
        const matchSearch = !filter || u.name.toLowerCase().includes(filter) || u.email.toLowerCase().includes(filter);
        const matchRole   = !roleF   || u.role === roleF;
        const matchStatus = !statusF || u.status === statusF;
        return matchSearch && matchRole && matchStatus;
    });

    if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:2rem">No users found</td></tr>'; return; }

    tbody.innerHTML = users.map((u, i) => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar" style="background:${ROLE_COLORS[u.role]}22;color:${ROLE_COLORS[u.role]}">${u.name[0]}</div>
                    ${u.name}
                </div>
            </td>
            <td style="color:#94a3b8">${u.email}</td>
            <td><span class="role-badge" style="background:${ROLE_COLORS[u.role]}22;color:${ROLE_COLORS[u.role]};border-color:${ROLE_COLORS[u.role]}44">${u.role}</span></td>
            <td>${u.zone}</td>
            <td><span class="status-dot ${u.status}"></span> ${u.status}</td>
            <td style="color:#94a3b8;font-size:0.85rem">${u.last}</td>
            <td>
                <div class="action-btns">
                    <button class="act-btn edit" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="act-btn del"  title="Disable" onclick="showToast('User disabled','warning')"><i class="fas fa-ban"></i></button>
                </div>
            </td>
        </tr>`).join('');
}

document.getElementById('userSearch')?.addEventListener('input', e => renderUsersTable(e.target.value.toLowerCase()));
document.getElementById('roleFilter')?.addEventListener('change', () => renderUsersTable(document.getElementById('userSearch')?.value.toLowerCase() || ''));
document.getElementById('statusFilter')?.addEventListener('change', () => renderUsersTable(document.getElementById('userSearch')?.value.toLowerCase() || ''));

// ── Alerts Admin Grid ─────────────────────
const DEMO_ALERTS = [
    { id: 1, zone: 'WH-A Zone 3', type: 'Fire',     temp: '78°C',  smoke: 'HIGH',   severity: 'critical', time: '2 min ago',  status: 'active' },
    { id: 2, zone: 'WH-A Zone 1', type: 'Smoke',    temp: '42°C',  smoke: 'MEDIUM', severity: 'high',     time: '18 min ago', status: 'active' },
    { id: 3, zone: 'Loading Dock',type: 'Temp High', temp: '55°C', smoke: 'LOW',    severity: 'medium',   time: '1 hr ago',   status: 'active' },
    { id: 4, zone: 'WH-B Zone 1', type: 'Smoke',    temp: '38°C',  smoke: 'LOW',    severity: 'low',      time: '3 hr ago',   status: 'resolved' },
    { id: 5, zone: 'Office Block', type: 'Sensor',   temp: '29°C', smoke: 'NONE',   severity: 'low',      time: '5 hr ago',   status: 'resolved' },
];

const SEV_COLORS = { critical: '#f44336', high: '#ff5722', medium: '#ff9800', low: '#4caf50' };

function renderAlertsGrid() {
    const grid = document.getElementById('alertsAdminGrid');
    if (!grid) return;
    grid.innerHTML = DEMO_ALERTS.map(a => `
        <div class="alert-admin-card ${a.severity}">
            <div class="aac-header">
                <span class="aac-type"><i class="fas fa-fire"></i> ${a.type}</span>
                <span class="aac-status ${a.status}">${a.status}</span>
            </div>
            <div class="aac-zone">${a.zone}</div>
            <div class="aac-metrics">
                <span style="color:${SEV_COLORS[a.severity]};font-size:1.6rem;font-weight:800">${a.temp}</span>
                <span class="aac-smoke">${a.smoke} Smoke</span>
            </div>
            <div class="aac-footer">
                <small>${a.time}</small>
                ${a.status === 'active'
                    ? `<button class="act-btn resolve" onclick="resolveAlert(${a.id},this)">Resolve</button>`
                    : `<span style="color:#4caf50;font-size:0.85rem"><i class="fas fa-check"></i> Resolved</span>`}
            </div>
        </div>`).join('');
}

function resolveAlert(id, btn) {
    const alert = DEMO_ALERTS.find(a => a.id === id);
    if (alert) { alert.status = 'resolved'; renderAlertsGrid(); showToast('Alert resolved successfully', 'success'); }
    const kpiEl = document.getElementById('activeAlerts');
    if (kpiEl) kpiEl.textContent = Math.max(0, (parseInt(kpiEl.textContent) || 1) - 1);
}

// ── Reports from localStorage ─────────────
function renderReportsTable() {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;
    const subs = JSON.parse(localStorage.getItem('niyantrak_submissions') || '[]');

    if (!subs.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:2rem">No reports yet — employees haven\'t submitted any</td></tr>';
        return;
    }

    const LABEL = { 'near-miss': 'Near Miss', unsafe: 'Unsafe Condition', permit: 'Work Permit', incident: 'Incident Report' };
    const SEV_MAP = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };

    tbody.innerHTML = subs.slice(0, 20).map(s => {
        const sev = s.severity || s.risk || 'submitted';
        const ts  = new Date(s.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        return `
        <tr>
            <td><span class="role-badge" style="background:rgba(255,87,34,0.15);color:#ff7043;border-color:rgba(255,87,34,0.3)">${LABEL[s.type] || s.type}</span></td>
            <td>Employee</td>
            <td>${s.zone || '—'}</td>
            <td><span class="sub-badge ${SEV_MAP[sev] || 'badge-info'}">${sev}</span></td>
            <td style="color:#94a3b8;font-size:0.85rem">${ts}</td>
            <td><span class="status-dot active"></span> Pending</td>
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
        const response = await fetch('http://localhost:5000/api/ai/sensor-fusion', {
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

        const response = await fetch('http://localhost:5000/api/alerts', {
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

        const response = await fetch('http://localhost:5000/api/compliance/logs', {
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
