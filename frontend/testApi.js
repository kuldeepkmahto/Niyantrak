const fetch = globalThis.fetch || require('node-fetch');

async function run() {
  const apiBase = 'http://localhost:5000/api';

  console.log('Logging in...');
  const loginResp = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@admin.com', password: 'Admin@123' }),
  });
  const loginData = await loginResp.json();
  console.log('Login response:', loginData);
  if (!loginResp.ok) return;

  const token = loginData.token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  console.log('Testing sensor-fusion...');
  const fusionResp = await fetch(`${apiBase}/ai/sensor-fusion`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      smokePPM: 40,
      temperature: 58,
      carbonMonoxide: 65,
      soundLevel: 88,
      cameraAlert: true,
      zone: 'Warehouse A - Zone 3',
      location: '28.6139,77.2090',
    }),
  });
  console.log('Sensor fusion status:', fusionResp.status);
  console.log('Sensor fusion body:', await fusionResp.json());

  console.log('Testing compliance log...');
  const complianceResp = await fetch(`${apiBase}/compliance/logs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      zone: 'WH-A Zone 1',
      standard: 'NFPA 101',
      status: 'compliant',
      completionPct: 92,
      requiredPct: 100,
      notes: 'Demo compliance check',
    }),
  });
  console.log('Compliance status:', complianceResp.status);
  console.log('Compliance body:', await complianceResp.json());
}

run().catch(err => {
  console.error('Test script error:', err);
});
