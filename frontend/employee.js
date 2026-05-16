// ========================================
// NIYANTRAK — EMPLOYEE DASHBOARD JS
// ========================================

const STORAGE_KEY = 'niyantrak_submissions';

// ── Helpers ──────────────────────────────
function getSubmissions() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveSubmission(data) {
    const list = getSubmissions();
    list.unshift(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    renderSubmissions();
    updateKPIs();
}

function nowISO() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// ── Navigation ───────────────────────────
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${id}`);
    if (target) {
        target.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === id);
    });

    const titles = {
        dashboard: 'Employee Dashboard',
        'near-miss': 'Near Miss Report',
        unsafe: 'Unsafe Condition Report',
        permit: 'Work Permit Request',
        incident: 'Incident Report'
    };
    const navTitle = document.getElementById('navTitle');
    if (navTitle) navTitle.textContent = titles[id] || 'Employee Dashboard';

    // Set default datetime for all datetime inputs in newly shown section
    target?.querySelectorAll('input[type="datetime-local"]').forEach(el => {
        if (!el.value) el.value = nowISO();
    });
}

// Nav items (sidebar)
document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
});

// Quick report buttons (dashboard grid)
document.querySelectorAll('.report-btn[data-section], .back-btn[data-section], .btn-outline[data-section]').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
});

// ── Toast ─────────────────────────────────
function showToast(msg, type = 'success') {
    const icons = { success: 'fa-check-circle', warning: 'fa-exclamation-triangle', danger: 'fa-times-circle', error: 'fa-times-circle' };
    document.getElementById('toastIcon').className = `fas ${icons[type] || icons.success}`;
    document.getElementById('toastMsg').textContent = msg;
    const toast = document.getElementById('toast');
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── KPIs & Submissions render ─────────────
function updateKPIs() {
    const subs = getSubmissions();
    const nm = subs.filter(s => s.type === 'near-miss').length;
    const el = document.getElementById('nmCount');
    if (el) el.textContent = nm;
}

const TYPE_META = {
    'near-miss': { label: 'Near Miss Report',      icon: 'exclamation-circle', color: '#ff9800' },
    unsafe:      { label: 'Unsafe Condition',       icon: 'radiation',          color: '#f44336' },
    permit:      { label: 'Work Permit Request',    icon: 'file-signature',     color: '#4caf50' },
    incident:    { label: 'Incident Report',        icon: 'exclamation-triangle', color: '#ff5722' }
};

function severityBadge(val) {
    const map = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low', pending: 'badge-info', submitted: 'badge-info' };
    return `<span class="sub-badge ${map[val] || 'badge-info'}">${val || 'submitted'}</span>`;
}

function renderSubmissions() {
    const list = document.getElementById('submissionsList');
    if (!list) return;
    const subs = getSubmissions();
    if (!subs.length) {
        list.innerHTML = '<p class="empty-state"><i class="fas fa-inbox"></i><br>No submissions yet</p>';
        return;
    }
    list.innerHTML = subs.slice(0, 12).map(s => {
        const meta = TYPE_META[s.type] || { label: s.type, icon: 'file', color: '#94a3b8' };
        const loc  = s.zone || s.location || '—';
        const ts   = new Date(s.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        return `
        <div class="submission-item">
            <div class="sub-icon" style="color:${meta.color}"><i class="fas fa-${meta.icon}"></i></div>
            <div class="sub-info">
                <strong>${meta.label}</strong>
                <span>${loc}</span>
            </div>
            <div class="sub-meta">
                ${severityBadge(s.severity || s.risk || 'submitted')}
                <small>${ts}</small>
            </div>
        </div>`;
    }).join('');
}

// ── File upload (Unsafe Condition) ────────
const ucFileUpload = document.getElementById('ucFileUpload');
const ucFileInput  = document.getElementById('ucFileInput');
const ucFilePreview = document.getElementById('ucFilePreview');

ucFileUpload?.addEventListener('click', () => ucFileInput?.click());
ucFileUpload?.addEventListener('dragover', e => { e.preventDefault(); ucFileUpload.classList.add('dragover'); });
ucFileUpload?.addEventListener('dragleave', () => ucFileUpload.classList.remove('dragover'));
ucFileUpload?.addEventListener('drop', e => { e.preventDefault(); ucFileUpload.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
ucFileInput?.addEventListener('change', e => handleFiles(e.target.files));

function handleFiles(files) {
    if (!ucFilePreview) return;
    ucFilePreview.innerHTML = '';
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            ucFilePreview.innerHTML += `
            <div class="file-thumb">
                <img src="${ev.target.result}" alt="${file.name}">
                <span>${file.name.length > 14 ? file.name.slice(0,12)+'…' : file.name}</span>
            </div>`;
        };
        reader.readAsDataURL(file);
    });
}

// ── Form: Near Miss ───────────────────────
document.getElementById('nearMissForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const severity = document.getElementById('nm-severity').value;
    const zone     = document.getElementById('nm-zone').value;
    const desc     = document.getElementById('nm-description').value.trim();
    if (!severity || !zone || !desc) { showToast('Please fill all required fields', 'error'); return; }

    saveSubmission({
        type: 'near-miss',
        datetime: document.getElementById('nm-datetime').value,
        severity,
        zone,
        people: document.getElementById('nm-people').value,
        description: desc,
        action: document.getElementById('nm-action').value,
        prevention: document.getElementById('nm-prevention').value,
        timestamp: Date.now(),
        status: 'pending'
    });

    showToast('Near Miss Report submitted successfully!', 'success');
    this.reset();
    setTimeout(() => showSection('dashboard'), 1600);
});

// ── Form: Unsafe Condition ────────────────
document.getElementById('unsafeForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const risk   = document.getElementById('uc-risk').value;
    const hazard = document.getElementById('uc-hazard').value;
    const zone   = document.getElementById('uc-zone').value;
    const desc   = document.getElementById('uc-description').value.trim();
    if (!risk || !hazard || !zone || !desc) { showToast('Please fill all required fields', 'error'); return; }

    saveSubmission({
        type: 'unsafe',
        datetime: document.getElementById('uc-datetime').value,
        risk, hazard, zone, description: desc,
        timestamp: Date.now(),
        status: 'pending'
    });

    showToast('Unsafe Condition Report submitted!', 'warning');
    this.reset();
    if (ucFilePreview) ucFilePreview.innerHTML = '';
    setTimeout(() => showSection('dashboard'), 1600);
});

// ── Form: Work Permit ─────────────────────
document.getElementById('permitForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const type  = document.getElementById('wp-type').value;
    const zone  = document.getElementById('wp-zone').value;
    const start = document.getElementById('wp-start').value;
    const end   = document.getElementById('wp-end').value;
    const desc  = document.getElementById('wp-description').value.trim();

    if (!type || !zone || !start || !end || !desc) { showToast('Please fill all required fields', 'error'); return; }
    if (new Date(end) <= new Date(start)) { showToast('End time must be after start time', 'error'); return; }

    const checkedMeasures = [...document.querySelectorAll('input[name="wp-safety"]:checked')]
        .map(cb => cb.parentElement.textContent.trim());

    saveSubmission({
        type: 'permit',
        workType: type, zone,
        start, end, description: desc,
        tools: document.getElementById('wp-tools').value,
        safetyMeasures: checkedMeasures,
        workers: document.getElementById('wp-workers').value,
        timestamp: Date.now(),
        status: 'pending'
    });

    showToast('Work Permit submitted for approval!', 'success');
    this.reset();
    setTimeout(() => showSection('dashboard'), 1600);
});

// ── Form: Incident Report ─────────────────
document.getElementById('incidentForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const incType = document.getElementById('inc-type').value;
    const zone    = document.getElementById('inc-zone').value;
    const desc    = document.getElementById('inc-description').value.trim();
    const actions = document.getElementById('inc-actions').value.trim();
    const injury  = document.querySelector('input[name="inc-injury"]:checked')?.value;

    if (!incType || !zone || !desc || !actions) { showToast('Please fill all required fields', 'error'); return; }
    if (!injury) { showToast('Please select injury status', 'error'); return; }

    saveSubmission({
        type: 'incident',
        datetime: document.getElementById('inc-datetime').value,
        incidentType: incType, zone,
        persons: document.getElementById('inc-persons').value,
        injury,
        medical: document.querySelector('input[name="inc-medical"]:checked')?.value || 'none',
        description: desc, actions,
        damage: document.getElementById('inc-damage').value,
        timestamp: Date.now(),
        status: 'pending'
    });

    showToast('Incident Report submitted. Supervisor notified.', 'danger');
    this.reset();
    setTimeout(() => showSection('dashboard'), 1600);
});

// ── Init ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Set user name from session
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const nameEl = document.getElementById('userName');
    if (nameEl && user.email) nameEl.textContent = user.email.split('@')[0];

    // Default datetimes on visible section
    document.querySelectorAll('#section-dashboard input[type="datetime-local"]').forEach(el => {
        el.value = nowISO();
    });

    renderSubmissions();
    updateKPIs();
});