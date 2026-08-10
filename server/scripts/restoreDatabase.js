#!/usr/bin/env node
/**
 * MongoDB Restore Script
 *
 * Restores a database from an S3-backed backup archive.
 *
 * Usage:
 *   # List available backups
 *   node scripts/restoreDatabase.js --list
 *
 *   # Restore from a specific backup
 *   node scripts/restoreDatabase.js backup-filename.archive.gz
 *
 * WARNING: This operation DROPS the current database and replaces it with
 * the backup. Only run this if you're certain you want to restore, as there
 * is no undo.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/scout-bridge-analytics';
const BUCKET = process.env.BACKUP_S3_BUCKET;
const PREFIX = 'backups/';

function requireConfig() {
  if (!BUCKET) {
    console.error(
      'BACKUP_S3_BUCKET is not set. See README.md "Backups" for the full list of required variables.'
    );
    process.exit(1);
  }
}

function getS3Client() {
  const config = { region: process.env.S3_REGION || 'us-east-1' };
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = true;
  }
  if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    };
  }
  return new S3Client(config);
}

/**
 * List all available backups from S3
 */
async function listBackups(client) {
  console.log(`\nListing backups from s3://${BUCKET}/${PREFIX}\n`);

  const listing = await client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX })
  );

  if (!listing.Contents || listing.Contents.length === 0) {
    console.log('No backups found.');
    return [];
  }

  const backups = listing.Contents.filter((obj) => obj.Key.endsWith('.archive.gz')).sort(
    (a, b) => new Date(b.LastModified) - new Date(a.LastModified)
  );

  if (backups.length === 0) {
    console.log('No .archive.gz backups found.');
    return [];
  }

  console.log('Available backups:');
  backups.forEach((backup, idx) => {
    const filename = path.basename(backup.Key);
    const sizeKb = Math.round(backup.Size / 1024);
    const timestamp = backup.LastModified.toLocaleString();
    console.log(`  ${idx + 1}. ${filename} (${sizeKb}KB, ${timestamp})`);
  });
  console.log('');

  return backups;
}

/**
 * Download backup from S3 and pipe to mongorestore
 */
async function restoreFromBackup(client, backupKey) {
  console.log(`\n🔄 WARNING: This will DROP your current database and restore from backup.`);
  console.log(`   Backup: ${path.basename(backupKey)}`);
  console.log(`   Database: ${MONGODB_URI}\n`);

  // Ask for confirmation
  if (process.env.RESTORE_CONFIRM !== 'yes') {
    console.log('To confirm, set environment variable: RESTORE_CONFIRM=yes');
    console.log('Example: RESTORE_CONFIRM=yes node scripts/restoreDatabase.js backup-file.archive.gz');
    process.exit(1);
  }

  try {
    console.log('Downloading backup from S3...');
    const response = await client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: backupKey })
    );

    console.log('Starting mongorestore...');

    // Spawn mongorestore with --drop flag to replace existing database
    const mongorestore = spawn('mongorestore', ['--uri', MONGODB_URI, '--archive', '--gzip', '--drop'], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    let hasError = false;

    mongorestore.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error(
          'mongorestore not found on PATH. Install MongoDB Database Tools: ' +
            'https://www.mongodb.com/try/download/database-tools'
        );
      } else {
        console.error('Failed to spawn mongorestore:', err.message);
      }
      hasError = true;
    });

    // Pipe S3 object to mongorestore stdin
    response.Body.pipe(mongorestore.stdin);

    // Wait for completion
    const exitCode = await new Promise((resolve) => {
      mongorestore.on('exit', (code) => {
        resolve(code);
      });
    });

    if (!hasError && exitCode === 0) {
      console.log('\n✅ Database restore completed successfully!');
      return true;
    } else {
      console.error(`\n❌ mongorestore exited with code ${exitCode}`);
      return false;
    }
  } catch (err) {
    console.error('Restore failed:', err.message);
    return false;
  }
}

async function main() {
  requireConfig();
  const client = getS3Client();

  const command = process.argv[2];

  if (command === '--list') {
    await listBackups(client);
  } else if (command) {
    // Assume it's a backup filename
    const backupKey = `${PREFIX}${command}`;
    const success = await restoreFromBackup(client, backupKey);
    process.exit(success ? 0 : 1);
  } else {
    console.log('Usage:');
    console.log('  List backups:           node scripts/restoreDatabase.js --list');
    console.log('  Restore from backup:    RESTORE_CONFIRM=yes node scripts/restoreDatabase.js <backup-filename>');
    console.log('\nExample:');
    console.log('  node scripts/restoreDatabase.js --list');
    console.log('  RESTORE_CONFIRM=yes node scripts/restoreDatabase.js scout-bridge-analytics-2024-01-15T14-30-45.archive.gz');
  }
}

main().catch((err) => {
  console.error('[error]', err.message);
  process.exit(1);
});
