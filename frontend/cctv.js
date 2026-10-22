// ============================================================
// NIYANTRAK — CCTV SURVEILLANCE & FIRE DETECTION ADD-ON (cctv.js)
// Real-time multi-camera streaming, HUD, siren alarm, & drills
// ============================================================

const CCTV_ENGINE_URL = 'http://localhost:8003';
const BACKEND_URL = 'http://localhost:5000/api';

let activeCameras = [];
let isSirenMuted = false;
let audioCtx = null;
let sirenOscillator = null;
let sirenGain = null;
let isSirenPlaying = false;
let currentGridMode = 'grid-2x2';
let focusedCameraId = null;
let drillActive = false;

// ── Initialize on page load ──
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initSirenAudio();
    initGridControls();
    initModalControls();
    loadCameras();
    // Poll camera statuses periodically
    setInterval(updateCameraStatuses, 2000);
});

// ── Real-time Topbar Clock ──
function initClock() {
    const clockEl = document.getElementById('liveClock');
    if (!clockEl) return;
    const tick = () => {
        const d = new Date();
        clockEl.textContent = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    };
    tick();
    setInterval(tick, 1000);
}

// ── Web Audio API Emergency Siren ──
function initSirenAudio() {
    const sirenBtn = document.getElementById('toggleSirenBtn');
    if (sirenBtn) {
        sirenBtn.addEventListener('click', () => {
            isSirenMuted = !isSirenMuted;
            const icon = sirenBtn.querySelector('i');
            const text = sirenBtn.querySelector('span');
            if (isSirenMuted) {
                stopSirenSound();
                if (icon) icon.className = 'fas fa-volume-mute';
                if (text) text.textContent = 'Siren Muted';
                sirenBtn.style.opacity = '0.7';
            } else {
                if (icon) icon.className = 'fas fa-volume-up';
                if (text) text.textContent = 'Siren Active';
                sirenBtn.style.opacity = '1';
                // Trigger quick confirmation beep
                playTone(880, 0.1);
            }
        });
    }
}

function startSirenSound() {
    if (isSirenMuted || isSirenPlaying) return;
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        sirenOscillator = audioCtx.createOscillator();
        sirenGain = audioCtx.createGain();

        sirenOscillator.type = 'sawtooth';
        sirenGain.gain.setValueAtTime(0.15, audioCtx.currentTime);

        // Modulate siren frequency between 600Hz and 950Hz
        const now = audioCtx.currentTime;
        sirenOscillator.frequency.setValueAtTime(600, now);
        for (let i = 0; i < 20; i++) {
            sirenOscillator.frequency.linearRampToValueAtTime(950, now + (i * 0.8) + 0.4);
            sirenOscillator.frequency.linearRampToValueAtTime(600, now + (i * 0.8) + 0.8);
        }

        sirenOscillator.connect(sirenGain);
        sirenGain.connect(audioCtx.destination);
        sirenOscillator.start();
        isSirenPlaying = true;
    } catch (e) {
        console.warn('Web Audio warning:', e);
    }
}

function stopSirenSound() {
    if (sirenOscillator && isSirenPlaying) {
        try {
            sirenOscillator.stop();
            sirenOscillator.disconnect();
        } catch (e) {}
        sirenOscillator = null;
        isSirenPlaying = false;
    }
}

function playTone(freq, duration) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

// ── Fetch & Render Cameras ──
async function loadCameras() {
    const gridEl = document.getElementById('cctvGrid');
    if (!gridEl) return;

    try {
        const resp = await fetch(`${CCTV_ENGINE_URL}/cameras`).catch(() => null);
        let list = [];
        if (resp && resp.ok) {
            const data = await resp.json();
            list = data.cameras || [];
            updateEngineStatus(true);
        } else {
            // Fallback via Express router or defaults
            const backendResp = await fetch(`${BACKEND_URL}/cctv/cameras`).catch(() => null);
            if (backendResp && backendResp.ok) {
                const bdata = await backendResp.json();
                list = bdata.cameras || [];
            } else {
                list = [
                    { id: 'cam-01', name: 'Camera 01 - Warehouse High Bay', zone: 'Warehouse A - Zone 3', fps: 24, isFire: false },
                    { id: 'cam-02', name: 'Camera 02 - Chemical Storage', zone: 'Chemical Storage - Zone 1', fps: 24, isFire: false },
                    { id: 'cam-03', name: 'Camera 03 - Loading Bay South', zone: 'Loading Dock', fps: 24, isFire: false },
                    { id: 'cam-04', name: 'Camera 04 - Production Line B', zone: 'Factory Floor - Zone 2', fps: 24, isFire: false },
                ];
            }
            updateEngineStatus(false);
        }

        activeCameras = list;
        renderGrid(list);
    } catch (e) {
        console.error('Camera load failed:', e);
        updateEngineStatus(false);
    }
}

function updateEngineStatus(online) {
    const dot = document.getElementById('engineDot');
    const label = document.getElementById('engineStatusText');
    if (dot) dot.className = `telemetry-dot ${online ? 'green' : 'yellow'}`;
    if (label) label.textContent = online ? 'Online (8003)' : 'Standby / Connecting';
}

function renderGrid(cameras) {
    const gridEl = document.getElementById('cctvGrid');
    if (!gridEl) return;

    gridEl.innerHTML = '';
    cameras.forEach(cam => {
        const card = document.createElement('div');
        card.className = `cctv-card ${cam.isFire ? 'fire-alarm' : ''}`;
        card.id = `card-${cam.id}`;

        const streamUrl = `${CCTV_ENGINE_URL}/stream/${cam.id}`;

        card.innerHTML = `
            <div class="cctv-card-header">
                <div class="cctv-card-title">
                    <i class="fas fa-video"></i>
                    <span>${cam.name}</span>
                    <span class="cctv-zone-tag">${cam.zone}</span>
                </div>
                <div class="cctv-status-badge ${cam.isFire ? 'fire' : 'safe'}" id="badge-${cam.id}">
                    <i class="fas ${cam.isFire ? 'fa-fire' : 'fa-check-circle'}"></i>
                    <span>${cam.isFire ? 'FIRE DETECTED' : 'NORMAL'}</span>
                </div>
            </div>
            <div class="cctv-viewport">
                <img src="${streamUrl}" alt="${cam.name}" class="cctv-stream-img" onerror="this.src='https://placehold.co/640x480/0d121f/cbd5e1?text=Connecting+to+${encodeURIComponent(cam.name)}...'">
                <div class="cctv-scanline"></div>
                <div class="cctv-bracket-tl"></div>
                <div class="cctv-bracket-br"></div>
            </div>
            <div class="cctv-card-footer">
                <div>
                    <span id="fps-${cam.id}">FPS: ${cam.fps || 24}</span>
                    <span style="margin: 0 0.5rem">|</span>
                    <span id="conf-${cam.id}">CONF: ${Math.round((cam.confidence || 0.95)*100)}%</span>
                </div>
                <div class="card-action-btns">
                    <button class="btn-icon-small" title="Snapshot" onclick="captureSnapshot('${cam.id}', '${cam.name}', '${cam.zone}')">
                        <i class="fas fa-camera"></i>
                    </button>
                    <button class="btn-icon-small" title="Focus view" onclick="focusCamera('${cam.id}')">
                        <i class="fas fa-expand"></i>
                    </button>
                    <button class="btn-icon-small" title="Toggle drill" onclick="toggleFireSimulation('${cam.id}')">
                        <i class="fas fa-fire-extinguisher"></i>
                    </button>
                </div>
            </div>
        `;
        gridEl.appendChild(card);
    });
}

// ── Periodic Status Updates ──
async function updateCameraStatuses() {
    try {
        const resp = await fetch(`${CCTV_ENGINE_URL}/cameras`).catch(() => null);
        if (!resp || !resp.ok) return;
        const data = await resp.json();
        const cameras = data.cameras || [];

        let anyFire = false;
        let fireZones = [];

        cameras.forEach(cam => {
            const card = document.getElementById(`card-${cam.id}`);
            const badge = document.getElementById(`badge-${cam.id}`);
            const fpsEl = document.getElementById(`fps-${cam.id}`);
            const confEl = document.getElementById(`conf-${cam.id}`);

            if (fpsEl) fpsEl.textContent = `FPS: ${cam.fps || 24}`;
            if (confEl) confEl.textContent = `CONF: ${Math.round((cam.confidence || 0.95)*100)}%`;

            if (cam.isFire) {
                anyFire = true;
                fireZones.push(cam.zone);
                if (card) card.classList.add('fire-alarm');
                if (badge) {
                    badge.className = 'cctv-status-badge fire';
                    badge.innerHTML = '<i class="fas fa-fire"></i><span>FIRE DETECTED</span>';
                }
            } else {
                if (card) card.classList.remove('fire-alarm');
                if (badge) {
                    badge.className = 'cctv-status-badge safe';
                    badge.innerHTML = '<i class="fas fa-check-circle"></i><span>NORMAL</span>';
                }
            }
        });

        // Global Alert Banner & Siren
        const banner = document.getElementById('globalAlertBanner');
        const bannerText = document.getElementById('alertBannerText');

        if (anyFire) {
            startSirenSound();
            if (banner) banner.classList.add('active');
            if (bannerText) {
                bannerText.textContent = `CRITICAL HAZARD: FLAME CONFIRMED IN ${fireZones.join(', ').toUpperCase()} — EVACUATION PROTOCOL ACTIVE`;
            }
        } else {
            stopSirenSound();
            if (banner) banner.classList.remove('active');
        }

        // Update active cams counter
        const camCountEl = document.getElementById('activeCamCount');
        if (camCountEl) camCountEl.textContent = cameras.length;
    } catch (e) {
        console.warn('Status poll error:', e);
    }
}

// ── Fire Drill / Simulation Toggle ──
async function toggleFireSimulation(cameraId = 'cam-01') {
    const drillBtn = document.getElementById('drillBtn');
    try {
        const resp = await fetch(`${CCTV_ENGINE_URL}/simulate-fire/${cameraId}`, { method: 'POST' });
        const data = await resp.json();
        drillActive = data.simulatedFire;

        if (drillBtn) {
            drillBtn.classList.toggle('active', drillActive);
            drillBtn.innerHTML = drillActive
                ? '<i class="fas fa-stop"></i> Stop Safety Drill'
                : '<i class="fas fa-fire-extinguisher"></i> Run Fire Drill Simulation';
        }

        // Force an immediate status check
        setTimeout(updateCameraStatuses, 500);
    } catch (e) {
        alert('Could not toggle drill. Ensure CCTV service on port 8003 is running.');
    }
}

// ── Manual Snapshot Capture ──
function captureSnapshot(cameraId, name, zone) {
    const url = `${CCTV_ENGINE_URL}/snapshot/${cameraId}?t=${Date.now()}`;
    const gallery = document.getElementById('snapshotGrid');
    if (!gallery) return;

    const item = document.createElement('div');
    item.className = 'snapshot-thumb-card';
    item.innerHTML = `
        <img src="${url}" alt="Snapshot ${cameraId}">
        <div class="snapshot-thumb-meta">
            <span><strong>${name}</strong></span>
            <span>${new Date().toLocaleTimeString()}</span>
        </div>
    `;
    item.onclick = () => window.open(url, '_blank');
    gallery.prepend(item);

    // Limit to 6 snapshots
    while (gallery.children.length > 6) {
        gallery.removeChild(gallery.lastChild);
    }

    playTone(1200, 0.08);
}

// ── Grid Layout Controls ──
function initGridControls() {
    const gridEl = document.getElementById('cctvGrid');
    const btns = document.querySelectorAll('.grid-btn[data-grid]');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.grid;
            currentGridMode = mode;
            if (gridEl) {
                gridEl.className = `cctv-grid ${mode}`;
            }
        });
    });
}

function focusCamera(cameraId) {
    const gridEl = document.getElementById('cctvGrid');
    const btns = document.querySelectorAll('.grid-btn[data-grid]');
    if (!gridEl) return;

    if (focusedCameraId === cameraId) {
        // Toggle back to 2x2
        gridEl.className = 'cctv-grid grid-2x2';
        focusedCameraId = null;
        document.querySelectorAll('.cctv-card').forEach(c => c.style.display = 'flex');
        btns.forEach(b => b.classList.toggle('active', b.dataset.grid === 'grid-2x2'));
    } else {
        // Focus single
        gridEl.className = 'cctv-grid grid-1x1';
        focusedCameraId = cameraId;
        document.querySelectorAll('.cctv-card').forEach(c => {
            c.style.display = c.id === `card-${cameraId}` ? 'flex' : 'none';
        });
        btns.forEach(b => b.classList.toggle('active', b.dataset.grid === 'grid-1x1'));
    }
}

// ── Add / Configure Camera Modal ──
function initModalControls() {
    const modal = document.getElementById('addCameraModal');
    const openBtn = document.getElementById('openAddCameraBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('addCameraForm');

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => modal.classList.add('active'));
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('camId').value.trim() || `cam-${Date.now()}`;
            const name = document.getElementById('camName').value.trim();
            const zone = document.getElementById('camZone').value.trim();
            const source = document.getElementById('camSource').value.trim();

            try {
                const resp = await fetch(`${CCTV_ENGINE_URL}/cameras`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, name, zone, source })
                });
                if (resp.ok) {
                    modal.classList.remove('active');
                    form.reset();
                    loadCameras();
                } else {
                    alert('Failed to register camera stream.');
                }
            } catch (err) {
                alert('CCTV engine offline. Start cctv_service.py on port 8003.');
            }
        });
    }
}

// ── Local Webcam Access & Real-Time Fire Detection ──
let webcamStream = null;
let webcamInterval = null;
let webcamDetecting = false;
let webcamLastAlertTime = 0;

function initWebcamControls() {
    const btn = document.getElementById('connectWebcamBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        if (webcamStream) {
            stopLocalWebcam();
        } else {
            await startLocalWebcam();
        }
    });
}

// Call initWebcamControls on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initWebcamControls();
});

async function startLocalWebcam() {
    const btn = document.getElementById('connectWebcamBtn');
    const video = document.getElementById('webcamVideo');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support camera access via getUserMedia.');
        return;
    }

    try {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Requesting Cam...</span>';
        }

        // Directly prompt browser for webcam access
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });

        video.srcObject = webcamStream;
        await video.play();

        if (btn) {
            btn.innerHTML = '<i class="fas fa-stop"></i><span>Stop Webcam</span>';
            btn.style.background = '#dc2626';
            btn.style.borderColor = '#ef4444';
        }

        // Mount webcam onto cam-04 viewport
        mountWebcamCanvas();
    } catch (err) {
        console.error('Camera access denied or error:', err);
        alert(`Camera access denied or unavailable: ${err.message}\nCheck your browser camera permissions.`);
        if (btn) {
            btn.innerHTML = '<i class="fas fa-camera"></i><span>Use My Webcam</span>';
            btn.style.background = '#0284c7';
            btn.style.borderColor = '#38bdf8';
        }
    }
}

function stopLocalWebcam() {
    const btn = document.getElementById('connectWebcamBtn');
    const video = document.getElementById('webcamVideo');

    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (webcamInterval) {
        clearInterval(webcamInterval);
        webcamInterval = null;
    }
    if (video) {
        video.srcObject = null;
    }

    if (btn) {
        btn.innerHTML = '<i class="fas fa-camera"></i><span>Use My Webcam</span>';
        btn.style.background = '#0284c7';
        btn.style.borderColor = '#38bdf8';
    }

    // Restore standard Cam 04 stream
    loadCameras();
}

function mountWebcamCanvas() {
    const video = document.getElementById('webcamVideo');
    const card = document.getElementById('card-cam-04') || document.querySelector('.cctv-card');
    if (!card) return;

    // Update Card Header
    const titleSpan = card.querySelector('.cctv-card-title span');
    const zoneTag = card.querySelector('.cctv-zone-tag');
    if (titleSpan) titleSpan.textContent = 'Camera 04 — LIVE USER WEBCAM';
    if (zoneTag) zoneTag.textContent = 'Local User Feed';

    const viewport = card.querySelector('.cctv-viewport');
    if (!viewport) return;

    // Replace img with canvas
    viewport.innerHTML = `
        <canvas id="webcamCanvas" width="640" height="480" style="width:100%;height:100%;object-fit:cover;display:block;"></canvas>
        <div class="cctv-scanline"></div>
        <div class="cctv-bracket-tl"></div>
        <div class="cctv-bracket-br"></div>
    `;

    const canvas = document.getElementById('webcamCanvas');
    const ctx = canvas.getContext('2d');
    let currentBoxes = [];
    let isWebcamFire = false;
    let webcamConsecutiveFireCount = 0;
    let webcamSafeCount = 0;

    // Dedicated offscreen canvas for AI prediction (raw video only, NO HUD or bounding boxes!)
    const rawCaptureCanvas = document.createElement('canvas');
    rawCaptureCanvas.width = 640;
    rawCaptureCanvas.height = 480;
    const rawCaptureCtx = rawCaptureCanvas.getContext('2d');

    // Fast render loop (~25 FPS)
    const renderLoop = () => {
        if (!webcamStream) return;

        ctx.drawImage(video, 0, 0, 640, 480);

        // Only draw bounding boxes if fire is confirmed
        if (isWebcamFire && currentBoxes.length > 0) {
            currentBoxes.forEach(b => {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.strokeRect(b.x, b.y, b.width, b.height);

                ctx.fillStyle = '#ef4444';
                ctx.fillRect(b.x, Math.max(0, b.y - 20), 100, 20);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Rajdhani, sans-serif';
                ctx.fillText(`FLAME ${Math.round((b.confidence || 0.95)*100)}%`, b.x + 6, Math.max(14, b.y - 5));
            });
        }

        // Top HUD Bar
        ctx.fillStyle = 'rgba(15, 15, 20, 0.85)';
        ctx.fillRect(0, 0, 640, 32);
        ctx.fillStyle = '#f1f5f9';
        ctx.font = 'bold 13px Rajdhani, sans-serif';
        ctx.fillText('CAM 04: LIVE USER WEBCAM | HARDWARE ACTIVE', 12, 21);

        // REC Indicator
        const nowSec = Math.floor(Date.now() / 500);
        ctx.fillStyle = (nowSec % 2 === 0) ? '#ef4444' : '#64748b';
        ctx.beginPath();
        ctx.arc(615, 16, 5, 0, Math.PI * 2);
        ctx.fill();

        // Bottom HUD Bar
        ctx.fillStyle = 'rgba(15, 15, 20, 0.85)';
        ctx.fillRect(0, 480 - 28, 640, 28);
        ctx.fillStyle = isWebcamFire ? '#ef4444' : '#34d399';
        ctx.font = 'bold 12px Rajdhani, sans-serif';
        ctx.fillText(isWebcamFire ? '🚨 CRITICAL: FIRE DETECTED IN WEBCAM' : '● SCANNING — SAFE', 12, 480 - 10);

        requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);

    // AI Frame Evaluation Loop (every 500ms)
    webcamInterval = setInterval(async () => {
        if (!webcamStream || webcamDetecting) return;
        webcamDetecting = true;

        try {
            // CRITICAL: Draw raw clean video to offscreen canvas (NEVER capture the annotated UI canvas)
            rawCaptureCtx.drawImage(video, 0, 0, 640, 480);
            const dataUrl = rawCaptureCanvas.toDataURL('image/jpeg', 0.70);

            const resp = await fetch(`${CCTV_ENGINE_URL}/predict-frame`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: dataUrl,
                    zone: 'Local User Feed'
                })
            }).catch(() => null);

            if (resp && resp.ok) {
                const result = await resp.json();
                const rawFire = Boolean(result.isFire && result.boundingBoxes && result.boundingBoxes.length > 0);

                // Temporal Debouncing: Require 2 consecutive positive detections to trigger alarm
                if (rawFire) {
                    webcamConsecutiveFireCount++;
                    webcamSafeCount = 0;
                } else {
                    webcamSafeCount++;
                    webcamConsecutiveFireCount = 0;
                }

                if (webcamConsecutiveFireCount >= 2) {
                    isWebcamFire = true;
                    currentBoxes = result.boundingBoxes || [];
                } else if (webcamSafeCount >= 2) {
                    isWebcamFire = false;
                    currentBoxes = [];
                }

                const badge = document.getElementById('badge-cam-04');
                const fpsEl = document.getElementById('fps-cam-04');
                const confEl = document.getElementById('conf-cam-04');

                if (fpsEl) fpsEl.textContent = 'FPS: 25.0';
                if (confEl) confEl.textContent = `CONF: ${Math.round((result.confidence || (isWebcamFire ? 0.95 : 0.99))*100)}%`;

                if (isWebcamFire) {
                    card.classList.add('fire-alarm');
                    if (badge) {
                        badge.className = 'cctv-status-badge fire';
                        badge.innerHTML = '<i class="fas fa-fire"></i><span>FIRE DETECTED</span>';
                    }
                    startSirenSound();
                    const banner = document.getElementById('globalAlertBanner');
                    const bannerText = document.getElementById('alertBannerText');
                    if (banner) banner.classList.add('active');
                    if (bannerText) bannerText.textContent = 'CRITICAL HAZARD: FLAME CONFIRMED IN LOCAL WEBCAM FEED';

                    // Rate-limited auto alert to NiyanTrak backend
                    const now = Date.now();
                    if (now - webcamLastAlertTime > 30000) {
                        webcamLastAlertTime = now;
                        fetch(`${BACKEND_URL}/cctv/alert`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                title: '🚨 Fire Detected on Live User Webcam',
                                location: 'Local User Feed',
                                zone: 'Local User Feed',
                                level: 'critical',
                                type: 'fire',
                                aiConfidence: result.confidence || 0.95,
                                detail: 'Flame confirmed via client-side live camera stream.'
                            })
                        }).catch(() => {});
                    }
                } else {
                    card.classList.remove('fire-alarm');
                    if (badge) {
                        badge.className = 'cctv-status-badge safe';
                        badge.innerHTML = '<i class="fas fa-check-circle"></i><span>NORMAL</span>';
                    }
                    // Only stop siren if no other simulated drill or camera is in alarm
                    const anyOtherFire = activeCameras.some(c => c.isFire);
                    if (!anyOtherFire) {
                        stopSirenSound();
                        const banner = document.getElementById('globalAlertBanner');
                        if (banner) banner.classList.remove('active');
                    }
                }
            }
        } catch (e) {
            console.warn('Webcam frame prediction error:', e);
        } finally {
            webcamDetecting = false;
        }
    }, 500);
}
