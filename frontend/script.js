// ========================================
// NIYANTRAK - ENTERPRISE FIRE SAFETY SYSTEM
// Universal JavaScript Logic for All Pages
// ========================================

const API_BASE = 'http://localhost:5000/api';

// Demo credentials (fallback)
const DEMO_USERS = {
    'test@admin.com': { password: '123', role: 'admin' },
    'test@employee.com': { password: '123', role: 'employee' },
    'test@firemen.com': { password: '123', role: 'firemen' }
};

// Universal page initialization
document.addEventListener('DOMContentLoaded', function() {
    initPage();
    
    // Auto-hide success messages
    const messages = document.querySelectorAll('#message.success');
    messages.forEach(msg => {
        setTimeout(() => {
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 300);
        }, 3000);
    });
});

// Main page initialization
function initPage() {
    if (document.getElementById('loginForm')) initLogin();
    if (document.getElementById('signupForm')) initSignup();
    if (document.querySelector('.dashboard-container')) initDashboard();
    if (document.querySelector('.hero')) initLanding();
}

// ========================================
// LANDING PAGE (index.html)
function initLanding() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    const sensorBtn = document.getElementById('runSensorFusionBtn');
    if (sensorBtn) sensorBtn.addEventListener('click', runSensorFusionDemo);

    const complianceBtn = document.getElementById('submitComplianceBtn');
    if (complianceBtn) complianceBtn.addEventListener('click', submitComplianceDemo);
}

async function runSensorFusionDemo() {
    const resultEl = document.getElementById('sensorFusionResult');
    if (!resultEl) return;

    const payload = {
        smokePPM: parseFloat(document.getElementById('smokePPM').value) || 0,
        temperature: parseFloat(document.getElementById('temperature').value) || 0,
        carbonMonoxide: parseFloat(document.getElementById('carbonMonoxide').value) || 0,
        soundLevel: parseFloat(document.getElementById('soundLevel').value) || 0,
        cameraAlert: document.getElementById('cameraAlert').checked,
        zone: document.getElementById('demoZone').value.trim(),
        location: document.getElementById('demoLocation').value.trim(),
    };

    resultEl.textContent = 'Running scan...';

    try {
        const response = await fetch(`${API_BASE}/ai/sensor-fusion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        renderSensorFusionResult(data.data);
    } catch (err) {
        renderSensorFusionResult(simulateSensorFusion(payload), true);
    }
}

function simulateSensorFusion(payload) {
    let score = 0;
    const flags = [];
    if (payload.smokePPM >= 35) { score += 30; flags.push('Smoke levels above safe threshold.'); }
    if (payload.temperature >= 55) { score += 30; flags.push('High temperature detected near hazard threshold.'); }
    if (payload.carbonMonoxide >= 50) { score += 20; flags.push('Elevated carbon monoxide concentration detected.'); }
    if (payload.soundLevel >= 85) { score += 10; flags.push('Unusual acoustic signature detected in the area.'); }
    if (payload.cameraAlert) { score += 20; flags.push('Vision model flagged a potential fire or smoke event.'); }
    score = Math.min(100, score);
    const riskLevel = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 25 ? 'medium' : 'low';
    const riskLabel = riskLevel === 'critical' ? '🔴 Critical Hazard' : riskLevel === 'high' ? '🟠 High Hazard' : riskLevel === 'medium' ? '🟡 Medium Hazard' : '🟢 Low Hazard';
    return { score, riskLevel, riskLabel, flags, sensorReadings: payload, zone: payload.zone, location: payload.location, analyzedAt: new Date().toISOString() };
}

function renderSensorFusionResult(result, offline = false) {
    const resultEl = document.getElementById('sensorFusionResult');
    if (!resultEl) return;
    const statusClass = `status-${result.riskLevel}`;
    resultEl.innerHTML = `
        <strong>${result.riskLabel}</strong>
        <div class="demo-status ${statusClass}">${offline ? 'Demo output' : 'Live API output'}</div>
        <p><strong>Score:</strong> ${result.score}/100</p>
        <p><strong>Zone:</strong> ${result.zone || 'Unknown'}</p>
        <p><strong>Location:</strong> ${result.location || 'Not provided'}</p>
        <p><strong>Flags:</strong> ${result.flags.length ? result.flags.join(' ') : 'No immediate hazards detected.'}</p>
    `;
}

async function submitComplianceDemo() {
    const resultEl = document.getElementById('complianceResult');
    if (!resultEl) return;

    const payload = {
        zone: document.getElementById('compZone').value.trim(),
        standard: document.getElementById('compStandard').value,
        status: document.getElementById('compStatus').value,
        completionPct: parseFloat(document.getElementById('completionPct').value) || 0,
        requiredPct: parseFloat(document.getElementById('requiredPct').value) || 0,
        notes: document.getElementById('compNotes').value.trim(),
    };

    resultEl.textContent = 'Submitting compliance log...';

    try {
        const response = await fetch(`${API_BASE}/compliance/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        resultEl.innerHTML = `<strong>Compliance log stored successfully.</strong><br><p>ID: ${data.data._id || 'N/A'}</p><p>Status: ${data.data.status}</p><p>Standard: ${data.data.standard}</p>`;
    } catch (err) {
        resultEl.innerHTML = `<strong>Demo compliance log saved.</strong><br><p>Status: ${payload.status}</p><p>Zone: ${payload.zone}</p><p>Standard: ${payload.standard}</p><p>Notes: ${payload.notes || 'None'}</p>`;
    }
}

// ========================================
// LOGIN HANDLER (Unified Backend + Demo)
async function initLogin() {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin();
    });
    
    // Enter key login
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && document.activeElement.closest('#loginForm')) {
            handleLogin();
        }
    });
}

async function handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const roleSelect = document.getElementById('role');
    const role = roleSelect ? roleSelect.value : DEMO_USERS[email]?.role;
    const message = document.getElementById('message');
    
    if (!email || !password) {
        showMessage('Please enter email and password', 'error');
        return;
    }
    
    // Demo mode check (works offline)
    if (DEMO_USERS[email] && DEMO_USERS[email].password === password) {
        if (DEMO_USERS[email].role === role || !roleSelect) {
            sessionStorage.setItem('token', 'demo-token-' + Date.now()); // Fake token for demo
            sessionStorage.setItem('user', JSON.stringify({ 
                email, 
                role: DEMO_USERS[email].role 
            }));
            showMessage(`Demo: Welcome ${DEMO_USERS[email].role.toUpperCase()}!`, 'success');
            setTimeout(() => {
                window.location.href = `${DEMO_USERS[email].role}.html`;
            }, 1200);
        } else {
            showMessage('Role mismatch for demo user', 'error');
        }
        return;
    }
    
    // Backend mode (if available)
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('user', JSON.stringify(data.user));
            showMessage(`Welcome ${data.user.role.toUpperCase()}!`, 'success');
            setTimeout(() => {
                window.location.href = `${data.user.role}.html`;
            }, 1200);
        } else {
            showMessage(data.message || 'Backend login failed → Using demo mode', 'warning');
            handleDemoLogin(email, password, role, message);
        }
    } catch (error) {
        showMessage('Backend offline → Demo mode active', 'warning');
        handleDemoLogin(email, password, role, message);
    }
}

function handleDemoLogin(email, password, role, message) {
    if (DEMO_USERS[email] && DEMO_USERS[email].password === password) {
        sessionStorage.setItem('token', 'demo-token-' + Date.now()); // Fake token for demo
        sessionStorage.setItem('user', JSON.stringify({ email, role: DEMO_USERS[email].role }));
        showMessage(`Demo: Welcome ${DEMO_USERS[email].role.toUpperCase()}!`, 'success');
        setTimeout(() => {
            window.location.href = `${DEMO_USERS[email].role}.html`;
        }, 1200);
    } else {
        showMessage('Demo: test@admin.com/123 (select role)', 'error');
    }
}

// ========================================
// SIGNUP PAGE
function initSignup() {
    const form = document.getElementById('signupForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSignup();
        });
    }
}

async function handleSignup() {
    const fullname = document.getElementById('fullname')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const password = document.getElementById('password')?.value;
    const role = document.getElementById('role')?.value;
    const message = document.getElementById('message');
    
    if (!fullname || !email || !password || !role) {
        showMessage('Please fill all required fields', 'error');
        return;
    }
    
    if (password.length < 8) {
        showMessage('Password must be 8+ characters', 'error');
        return;
    }
    
    // Backend signup
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullname, email, phone, password, role })
        });
        
        const data = await response.json();
        if (response.ok) {
            showMessage('Account created! Login now.', 'success');
            setTimeout(() => window.location.href = 'index.html#login', 2000);
        } else {
            showMessage(data.message || 'Signup failed', 'error');
        }
    } catch (error) {
        showMessage('Demo: Use test@admin.com/123 for login', 'warning');
    }
}

// ========================================
// DASHBOARD PAGES
function initDashboard() {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (!user.role) {
        window.location.href = 'index.html#login';
        return;
    }
    
    // Set page title
    document.title = `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard - Niyantrak`;
    
    // Sidebar navigation
    const navLinks = document.querySelectorAll('.sidebar nav a:not(.logout-btn)');
    navLinks.forEach((link, index) => {
        link.addEventListener('click', function() {
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
        if (index === 0) this.classList.add('active');
    });
    
    // Add logout button
    const nav = document.querySelector('.sidebar nav');
    if (nav && !document.querySelector('.logout-btn')) {
        const logoutBtn = document.createElement('a');
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        logoutBtn.href = '#';
        logoutBtn.className = 'logout-btn';
        logoutBtn.onclick = logout;
        nav.appendChild(logoutBtn);
    }
}

function logout() {
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

// ========================================
// ROLE-SPECIFIC ACTIONS
function evacuate() {
    alert('🚨 EVACUATION PROTOCOL!\nWarehouse Block A - 78°C\nHIGH Smoke - IMMEDIATE EVACUATION!');
}
function nearMiss() { alert('📋 Near Miss Report Form Opened'); }
function workPermit() { alert('📄 Work Permit Application Started'); }
function incidentReport() { alert('🚨 Incident Report Created'); }
function documents() { alert('📚 Safety Documents Accessed'); }
function startResponse() { alert('🚒 Fire Response Team Dispatched!'); }
function uploadPhotos() { alert('📸 Photo Upload Started'); }

// ========================================
// UTILITY FUNCTIONS
function showMessage(text, type = 'error') {
    const message = document.getElementById('message');
    if (message) {
        message.textContent = text;
        message.className = type;
    }
}

// Global Enter key handler
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const active = document.activeElement;
        if (active.closest('form')) {
            const form = active.closest('form');
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    }
});

// Mobile optimizations
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('resize', () => {
    if (window.innerWidth < 768) location.reload();
});
