# MongoDB major-version upgrade runbook

> **Priority: high.** The AWS Compose deployment currently defaults to MongoDB 6.0. MongoDB 6.0 reached end of support on July 31, 2025. Do not leave a public application on this release.

This guide is for the single-node MongoDB service in `compose.aws.yml`. It documents a staged upgrade path from MongoDB 6.0 through 7.0 to 8.0. It does not run or authorize an upgrade on a live host.

## Before scheduling the upgrade

1. Confirm the server is on the latest available 6.0 patch and its feature compatibility version (FCV) is `6.0`. The MongoDB 8.0 upgrade path requires MongoDB 7.0 first; do not jump directly from 6.0 to 8.0.
2. Review the official MongoDB 7.0 and 8.0 compatibility changes and confirm the Node.js driver version used by Mongoose supports the target server.
3. Test the application and the full upgrade sequence in an isolated staging deployment using a copy of production data.
4. Create a fresh backup outside the EC2 instance and verify that it can be restored to an isolated database. A backup that has not been restored is not a verified recovery plan.
5. Plan for downtime. The compose deployment is a standalone database, not a replica set.

Use the latest patch release in each series when performing the migration. At the time this runbook was written, the MongoDB patch releases were 7.0.43 and 8.0.29. Recheck MongoDB's release notes before starting.

## Upgrade from 6.0 to 7.0

Run commands from the repository directory on the EC2 host. Keep the current database volume. **Do not run `docker compose down -v` or delete the `mongodb_data` volume.**

1. Stop incoming traffic and all application writers:

   ```bash
   docker compose --env-file .env.aws -f compose.aws.yml stop cloudflared app analysis-daemon
   ```

2. Edit the private `.env.aws` file and set `MONGODB_IMAGE` to the latest 7.0 patch tag. For example:

   ```dotenv
   MONGODB_IMAGE=mongo:7.0.43-jammy
   ```

   The Compose file accepts this variable and retains its old 6.0 default for existing installations that have not begun the migration.

3. Pull and start only MongoDB:

   ```bash
   docker compose --env-file .env.aws -f compose.aws.yml pull mongodb
   docker compose --env-file .env.aws -f compose.aws.yml up -d mongodb
   docker compose --env-file .env.aws -f compose.aws.yml logs --tail=100 mongodb
   ```

   Confirm that the database is healthy and reports version 7.0. Keep the API and analysis daemon stopped while validating the database.

4. Connect to `mongosh` in the MongoDB container using the root credentials already configured in the container:

   ```bash
   docker compose --env-file .env.aws -f compose.aws.yml exec mongodb sh
   mongosh --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin
   ```

   Check the FCV:

   ```javascript
   db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 })
   ```

5. Exit the container shell and start the application services while MongoDB 7.0 is still using FCV 6.0. Verify sign-in, core API operations, uploads, and analysis. Keep FCV at 6.0 during a burn-in period:

   ```bash
   docker compose --env-file .env.aws -f compose.aws.yml up -d app analysis-daemon cloudflared
   docker compose --env-file .env.aws -f compose.aws.yml ps
   ```

6. After the burn-in succeeds, stop writers again, reconnect to `mongosh`, and enable 7.0 features:

   ```bash
   docker compose --env-file .env.aws -f compose.aws.yml stop cloudflared app analysis-daemon
   docker compose --env-file .env.aws -f compose.aws.yml exec mongodb sh
   mongosh --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin
   ```

   Then run:

   ```javascript
   db.adminCommand({ setFeatureCompatibilityVersion: "7.0", confirm: true })
   ```

7. Start the application services again, verify them, and confirm a fresh backup before beginning the next major-version step.

## Upgrade from 7.0 to 8.0

Repeat the maintenance window and stop `cloudflared`, `app`, and `analysis-daemon`. Set `MONGODB_IMAGE` to the latest 8.0 patch tag. For example, the current patch at the time this runbook was written is:

```dotenv
MONGODB_IMAGE=mongo:8.0.29-noble
```

Pull and recreate only the database service using the commands from the 7.0 step. Confirm that it reports version 8.0 and that FCV remains 7.0. Start the application services with FCV 7.0, verify core behavior, and allow a burn-in period. Then stop writers, reconnect to `mongosh`, and enable 8.0 features:

```javascript
db.adminCommand({ setFeatureCompatibilityVersion: "8.0", confirm: true })
```

Restart and verify the application services. Confirm a fresh backup and monitor the app, analysis queue, and database logs closely.

## Recovery and downgrade cautions

Do not treat changing `MONGODB_IMAGE` back to an older tag as a rollback plan. Once FCV has advanced or the newer server has persisted incompatible data, the older server may not start safely. Preserve the original volume and use the verified backup recovery plan in [server/docs/BACKUP_STRATEGY.md](server/docs/BACKUP_STRATEGY.md) if recovery is needed. Test that recovery procedure in staging before the production migration.

MongoDB's official procedures require the sequential 6.0 → 7.0 → 8.0 path, a compatible FCV at each transition, and application compatibility checks. Follow the official documentation for [upgrading a standalone to 7.0](https://www.mongodb.com/docs/v7.0/release-notes/7.0-upgrade-standalone/) and [upgrading a standalone to 8.0](https://www.mongodb.com/docs/v8.0/release-notes/8.0-upgrade-standalone/).
