// ── Navigation ────────────────────────────
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${id}`);
    if (target) { target.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => btn.classList.toggle('active', btn.dataset.section === id));
}

document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', () => showSection(el.dataset.section));
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Logout?')) { localStorage.clear(); sessionStorage.clear(); window.location.href = 'login.html'; }
});

// ── Toast ─────────────────────────────────
function showToast(msg, type = 'success') {
    const icons = { success: 'fa-check-circle', warning: 'fa-exclamation-triangle', danger: 'fa-times-circle' };
    document.getElementById('toastIcon').className = `fas ${icons[type] || icons.success}`;
    document.getElementById('toastMsg').textContent = msg;
    const t = document.getElementById('toast');
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3500);
}

// ── Checklist data ────────────────────────
const CHECKLISTS = {
    preshift: [
        { label: 'Check in with team leader', priority: 'high' },
        { label: 'Verify shift handover notes', priority: 'high' },
        { label: 'Confirm zone assignments', priority: 'med' },
        { label: 'Test personal radio / comms', priority: 'high' },
        { label: 'Inspect personal PPE (helmet, gloves, suit)', priority: 'high' },
        { label: 'Verify emergency exits are clear', priority: 'med' },
        { label: 'Check fire sensor status on dashboard', priority: 'high' },
        { label: 'Review any overnight incident reports', priority: 'med' },
        { label: 'Confirm fire truck readiness', priority: 'high' },
        { label: 'Sign shift start log', priority: 'low' },
    ],
    equipment: [
        { label: 'Hose #1 — Pressure & integrity OK', priority: 'high' },
        { label: 'Hose #2 — Pressure & integrity OK', priority: 'high' },
        { label: 'Hose #3 — Flag for service if needed', priority: 'high' },
        { label: 'Fire extinguisher #A — Charged & tagged', priority: 'high' },
        { label: 'Fire extinguisher #B — Charged & tagged', priority: 'high' },
        { label: 'SCBA (breathing apparatus) — Cylinder full', priority: 'high' },
        { label: 'Thermal imaging camera — Battery OK', priority: 'med' },
        { label: 'Rescue rope — No frays or damage', priority: 'med' },
        { label: 'First aid kit — Stocked & dated', priority: 'high' },
        { label: 'Ladder — Locks functional', priority: 'med' },
        { label: 'Vehicle fuel level above 75%', priority: 'low' },
        { label: 'Vehicle horn, lights, sirens functional', priority: 'low' },
    ],
    postshift: [
        { label: 'Submit all incident reports', priority: 'high' },
        { label: 'Upload all photos taken during shift', priority: 'high' },
        { label: 'Restock used first aid supplies', priority: 'med' },
        { label: 'Refill any discharged extinguishers', priority: 'high' },
        { label: 'Coil and store all hoses', priority: 'med' },
        { label: 'Recharge SCBA cylinders if used', priority: 'high' },
        { label: 'Brief incoming team on any issues', priority: 'high' },
        { label: 'Log any equipment requiring maintenance', priority: 'med' },
        { label: 'Sign shift end log', priority: 'low' },
    ]
};

const checklistState = { preshift: {}, equipment: {}, postshift: {} };

function renderChecklist(key) {
    const container = document.getElementById(`cl-${key}`);
    if (!container) return;
    const items = CHECKLISTS[key];

    container.innerHTML = items.map((item, i) => {
        const checked = checklistState[key][i] || false;
        return `
        <div class="cl-item ${checked ? 'checked' : ''}" onclick="toggleCheck('${key}', ${i}, this)">
            <div class="cl-checkbox">${checked ? '<i class="fas fa-check"></i>' : ''}</div>
            <span class="cl-label">${item.label}</span>
            <span class="cl-priority ${item.priority === 'high' ? 'high' : item.priority === 'med' ? 'med' : 'low'}">${item.priority === 'high' ? 'Required' : item.priority === 'med' ? 'Important' : 'Optional'}</span>
        </div>`;
    }).join('');

    updateProgress(key);
}

function toggleCheck(key, idx, el) {
    checklistState[key][idx] = !checklistState[key][idx];
    el.classList.toggle('checked');
    const checked = checklistState[key][idx];
    el.querySelector('.cl-checkbox').innerHTML = checked ? '<i class="fas fa-check"></i>' : '';
    el.querySelector('.cl-label').style.textDecoration = checked ? 'line-through' : 'none';
    el.querySelector('.cl-label').style.color = checked ? '#94a3b8' : '';
    updateProgress(key);
    saveChecklistState();
}

function updateProgress(key) {
    const items = CHECKLISTS[key];
    const done  = Object.values(checklistState[key]).filter(Boolean).length;
    const pct   = Math.round((done / items.length) * 100);
    const fill  = document.getElementById(`${key.slice(0,4)}-fill`) || document.getElementById(`${key === 'equipment' ? 'equip' : key === 'postshift' ? 'post' : 'pre'}-fill`);
    const text  = document.getElementById(`${key === 'equipment' ? 'equip' : key === 'postshift' ? 'post' : 'pre'}-text`);
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = pct + '%';
    updateDashboardSummary();
    renderChecklistAnalysis(key);
}

function updateDashboardSummary() {
    const all = ['preshift','equipment','postshift'];
    let total = 0, done = 0;
    all.forEach(k => {
        total += CHECKLISTS[k].length;
        done  += Object.values(checklistState[k]).filter(Boolean).length;
    });
    const el = document.getElementById('checklistSummary');
    if (el) el.textContent = done === 0 ? 'Not started' : `${done}/${total} items done`;
}

function resetChecklist(key) {
    checklistState[key] = {};
    renderChecklist(key);
    saveChecklistState();
}

async function submitChecklist(key) {
    const items   = CHECKLISTS[key];
    const done    = Object.values(checklistState[key]).filter(Boolean).length;
    const required = items.filter(i => i.priority === 'high').length;
    const doneReq  = items.filter((item, i) => item.priority === 'high' && checklistState[key][i]).length;

    if (doneReq < required) {
        showToast(`${required - doneReq} required item(s) still unchecked`, 'warning');
        return;
    }

    const checkedItems = items.map((item, i) => ({
        label: item.label,
        priority: item.priority,
        checked: Boolean(checklistState[key][i]),
    }));

    const submitBtn = document.querySelector(`#tab-${key} .cl-submit-btn`);
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing…'; }

    try {
        const { ok, data } = await apiFetch('/ai/analyze-checklist', {
            method: 'POST',
            body: JSON.stringify({ checklistType: key, items: checkedItems, shiftDate: new Date().toISOString() }),
        });

        if (ok && data?.data) {
            renderServerChecklistAnalysis(key, data.data);
            showToast(`Checklist submitted! AI risk score: ${data.data.riskScore}/100 (${data.data.riskLevel}).`,
                data.data.riskLevel === 'critical' || data.data.riskLevel === 'high' ? 'warning' : 'success');
        } else {
            // Backend unreachable or errored — fall back to local heuristic so
            // the fireman still gets useful feedback offline.
            const entry = getCurrentChecklistEntry(key);
            saveChecklistHistoryEntry(entry);
            renderChecklistAnalysis(key);
            showToast(`Checklist saved locally (server unavailable). ${done}/${items.length} items completed.`, 'warning');
        }
    } catch (err) {
        const entry = getCurrentChecklistEntry(key);
        saveChecklistHistoryEntry(entry);
        renderChecklistAnalysis(key);
        showToast('Could not reach the server — checklist saved locally instead.', 'warning');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-check"></i> Submit Checklist'; }
    }
}
function renderServerChecklistAnalysis(key, result) {
    const summaryEl = document.getElementById(`analysis-${key}-summary`);
    const detailsEl = document.getElementById(`analysis-${key}-details`);
    const statusClass = result.riskLevel === 'critical' || result.riskLevel === 'high' ? 'threat'
        : result.riskLevel === 'medium' ? 'warning' : 'safe';

    if (summaryEl) {
        summaryEl.textContent = `${result.riskLabel} — AI Risk Score: ${result.riskScore}/100`;
        summaryEl.className = `analysis-summary ${statusClass}`;
    }
    if (detailsEl) {
        const items = [...(result.flags || []), ...(result.recommendations || [])];
        detailsEl.innerHTML = items.length
            ? items.map(d => `<li>${d}</li>`).join('')
            : '<li>No issues detected — checklist is in good shape.</li>';
    }
}

function saveChecklistState() {
    localStorage.setItem('niyantrak_checklists', JSON.stringify(checklistState));
}

const CHECKLIST_HISTORY_KEY = 'niyantrak_checklist_history';

function getChecklistHistory() {
    return JSON.parse(localStorage.getItem(CHECKLIST_HISTORY_KEY) || '[]');
}

function saveChecklistHistory(history) {
    localStorage.setItem(CHECKLIST_HISTORY_KEY, JSON.stringify(history.slice(-12)));
}

function saveChecklistHistoryEntry(entry) {
    const history = getChecklistHistory();
    history.push(entry);
    saveChecklistHistory(history);
}

function getCurrentChecklistEntry(key) {
    const items = CHECKLISTS[key];
    const checkedItems = items.map((item, i) => ({
        label: item.label,
        priority: item.priority,
        checked: Boolean(checklistState[key][i]),
    }));
    const requiredTotal = items.filter(i => i.priority === 'high').length;
    const requiredDone = checkedItems.filter(i => i.priority === 'high' && i.checked).length;
    const completedCount = checkedItems.filter(i => i.checked).length;
    const missedLabels = checkedItems.filter(i => i.priority === 'high' && !i.checked).map(i => i.label);
    return {
        key,
        timestamp: new Date().toISOString(),
        totalCount: items.length,
        completedCount,
        completionPct: items.length ? Math.round((completedCount / items.length) * 100) : 0,
        requiredTotal,
        requiredDone,
        requiredPct: requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : 100,
        missedLabels,
    };
}

function computeChecklistHistoryAnalysis(key, current) {
    const history = getChecklistHistory().filter(item => item.key === key);
    const lastEntry = history[history.length - 1];
    const details = [];
    let status = 'safe';
    let title = 'Checklist is stable compared to your recent history.';

    if (!lastEntry) {
        title = 'No previous checklist submission found for this type yet.';
        details.push('Submit your first checklist to build a safe comparison baseline.');
        return { status, title, details };
    }

    const decline = lastEntry.completionPct - current.completionPct;
    const requiredDrop = lastEntry.requiredPct - current.requiredPct;
    const repeatedCount = {};
    history.slice(-3).forEach(item => {
        (item.missedLabels || []).forEach(label => {
            repeatedCount[label] = (repeatedCount[label] || 0) + 1;
        });
    });
    const repeatedLabels = Object.entries(repeatedCount).filter(([, count]) => count >= 2);

    details.push(`Last submission: ${lastEntry.completionPct}% complete, ${lastEntry.requiredPct}% required completion on ${new Date(lastEntry.timestamp).toLocaleDateString()}.`);

    if (current.missedLabels.length) {
        details.push(`Missing required items: ${current.missedLabels.join(', ')}.`);
    }

    if (decline > 0) {
        details.push(`Completion dropped ${decline}% since last submission (${lastEntry.completionPct}% → ${current.completionPct}%).`);
    }

    if (requiredDrop > 0) {
        details.push(`Required completion dropped ${requiredDrop}% since last submission.`);
    }

    if (repeatedLabels.length) {
        repeatedLabels.forEach(([label, count]) => {
            details.push(`Repeated miss: "${label}" was skipped ${count} times in the last ${Math.min(history.length, 3)} submissions.`);
        });
    }

    if (current.completionPct < 80 || current.requiredPct < 100 || repeatedLabels.length || decline >= 15 || requiredDrop >= 15) {
        status = 'warning';
        title = 'Warning: Checklist shows weaker safety coverage than your recent submissions.';
    }

    if (current.completionPct < 70 || current.requiredPct < 90 || (repeatedLabels.length && current.missedLabels.length)) {
        status = 'threat';
        title = 'Threat detected: Current checklist raises significant safety concern.';
    }

    if (details.length === 1) {
        details.push('No additional risks found compared to the last submission. Keep the checklist complete.');
    }

    return { status, title, details };
}

function renderChecklistAnalysis(key) {
    const current = getCurrentChecklistEntry(key);
    const analysis = computeChecklistHistoryAnalysis(key, current);
    const summaryEl = document.getElementById(`analysis-${key}-summary`);
    const detailsEl = document.getElementById(`analysis-${key}-details`);

    if (summaryEl) {
        summaryEl.textContent = analysis.title;
        summaryEl.className = `analysis-summary ${analysis.status}`;
    }
    if (detailsEl) {
        detailsEl.innerHTML = analysis.details.map(detail => `<li>${detail}</li>`).join('');
    }
}

// ── Checklist tabs ─────────────────────────
document.querySelectorAll('.cl-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.cl-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.checklist-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
    });
});

// ── Photo upload ──────────────────────────
const photoDropZone = document.getElementById('photoDropZone');
const photoInput    = document.getElementById('photoInput');
const photoGrid     = document.getElementById('photoGrid');

photoDropZone?.addEventListener('dragover', e => { e.preventDefault(); photoDropZone.classList.add('dragover'); });
photoDropZone?.addEventListener('dragleave', () => photoDropZone.classList.remove('dragover'));
photoDropZone?.addEventListener('drop', e => { e.preventDefault(); photoDropZone.classList.remove('dragover'); handlePhotos(e.dataTransfer.files); });
photoInput?.addEventListener('change', e => handlePhotos(e.target.files));

function handlePhotos(files) {
    if (!photoGrid) return;
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `<img src="${ev.target.result}" alt="${file.name}"><div class="photo-item-label">${file.name.slice(0,18)}</div>`;
            photoGrid.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

// ── Init ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth('firemen')) return;
    loadChecklistState();
    renderChecklist('preshift');
    renderChecklist('equipment');
    renderChecklist('postshift');
    updateDashboardSummary();
    renderChecklistAnalysis('preshift');
    renderChecklistAnalysis('equipment');
    renderChecklistAnalysis('postshift');

    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const nameEl = document.getElementById('userName');
    if (nameEl && user.email) nameEl.textContent = user.email.split('@')[0];
});
function loadChecklistState() {
    const saved = JSON.parse(localStorage.getItem('niyantrak_checklists') || '{}');
    Object.assign(checklistState, saved);
}