/**
 * Migration: Add organizationId to existing records
 *
 * Run: node src/migrations/001-add-org-id.js
 *
 * This script finds all documents in the 5 collections that are missing
 * organizationId and sets them to the first Organization found in the DB
 * (or the user's organizationId if only one org exists).
 */

require('../config/env');
const connectDB = require('../config/db');
const mongoose = require('mongoose');

async function migrate() {
  await connectDB();

  const db = mongoose.connection.db;

  // Find the first organization
  const org = await db.collection('organizations').findOne({});
  if (!org) {
    console.log('No organization found. Skipping migration.');
    process.exit(0);
  }

  const orgId = org._id;
  console.log(`Using organization: ${org.name || org._id}`);

  const collections = ['expenses', 'cafeproducts', 'payments', 'inventories'];

  for (const colName of collections) {
    const collection = db.collection(colName);

    const filter = {
      $or: [
        { organizationId: { $exists: false } },
        { organizationId: null },
      ],
    };

    const count = await collection.countDocuments(filter);
    if (count === 0) {
      console.log(`  ${colName}: all documents already have organizationId`);
      continue;
    }

    const result = await collection.updateMany(filter, {
      $set: { organizationId: orgId },
    });

    console.log(`  ${colName}: updated ${result.modifiedCount} / ${count} documents`);
  }

  console.log('\nMigration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
