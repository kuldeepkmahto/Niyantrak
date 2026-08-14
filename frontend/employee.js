/* ── MODAL ── */
function openModal(id) {
    document.getElementById(`modal-${id}`).classList.add('open');
    document.body.style.overflow = 'hidden';
    if (id === 'nearMiss') nmReset();
}
function closeModal(id) {
    document.getElementById(`modal-${id}`).classList.remove('open');
    document.body.style.overflow = '';
}
function overlayClose(e, id) {
    if (e.target === document.getElementById(`modal-${id}`)) closeModal(id);
}
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

/* ── SEVERITY ── */
function pickSev(el, grp) {
    document.querySelectorAll(`#${grp} .sev-pill`).forEach(p => { p.className = 'sev-pill'; });
    el.classList.add(`sel-${el.dataset.sev}`);
}
function togglePill(el, grp) {
    const wasOn = el.classList.contains('sel-toggle');
    document.querySelectorAll(`#${grp} .sev-pill`).forEach(p => p.classList.remove('sel-toggle'));
    if (!wasOn) el.classList.add('sel-toggle');
}

/* ── NEAR MISS STEPS ── */
let nmCur = 1;
const NM_MAX = 3;

function nmReset() { nmCur = 1; nmRender(); }
function nmNav(d) {
    if (d === 1 && !nmValidate()) return;
    nmCur = Math.max(1, Math.min(NM_MAX, nmCur + d));
    nmRender();
}
function nmValidate() {
    if (nmCur === 1) {
        if (!document.getElementById('nm-date').value)       { toast('Please select the date of incident','error'); return false; }
        if (!document.getElementById('nm-time').value)       { toast('Please enter the time','error');             return false; }
        if (!document.getElementById('nm-loc').value)        { toast('Please select a location','error');          return false; }
        if (!document.getElementById('nm-what').value.trim()){ toast('Please describe what happened','error');     return false; }
    }
    return true;
}
function nmRender() {
    for (let i = 1; i <= NM_MAX; i++) {
        const p = document.getElementById(`nm-p${i}`);
        if (p) p.style.display = i === nmCur ? 'block' : 'none';
    }
    document.querySelectorAll('#nm-steps .step-item').forEach((s, i) => {
        s.className = 'step-item';
        if (i + 1 < nmCur) s.classList.add('done');
        else if (i + 1 === nmCur) s.classList.add('active');
        s.querySelector('.step-dot').innerHTML = i + 1 < nmCur ? '<i class="fas fa-check" style="font-size:.65rem"></i>' : (i + 1);
    });
    document.getElementById('nm-prev').style.display = nmCur > 1 ? 'flex' : 'none';
    document.getElementById('nm-next').style.display = nmCur < NM_MAX ? 'flex' : 'none';
    document.getElementById('nm-sub').style.display  = nmCur === NM_MAX ? 'flex' : 'none';
}

/* ── SUBMIT ── */
function getCheckedValues(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)).map(cb => cb.value);
}
function getSelectedSeverity(groupId) {
    const el = document.querySelector(`#${groupId} .sev-pill[class*="sel-"]`);
    return el ? el.dataset.sev : null;
}
function splitPersons(value) {
    return (value || '').split(',').map(s => s.trim()).filter(Boolean);
}

async function submitForm(label, modalId) {
    const user = getCurrentUser();
    let payload = null;
    let filesInput = null;

    if (modalId === 'nearMiss') {
        const date = document.getElementById('nm-date').value;
        const time = document.getElementById('nm-time').value;
        const loc  = document.getElementById('nm-loc').value;
        const what = document.getElementById('nm-what').value.trim();
        const sev  = getSelectedSeverity('nm-sev');
        if (!date || !time || !loc || !what) { toast('Please fill all required fields on step 1', 'error'); return; }
        if (!sev) { toast('Please select a severity level', 'error'); return; }
        filesInput = document.getElementById('nm-files');
        payload = {
            type: 'near-miss',
            location: loc, zone: loc,
            description: what,
            severity: sev,
            incidentDate: new Date(`${date}T${time}`).toISOString(),
            nearMiss: {
                whatHappened: what,
                contributingFactors: getCheckedValues('nm-factors'),
                immediateAction: document.getElementById('nm-action').value.trim(),
                preventiveSuggestion: document.getElementById('nm-prevention').value.trim(),
                personsInvolved: splitPersons(document.getElementById('nm-persons').value),
            },
        };
    } else if (modalId === 'unsafe') {
        const hazard = document.getElementById('uc-hazard').value;
        const loc    = document.getElementById('uc-loc').value;
        const desc   = document.getElementById('uc-desc').value.trim();
        const sev    = getSelectedSeverity('unsafe-sev');
        if (!hazard || !loc || !desc) { toast('Please fill all required fields', 'error'); return; }
        if (!sev) { toast('Please select a risk level', 'error'); return; }
        const areaStatusEl = document.querySelector('#area-status .sev-pill.sel-toggle');
        filesInput = document.getElementById('uc-files');
        payload = {
            type: 'unsafe-condition',
            location: loc, zone: loc,
            description: desc,
            severity: sev,
            unsafeCondition: {
                hazardType: hazard,
                areaStatus: areaStatusEl ? areaStatusEl.textContent.trim() : '',
                immediateAction: document.getElementById('uc-action').value.trim(),
            },
        };
    } else if (modalId === 'permit') {
        const type  = document.getElementById('wp-type').value;
        const zone  = document.getElementById('wp-zone').value;
        const start = document.getElementById('wp-start').value;
        const end   = document.getElementById('wp-end').value;
        const desc  = document.getElementById('wp-desc').value.trim();
        const requester   = document.getElementById('wp-requester').value.trim();
        const supervisor  = document.getElementById('wp-supervisor').value.trim();
        if (!type || !zone || !start || !end || !desc || !requester || !supervisor) { toast('Please fill all required fields', 'error'); return; }
        if (new Date(end) <= new Date(start)) { toast('End time must be after start time', 'error'); return; }
        const safety = getCheckedValues('wp-safety');
        if (!safety.length) { toast('Please confirm at least one safety precaution', 'error'); return; }
        payload = {
            type: 'work-permit',
            location: zone, zone,
            description: desc,
            severity: 'medium',
            workPermit: {
                permitType: type,
                startDateTime: new Date(start).toISOString(),
                endDateTime: new Date(end).toISOString(),
                supervisorName: supervisor,
                numWorkers: parseInt(document.getElementById('wp-workers').value) || 1,
                safetyChecks: safety,
            },
        };
    } else if (modalId === 'incident') {
        const date = document.getElementById('inc-date').value;
        const time = document.getElementById('inc-time').value;
        const type = document.getElementById('inc-type').value;
        const loc  = document.getElementById('inc-loc').value;
        const desc = document.getElementById('inc-desc').value.trim();
        const sev  = getSelectedSeverity('inc-sev');
        if (!date || !time || !type || !loc || !desc) { toast('Please fill all required fields', 'error'); return; }
        if (!sev) { toast('Please select a severity', 'error'); return; }
        filesInput = document.getElementById('inc-files');
        payload = {
            type: 'incident-report',
            location: loc, zone: loc,
            description: desc,
            severity: sev,
            incidentDate: new Date(`${date}T${time}`).toISOString(),
            incidentReport: {
                incidentType: type,
                personsInvolved: splitPersons(document.getElementById('inc-persons').value),
                injuriesOrDamage: document.getElementById('inc-damage').value.trim(),
                responseActions: getCheckedValues('inc-actions'),
            },
        };
    }

    if (!payload) return;

    const submitBtn = document.querySelector(`#modal-${modalId} .btn-submit`);
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.7'; }

    try {
        const { ok, data } = await submitIncidentReport(payload, filesInput?.files);
        if (ok) {
            toast(`${label} submitted successfully!`, 'success');
            setTimeout(() => closeModal(modalId), 400);
            if (modalId === 'nearMiss') nmReset();
            loadDashboardSummary();
        } else {
            toast(data?.message || `Could not submit ${label}. Is the backend running?`, 'error');
        }
    } catch (err) {
        toast('Could not reach the server. Check that the backend is running.', 'error');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }
    }
}

/* ── AI ASSIST ── */
async function runAiAssist(descId, sevGroupId, boxId) {
    const desc = document.getElementById(descId).value.trim();
    const box  = document.getElementById(boxId);
    if (!desc) { toast('Write a description first so AI has something to analyze', 'warning'); return; }

    const btn = event.target.closest('button');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing…'; }
    box.style.display = 'block';
    box.innerHTML = 'Analyzing description…';

    try {
        const { ok, data } = await getAiTriage({ description: desc });
        if (!ok || !data) { box.innerHTML = 'AI Assist unavailable right now — please select severity manually.'; return; }
        const r = data.data;
        const risksHtml = r.keyRisks?.length ? `<div style="margin-top:0.4rem">Key risks: ${r.keyRisks.join(', ')}</div>` : '';
        box.innerHTML = `
            <div class="ai-tag"><i class="fas fa-wand-magic-sparkles"></i> AI Suggestion (${r.source === 'llm' ? 'Claude' : 'heuristic'})</div>
            <div>Suggested severity: <strong>${r.suggestedSeverity}</strong> · Category: <strong>${r.hazardCategory}</strong></div>
            <div style="margin-top:0.3rem;color:#94a3b8">${r.summary || ''}</div>
            ${risksHtml}
            ${sevGroupId ? `<button type="button" class="ai-apply-btn" onclick="applySuggestedSeverity('${sevGroupId}','${r.suggestedSeverity}')">Apply suggested severity</button>` : ''}
        `;
    } catch (err) {
        box.innerHTML = 'AI Assist unavailable right now — please select severity manually.';
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> AI Assist: suggest severity'; }
    }
}

function applySuggestedSeverity(groupId, severity) {
    const pill = document.querySelector(`#${groupId} .sev-pill[data-sev="${severity}"]`);
    if (pill) pickSev(pill, groupId);
}

/* ── DASHBOARD SUMMARY (real data) ── */
async function loadDashboardSummary() {
    const { ok, data } = await apiFetch('/incidents?limit=100');
    if (!ok || !data) return;
    const list = data.data || [];
    const nearMissCount = list.filter(i => i.type === 'near-miss').length;
    const pendingPermits = list.filter(i => i.type === 'work-permit' && i.workPermit?.approvalStatus === 'pending').length;
    const nmEl = document.querySelector('.kpi-card.info .kpi-value');
    const wpEl = document.querySelector('.kpi-card.warning .kpi-value');
    if (nmEl) nmEl.textContent = nearMissCount;
    if (wpEl) wpEl.textContent = pendingPermits;
}

/* ── TOAST ── */
function toast(msg, type = 'success') {
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas ${icons[type]}" style="font-size:1.1rem;color:${type==='success'?'#4caf50':type==='error'?'#f44336':'#ff9800'}"></i><span>${msg}</span>`;
    document.getElementById('toast-wrap').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 3800);
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth('employee')) return;
    const user = getCurrentUser();
    if (user.email) document.getElementById('empName').textContent = (user.fullname || user.email.split('@')[0]);
    const today = new Date().toISOString().split('T')[0];
    const nmDate = document.getElementById('nm-date');
    if (nmDate) nmDate.value = today;
    const incDate = document.getElementById('inc-date');
    if (incDate) incDate.value = today;
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) { localStorage.clear(); sessionStorage.clear(); window.location.href = 'login.html'; }
    });
    loadDashboardSummary();
});