// utils/seedBulkReports.js — Generate thousands of realistic Incident
// records (and a supporting user pool) so the admin "Submitted Reports"
// table has real, scaled data to page through instead of being empty.
//
// This does NOT touch the ML training pipeline in backend/ml — that uses
// its own synthetic generator. This script is purely for populating the
// live MongoDB database so the app itself has data to show.
//
// Usage:
//   node utils/seedBulkReports.js              (defaults to 3000 incidents)
//   node utils/seedBulkReports.js --count 5000
//   node utils/seedBulkReports.js --count 2000 --keep-existing   (don't wipe existing incidents first)

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');
const Incident = require('../models/Incident');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/niyantrak';

const args = process.argv.slice(2);
const countArg = args.indexOf('--count');
const COUNT = countArg !== -1 ? parseInt(args[countArg + 1], 10) : 3000;
const KEEP_EXISTING = args.includes('--keep-existing');
const USER_POOL_SIZE = 40;

const ZONES = [
  'Warehouse A – Zone 1', 'Warehouse A – Zone 2', 'Warehouse A – Zone 3',
  'Warehouse B', 'Production Floor', 'Boiler Room',
  'Electrical Room', 'Loading Bay', 'Rooftop',
];

const TYPES = ['near-miss', 'unsafe-condition', 'work-permit', 'incident-report'];
const TYPE_WEIGHTS = [0.40, 0.25, 0.20, 0.15];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const SEVERITY_WEIGHTS = [0.50, 0.30, 0.15, 0.05];

const STATUS_BY_TYPE = {
  'near-miss':        ['open', 'under-review', 'resolved', 'closed'],
  'unsafe-condition':  ['open', 'under-review', 'resolved', 'closed'],
  'work-permit':       ['pending-approval', 'open', 'resolved', 'closed'],
  'incident-report':   ['open', 'under-review', 'resolved', 'closed'],
};

const HAZARD_TYPES = [
  '🔥 Fire / Heat Hazard', '⚡ Electrical Hazard', '☣️ Chemical / Gas Leak',
  '🏗️ Structural Damage', '⚠️ Slip / Trip Hazard', '🚪 Blocked Emergency Exit',
  '🔧 Faulty Equipment', '💨 Poor Ventilation',
];

const PERMIT_TYPES = [
  '🔥 Hot Work (welding, cutting, grinding)', '⚡ Electrical Work',
  '🕳️ Confined Space Entry', '🏔️ Work at Height (>2m)',
  '☣️ Chemical / Hazmat Handling', '🔧 General Maintenance', '🚧 Excavation / Ground Work',
];

const INCIDENT_TYPES = [
  '🔥 Fire / Explosion', '🩹 Injury – Minor (first aid)', '🚑 Injury – Major (hospitalization)',
  '🧪 Chemical Spill', '🔩 Equipment / Property Damage', '🌿 Environmental Incident',
];

const NEAR_MISS_DESCRIPTIONS = [
  'A pallet nearly fell from the top rack while being moved by forklift.',
  'Worker almost slipped on a wet patch near the loading dock entrance.',
  'A spark from grinding work landed near uncovered flammable material.',
  'Forklift nearly collided with a pedestrian at the blind corner.',
  'Loose cable across the walkway was almost tripped over by two workers.',
  'A gas cylinder was found unsecured and nearly tipped over during transport.',
  'An overloaded shelf almost collapsed during restocking.',
  'A worker nearly contacted a live electrical panel while cleaning nearby.',
];

const UNSAFE_DESCRIPTIONS = [
  'Emergency exit door found partially blocked by stored equipment.',
  'Exposed wiring noticed near the equipment maintenance bay.',
  'Ventilation fan has been non-functional for over a week.',
  'Fire extinguisher missing from its designated mounting point.',
  'Oil spill on the floor near the machinery, not yet cleaned or cordoned.',
  'Warning signage for the confined space entry is faded and hard to read.',
  'Stacked material exceeds the marked safe-height line on the racking.',
  'Smoke detector in the corridor is showing a fault light.',
];

const INCIDENT_DESCRIPTIONS = [
  'Worker sustained a minor cut while handling sharp metal sheeting.',
  'Small electrical fire in a control panel was extinguished quickly by staff.',
  'Chemical spill occurred during transfer between containers, contained within minutes.',
  'A forklift collided with a storage rack, causing minor structural damage.',
  'Worker experienced smoke inhalation from a nearby welding operation and was given first aid.',
  'Equipment malfunction caused a brief power outage in the production zone.',
];

function weightedPick(items, weights) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (r <= acc) return items[i];
  }
  return items[items.length - 1];
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Skew dates so recent weeks have more volume than older ones (more realistic
// than a flat uniform distribution across 6 months).
function randomRecentDate(maxDaysAgo = 180) {
  const skewed = Math.pow(Math.random(), 1.6); // biases toward 0 (recent)
  const daysAgo = Math.floor(skewed * maxDaysAgo);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randInt(6, 22), randInt(0, 59), 0, 0);
  return d;
}

function buildIncident(userId) {
  const type = weightedPick(TYPES, TYPE_WEIGHTS);
  const severity = weightedPick(SEVERITIES, SEVERITY_WEIGHTS);
  const zone = pick(ZONES);
  const incidentDate = randomRecentDate();
  const status = pick(STATUS_BY_TYPE[type]);

  const base = {
    type,
    submittedBy: userId,
    location: zone,
    zone,
    severity,
    incidentDate,
    status,
    createdAt: incidentDate,
  };

  if (type === 'near-miss') {
    const desc = pick(NEAR_MISS_DESCRIPTIONS);
    return {
      ...base,
      description: desc,
      nearMiss: {
        whatHappened: desc,
        contributingFactors: pick([
          ['Human error / distraction'], ['Equipment failure or malfunction'],
          ['Inadequate training or supervision'], ['Poor lighting or restricted visibility'],
          ['Improper PPE or missing safety gear'],
        ]),
        immediateAction: 'Area inspected and workers briefed.',
        preventiveSuggestion: 'Increase signage and supervisor walk-throughs.',
        personsInvolved: [],
      },
    };
  }
  if (type === 'unsafe-condition') {
    const desc = pick(UNSAFE_DESCRIPTIONS);
    return {
      ...base,
      description: desc,
      unsafeCondition: {
        hazardType: pick(HAZARD_TYPES),
        areaStatus: pick(['Area occupied', 'Area cleared', 'Area barricaded']),
        immediateAction: 'Flagged for maintenance follow-up.',
      },
    };
  }
  if (type === 'work-permit') {
    const start = incidentDate;
    const end = new Date(start.getTime() + randInt(2, 8) * 3600 * 1000);
    return {
      ...base,
      description: `Work permit requested for ${zone} — ${pick(PERMIT_TYPES)}.`,
      workPermit: {
        permitType: pick(PERMIT_TYPES),
        startDateTime: start,
        endDateTime: end,
        supervisorName: 'Shift Supervisor',
        numWorkers: randInt(1, 6),
        safetyChecks: ['Fire extinguisher present and accessible at work site', 'All workers have appropriate PPE'],
        approvalStatus: status === 'pending-approval' ? 'pending' : (status === 'closed' ? 'rejected' : 'approved'),
      },
    };
  }
  // incident-report
  const desc = pick(INCIDENT_DESCRIPTIONS);
  return {
    ...base,
    description: desc,
    incidentReport: {
      incidentType: pick(INCIDENT_TYPES),
      personsInvolved: [],
      injuriesOrDamage: severity === 'critical' || severity === 'high' ? 'Moderate — under assessment' : 'Minor, first aid administered',
      responseActions: ['Supervisor / manager was notified'],
    },
  };
}

async function ensureUserPool() {
  const existing = await User.find({ role: { $in: ['employee', 'firemen'] } }).select('_id');
  if (existing.length >= USER_POOL_SIZE) {
    console.log(`👤  Using ${existing.length} existing employee/firemen users as the submitter pool`);
    return existing.map(u => u._id);
  }

  const need = USER_POOL_SIZE - existing.length;
  console.log(`👤  Creating ${need} additional demo users for the submitter pool...`);
  const hashedPassword = await bcrypt.hash('demo12345', 12);
  const newUsers = [];
  for (let i = 0; i < need; i++) {
    const role = Math.random() < 0.6 ? 'employee' : 'firemen';
    newUsers.push({
      fullname: `Demo ${role === 'employee' ? 'Employee' : 'Fireman'} ${existing.length + i + 1}`,
      email: `demo.${role}${existing.length + i + 1}@niyantrak.local`,
      password: hashedPassword,
      role,
      isActive: true,
    });
  }
  const created = await User.insertMany(newUsers);
  return [...existing.map(u => u._id), ...created.map(u => u._id)];
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  const userIds = await ensureUserPool();

  if (!KEEP_EXISTING) {
    const { deletedCount } = await Incident.deleteMany({});
    console.log(`🗑️   Cleared ${deletedCount} existing incidents`);
  }

  console.log(`📋  Generating ${COUNT} incidents...`);
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < COUNT; i += BATCH) {
    const batchSize = Math.min(BATCH, COUNT - i);
    const docs = Array.from({ length: batchSize }, () => buildIncident(pick(userIds)));
    await Incident.insertMany(docs, { ordered: false });
    inserted += batchSize;
    process.stdout.write(`\r   ${inserted}/${COUNT} inserted...`);
  }
  console.log('\n');

  const [byType, bySeverity, byStatus] = await Promise.all([
    Incident.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    Incident.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
    Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  console.log('🎉  Done! Summary:');
  console.log('   By type:', Object.fromEntries(byType.map(b => [b._id, b.count])));
  console.log('   By severity:', Object.fromEntries(bySeverity.map(b => [b._id, b.count])));
  console.log('   By status:', Object.fromEntries(byStatus.map(b => [b._id, b.count])));

  process.exit(0);
}

run().catch(err => {
  console.error('❌  Bulk seed failed:', err.message);
  process.exit(1);
});
