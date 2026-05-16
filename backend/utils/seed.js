// utils/seed.js — Populate MongoDB with demo data for development
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose  = require('mongoose');
const User      = require('../models/User');
const Alert     = require('../models/Alert');
const Incident  = require('../models/Incident');
const Checklist = require('../models/Checklist');
const demoData  = require('../data/demoDataset.json');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/niyantrak';

const DEMO_USERS      = demoData.users;
const DEMO_ALERTS     = demoData.alerts;
const DEMO_INCIDENTS  = demoData.incidents;
const DEMO_CHECKLISTS = demoData.checklists;

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected to MongoDB');

    // Clear existing
    await Promise.all([User.deleteMany({}), Alert.deleteMany({}), Incident.deleteMany({}), Checklist.deleteMany({})]);
    console.log('🗑️   Cleared existing data');

    // Create users
    const users = await User.create(DEMO_USERS);
    console.log(`👤  Created ${users.length} users`);

    const adminUser    = users.find(u => u.role === 'admin');
    const employeeUser = users.find(u => u.role === 'employee');
    const firemenUser  = users.find(u => u.role === 'firemen');

    // Create alerts
    const alerts = await Alert.create(DEMO_ALERTS.map(a => ({ ...a, triggeredBy: adminUser._id })));
    console.log(`🔔  Created ${alerts.length} alerts`);

    // Create sample incidents
    const incidents = DEMO_INCIDENTS.map(i => ({
      ...i,
      submittedBy: employeeUser._id,
      incidentDate: new Date(i.incidentDate),
    }));
    await Incident.create(incidents);
    console.log(`📋  Created ${incidents.length} sample incidents`);

    // Create sample checklists
    const checklists = DEMO_CHECKLISTS.map(c => ({
      ...c,
      submittedBy: firemenUser._id,
      shiftDate: new Date(c.shiftDate),
      ai: {
        ...c.ai,
        analyzedAt: new Date(c.ai.analyzedAt),
      },
    }));
    await Checklist.create(checklists);
    console.log(`✅  Created ${checklists.length} sample checklists`);

    console.log('\n🎉  Seed complete! Demo credentials:');
    DEMO_USERS.forEach(u => console.log(`   ${u.role.padEnd(14)} → ${u.email} / ${u.password}`));
    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  }
}

seed();