/**
 * Migration: Fix Table number global unique index
 * 
 * Drops the old global unique index on `tableNumber` and relies on the
 * new compound unique index `{ organizationId: 1, tableNumber: 1 }`
 * defined in the Table model.
 * 
 * Run: node src/migrations/fix-table-index.js
 */

require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

// Force Google DNS for SRV lookup (same fix as db.js)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('ERROR: MONGODB_URI or MONGO_URI not set in .env');
  process.exit(1);
}

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const db = mongoose.connection.db;
  const collection = db.collection('tables');

  // List existing indexes
  const indexes = await collection.indexes();
  console.log('Current indexes:', JSON.stringify(indexes, null, 2));

  // Drop the global unique index on tableNumber
  // Mongoose auto-creates it as "tableNumber_1"
  const globalIndex = indexes.find(
    (idx) => idx.key && idx.key.tableNumber === 1 && !idx.key.organizationId
  );

  if (globalIndex) {
    console.log(`Dropping global index: ${globalIndex.name}...`);
    await collection.dropIndex(globalIndex.name);
    console.log('Dropped.');
  } else {
    console.log('No global tableNumber unique index found — already fixed or never created.');
  }

  // Ensure the compound index exists (Mongoose will create it on next app start,
  // but we can create it here too)
  const compoundIndex = indexes.find(
    (idx) => idx.key && idx.key.organizationId === 1 && idx.key.tableNumber === 1
  );

  if (!compoundIndex) {
    console.log('Creating compound index { organizationId: 1, tableNumber: 1 }...');
    await collection.createIndex({ organizationId: 1, tableNumber: 1 }, { unique: true });
    console.log('Created.');
  } else {
    console.log('Compound index already exists.');
  }

  // Verify
  const finalIndexes = await collection.indexes();
  console.log('Final indexes:', JSON.stringify(finalIndexes, null, 2));

  await mongoose.disconnect();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
