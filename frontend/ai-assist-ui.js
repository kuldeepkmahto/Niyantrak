/* ── AI ASSIST (frontend, extracted from employee.js) ──
   This is the piece that calls POST /api/ai/triage and renders
   the suggestion box + "Apply suggested severity" button.
   It depends on getAiTriage() living in api.js (see NOTE below). */

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

/* ============================================================
   NOTE — api.js was not present in the uploaded project zip.
   Your HTML pages (<script src="api.js">) expect it to export
   at least these functions used by the AI features:

     - apiFetch(path, options)        // fetch wrapper with auth header
     - getAiTriage({ description })   // POST /api/ai/triage
     - getCurrentUser()
     - requireAuth(role)
     - submitIncidentReport(payload, files)

   A minimal getAiTriage would look like:

     async function getAiTriage({ description, type, zone }) {
       return apiFetch('/ai/triage', {
         method: 'POST',
         body: JSON.stringify({ description, type, zone }),
       });
     }

   If you don't have api.js anymore, let me know and I can
   reconstruct it from how employee.js / firemen.js / admin.js
   call it.
   ============================================================ */
