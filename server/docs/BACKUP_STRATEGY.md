# Database Backup & Recovery Strategy

## Overview

This document describes ScoutBridge Analytics' production database backup and disaster recovery procedures.

## Problem Statement (P0 Blocker)

**Previous state:**
- ❌ No documented backup strategy
- ❌ No automated backup mechanism
- ❌ Data loss = total platform failure
- ❌ No recovery procedures
- ❌ No backup retention policy

**Impact**: Production instances had zero disaster recovery capability. Any database failure resulted in total data loss with no way to restore service.

## Solution: Automated S3-Backed Backups

**New implementation:**
- ✅ Automated daily backups via `backupDatabase.js`
- ✅ Backups streamed to S3 (or S3-compatible storage)
- ✅ Gzip compression for efficient storage
- ✅ Retention policy (30 days by default, configurable)
- ✅ Restore procedures via `restoreDatabase.js`
- ✅ GitHub Actions workflow for scheduling

## Architecture

### Backup Flow

```
MongoDB Database
       ↓
   mongodump
       ↓
   gzip compression
       ↓
   Stream to S3
       ↓
   S3 Bucket
   (30-day retention)
```

### Recovery Flow

```
S3 Backup File
       ↓
   Download from S3
       ↓
   gunzip decompression
       ↓
   mongorestore --drop
       ↓
   Restored MongoDB Database
```

## Components

### 1. Backup Script (`server/scripts/backupDatabase.js`)

**What it does:**
- Runs `mongodump` with `--archive --gzip` flags
- Streams output directly to S3 (no local disk buffering)
- Generates timestamped filename: `scout-bridge-analytics-2024-01-15T14-30-45.archive.gz`
- Automatically prunes backups older than retention period
- Logs all operations for audit trail

**Requirements:**
- MongoDB Database Tools installed (mongodump binary)
- S3 credentials configured
- Write access to S3 backup bucket

### 2. Restore Script (`server/scripts/restoreDatabase.js`)

**What it does:**
- Lists available backups from S3
- Downloads backup archive from S3
- Decompresses and pipes to mongorestore
- Uses `--drop` flag to replace existing database (destructive!)
- Requires explicit confirmation via env variable

**Requirements:**
- MongoDB Database Tools installed (mongorestore binary)
- S3 credentials configured
- Read access to S3 backup bucket

### 3. GitHub Actions Workflow (`.github/workflows/backup.yml`)

**What it does:**
- Runs scheduled backups (daily at 2 AM UTC)
- Uploads backups to S3 automatically
- Emails on failure
- Can be triggered manually

## Configuration

### Environment Variables

```bash
# MongoDB connection
MONGODB_URI=mongodb://username:password@host:27017/database

# S3 backup storage
BACKUP_S3_BUCKET=my-company-backups        # Required
S3_REGION=us-east-1                        # Default: us-east-1
S3_ENDPOINT=https://s3.amazonaws.com       # Optional (for S3-compatible services)
S3_ACCESS_KEY_ID=***                       # Required for backups
S3_SECRET_ACCESS_KEY=***                   # Required for backups

# Backup retention
BACKUP_RETENTION_DAYS=30                   # Default: 30 days
```

### .env Configuration

```bash
# Example .env file
MONGODB_URI=mongodb://admin:password@mongodb.example.com:27017/scoutbridge
BACKUP_S3_BUCKET=scout-bridge-backups
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=REPLACE_WITH_AWS_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY=REPLACE_WITH_AWS_SECRET_ACCESS_KEY
BACKUP_RETENTION_DAYS=30
```

## Usage

### Manual Backup

```bash
# Create a backup immediately
cd server
node scripts/backupDatabase.js

# Output:
# [backup] Starting mongodump -> s3://my-backups/scout-bridge-analytics-2024-01-15T14-30-45.archive.gz
# [backup] Upload complete.
# [backup] Pruned 0 backup(s) older than 30 days.
```

### List Available Backups

```bash
node scripts/restoreDatabase.js --list

# Output:
# Listing backups from s3://my-backups/backups/
#
# Available backups:
#   1. scout-bridge-analytics-2024-01-15T14-30-45.archive.gz (45000KB, 1/15/2024, 2:30:45 AM)
#   2. scout-bridge-analytics-2024-01-14T14-30-23.archive.gz (44800KB, 1/14/2024, 2:30:23 AM)
#   3. scout-bridge-analytics-2024-01-13T14-29-58.archive.gz (44500KB, 1/13/2024, 2:29:58 AM)
```

### Restore from Backup

```bash
# STEP 1: List available backups
node scripts/restoreDatabase.js --list

# STEP 2: Restore from a specific backup (requires confirmation)
RESTORE_CONFIRM=yes node scripts/restoreDatabase.js scout-bridge-analytics-2024-01-15T14-30-45.archive.gz

# Output:
# 🔄 WARNING: This will DROP your current database and restore from backup.
#    Backup: scout-bridge-analytics-2024-01-15T14-30-45.archive.gz
#    Database: mongodb://...
#
# Downloading backup from S3...
# Starting mongorestore...
# ✅ Database restore completed successfully!
```

## Deployment

### Prerequisites

1. Install MongoDB Database Tools on the machine that runs `mongodump`. The scheduled GitHub Actions workflow uses MongoDB's Ubuntu 22.04 package on an Ubuntu 22.04 runner.
2. Create a dedicated S3 bucket for database backups. Keep it separate from video storage. Enable bucket versioning and block public access.
3. Configure the backup workflow with the bucket name and AWS region. For AWS S3, prefer GitHub OIDC so the workflow receives short-lived credentials instead of storing permanent AWS keys.

### GitHub Actions with AWS OIDC (recommended)

The workflow can assume a narrowly scoped IAM role when the `AWS_ROLE_TO_ASSUME` repository secret is configured and `S3_ENDPOINT` is empty.

1. In AWS IAM, create the GitHub Actions OIDC identity provider if one does not already exist:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. Create an IAM role with a trust policy restricted to this repository's default branch. For this repository, the subject is:

   ```text
   repo:joshuejags/scout-bridge-analytics:ref:refs/heads/master
   ```

   Require audience `sts.amazonaws.com` and use an exact subject match. Do not use a wildcard subject. If GitHub changes the subject format for this repository, confirm the claim format before changing the trust policy.

3. Attach a permission policy scoped to the backup bucket. Replace the example bucket name with the value used for `BACKUP_S3_BUCKET`:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::scout-bridge-database-backups",
         "Condition": {
           "StringLike": {
             "s3:prefix": ["backups/", "backups/*"]
           }
         }
       },
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::scout-bridge-database-backups/backups/*"
       }
     ]
   }
   ```

4. Add these GitHub repository secrets:
   - `AWS_ROLE_TO_ASSUME`: the IAM role ARN
   - `BACKUP_S3_BUCKET`: the dedicated bucket name
   - `S3_REGION`: the bucket's AWS region
   - `MONGODB_URI`: the production MongoDB connection string

   Leave `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` unset for AWS S3. The workflow requests `contents: read` and `id-token: write`; the IAM role trust policy still limits which repository and branch can assume it.

5. Run the backup workflow manually from the `master` branch and verify that the backup appears under `backups/` in the private bucket. After successful OIDC operation, remove and revoke any old long-lived IAM access keys that were used only by this workflow.

### S3-compatible providers

For Cloudflare R2 or another S3-compatible provider, do not configure `AWS_ROLE_TO_ASSUME`. Set `S3_ENDPOINT` and the provider's `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` repository secrets. The workflow will use those static S3-compatible credentials instead of AWS OIDC.

The `S3_ENDPOINT` value should be the provider endpoint for the account or bucket. Keep the access key restricted to the backup bucket and required operations.

### Workflow behavior

- Workflow file: `.github/workflows/backup.yml`
- Scheduled daily at 03:00 UTC; can also be run manually.
- If the AWS role secret is configured and no custom endpoint is set, OIDC credentials are used and static-key environment variables are left empty.
- Without OIDC, the workflow can use the existing static S3 credential secrets. For AWS S3, migrate to OIDC and then revoke the permanent keys.

## Testing Backup & Recovery

### Test Backup

```bash
# 1. Create a backup
node scripts/backupDatabase.js

# 2. Verify it's in S3
aws s3 ls s3://my-company-backups/backups/ --recursive

# 3. Check backup size
aws s3 ls s3://my-company-backups/backups/ --summarize
```

### Test Recovery (NON-PRODUCTION)

⚠️ **NEVER test recovery on production database!**

```bash
# 1. Set up a test MongoDB instance
docker run -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest

# 2. Set MONGODB_URI to test instance
export MONGODB_URI=mongodb://admin:password@localhost:27017/test-restore

# 3. List and restore from backup
node scripts/restoreDatabase.js --list
RESTORE_CONFIRM=yes node scripts/restoreDatabase.js scout-bridge-analytics-2024-01-15T14-30-45.archive.gz

# 4. Verify data
# Connect to test instance and verify collections/documents are restored
```

## Monitoring & Alerts

### Backup Monitoring

**What to monitor:**
- Backup completion time (should complete in < 5 minutes)
- Backup file size (should be ~40-50 MB typically)
- S3 upload success/failure
- Old backup pruning

### Alerts

**Email notifications (GitHub Actions):**
- On backup failure
- On missing recent backups
- On S3 upload errors

**CloudWatch Alerts (AWS):**
```bash
# Alert if no backups created in 24 hours
aws cloudwatch put-metric-alarm \
  --alarm-name backup-missing \
  --alarm-description "Alert if no backup in last 24 hours" \
  --metric-name NumberOfObjects \
  --namespace AWS/S3 \
  --statistic Average \
  --period 3600 \
  --threshold 1 \
  --comparison-operator LessThanThreshold
```

### Manual Verification

```bash
# Weekly: verify recent backups exist
aws s3 ls s3://my-company-backups/backups/ --summarize

# Monthly: test restore on non-production environment
export MONGODB_URI=mongodb://admin:password@test-db:27017/test
RESTORE_CONFIRM=yes node scripts/restoreDatabase.js <backup-filename>
```

## Disaster Recovery Procedures

### Scenario 1: Database Corruption

**Procedure:**
1. Identify last good backup from `restoreDatabase.js --list`
2. Document affected time period
3. Create backup of corrupted database (for debugging)
4. Restore from last good backup: `RESTORE_CONFIRM=yes node scripts/restoreDatabase.js <backup>`
5. Notify users of recovered data cutoff time
6. Run integrity checks on restored data

### Scenario 2: Ransomware/Malicious Deletion

**Procedure:**
1. Immediately disconnect database from network
2. Check S3 bucket for signs of tampering
3. Verify backups have correct sizes (not zero-sized corrupted files)
4. Restore from oldest available backup with confidence
5. Check Git commit history for the exact data state needed
6. Restore to that specific point in time if possible

### Scenario 3: Storage Failure

**Procedure:**
1. Provision new MongoDB instance in same region
2. Set `MONGODB_URI` to new instance
3. Download latest backup from S3: `aws s3 cp s3://my-backups/backups/latest.archive.gz ./`
4. Restore: `RESTORE_CONFIRM=yes node scripts/restoreDatabase.js latest.archive.gz`
5. Verify data integrity
6. Update app servers to point to new database
7. Run smoke tests

## Performance Metrics

### Backup Performance

| Operation | Time | Size | Notes |
|-----------|------|------|-------|
| Full database dump | ~2-3 min | ~40-50 MB | Depends on data volume |
| S3 upload | ~1-2 min | N/A | Depends on network/S3 speed |
| Gzip compression | Built-in | 80% reduction | Includes in mongodump time |
| Backup pruning | < 30 sec | N/A | Only deletes old backups |

### Storage Costs (AWS S3)

Assuming 50 MB backups, 30-day retention, daily backups:
- Storage: 50 MB × 30 backups = 1.5 GB = ~$0.04/month
- Request costs: 30 PutObject + 1 ListObjects = negligible
- **Total:** ~$0.05-0.10/month (very inexpensive)

## Recovery Time Objective (RTO)

- **Time to restore**: ~3-5 minutes (depends on database size)
- **Verification time**: ~2-3 minutes
- **User notification**: ~5 minutes
- **Total**: ~10-15 minutes to restore service

## Backup Retention Policy

**Default:** 30 days

**Rationale:**
- Covers monthly cycles (month-end issues discovered 2-3 days later)
- Balances cost vs. historical coverage
- Long-term backups (> 30 days) kept manually or archived to cheaper storage

**Override:**
```bash
# Keep backups for 90 days
BACKUP_RETENTION_DAYS=90 node scripts/backupDatabase.js

# Keep backups for 1 year (expensive!)
BACKUP_RETENTION_DAYS=365 node scripts/backupDatabase.js
```

## Best Practices

✅ **DO:**
- Run backups daily (automated via GitHub Actions)
- Test restore procedures monthly on non-production
- Monitor backup size (should be consistent ±10%)
- Keep separate S3 bucket for backups
- Enable S3 versioning for extra protection
- Store backup credentials separately from app secrets
- Archive old backups to Glacier after 30 days (cheaper long-term storage)

❌ **DON'T:**
- Store backups in the same bucket as video data
- Use backup S3 bucket for other purposes
- Skip testing restoration procedures
- Restore to production without verification
- Delete backups manually (use retention policy instead)
- Leave backup credentials in code/repository

## Additional Resources

- MongoDB Backup: https://docs.mongodb.com/manual/backup-and-restore/
- Database Tools Download: https://www.mongodb.com/try/download/database-tools
- S3 Lifecycle Policies: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html
- AWS IAM Policies: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html

## Support

For backup/restore issues:
1. Check MongoDB Database Tools are installed: `mongodump --version`
2. Verify S3 credentials: `aws s3 ls`
3. Check logs: `[backup]` and `[error]` prefixes in output
4. File issue with: backup logs, MongoDB version, S3 bucket name
