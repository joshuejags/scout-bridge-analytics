#!/usr/bin/env node
/**
 * Finds duplicate Analysis documents for the same video before the unique
 * Analysis.video index is deployed.
 *
 * Dry run (default):
 *   MONGODB_URI="mongodb+srv://..." node scripts/dedupeAnalyses.js
 *
 * After taking a verified database backup and pausing the API/analysis workers:
 *   MONGODB_URI="mongodb+srv://..." node scripts/dedupeAnalyses.js --apply
 *
 * --apply keeps the newest analysis by createdAt, breaking ties by _id, and
 * deletes older duplicates. Review the dry-run IDs and back up production data
 * before using --apply.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

function parseArgs(argv) {
  const unknown = argv.filter((arg) => arg !== '--apply');
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);
  }
  return { apply: argv.includes('--apply') };
}

async function findDuplicateVideos(collection) {
  return collection
    .aggregate([
      { $match: { video: { $exists: true, $ne: null } } },
      { $group: { _id: '$video', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ])
    .toArray();
}

async function inspectDuplicates(collection, groups) {
  const duplicates = [];
  for (const group of groups) {
    const documents = await collection
      .find({ video: group._id })
      .project({ _id: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    duplicates.push({
      videoId: String(group._id),
      count: group.count,
      keepId: String(documents[0]._id),
      removeIds: documents.slice(1).map((doc) => String(doc._id)),
    });
  }
  return duplicates;
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI must be set explicitly; refusing to choose a database implicitly.');
  }
  const { apply } = parseArgs(process.argv.slice(2));
  const mongoose = require('mongoose');

  try {
    // Use the raw collection so connecting does not register models or create
    // the unique index before duplicate cleanup has completed.
    await mongoose.connect(MONGODB_URI, { autoIndex: false });
    const collection = mongoose.connection.collection('analyses');
    const groups = await findDuplicateVideos(collection);
    const duplicates = await inspectDuplicates(collection, groups);

    if (duplicates.length === 0) {
      console.log('[analysis-migration] No duplicate analyses found.');
      return;
    }

    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', duplicates }, null, 2));
    if (!apply) {
      console.log('[analysis-migration] No data changed. Back up the database, pause writers, review this report, then rerun with --apply.');
      process.exitCode = 2;
      return;
    }

    let deleted = 0;
    for (const duplicate of duplicates) {
      const result = await collection.deleteMany({
        video: groups.find((group) => String(group._id) === duplicate.videoId)._id,
        _id: { $in: duplicate.removeIds.map((id) => new mongoose.Types.ObjectId(id)) },
      });
      deleted += result.deletedCount;
    }

    const remaining = await findDuplicateVideos(collection);
    console.log(`[analysis-migration] Deleted ${deleted} duplicate analysis document(s); ${remaining.length} duplicate video group(s) remain.`);
    if (remaining.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[analysis-migration] Failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { findDuplicateVideos, inspectDuplicates, parseArgs };
