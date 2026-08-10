# ScoutBridge Analytics - Deployment Guide

## Production Deployment Checklist

### Pre-Deployment (1-2 weeks before)

#### Code Readiness
- [x] All Phase 5 features implemented and committed
- [x] Frontend and backend builds passing
- [x] No console errors or warnings in production build
- [x] All TypeScript types validated
- [x] Linting passes without errors
- [x] Test suite runs successfully

#### Environment Setup
- [ ] Production MongoDB cluster created with backups
- [ ] Redis cluster deployed and secured
- [ ] AWS S3 buckets created (videos, public assets)
- [ ] Stripe account configured with production keys
- [ ] Email service (Resend/SendGrid) configured
- [ ] Domain DNS configured and SSL certificates ready
- [ ] CDN (CloudFlare) configured
- [ ] Monitoring tools integrated (Sentry, DataDog, etc.)

#### Security Review
- [ ] Security audit completed
- [ ] OWASP top 10 vulnerabilities checked
- [ ] Database permissions reviewed
- [ ] API rate limiting configured
- [ ] CORS policies verified
- [ ] Secrets management configured (no .env in git)
- [ ] SSL/TLS certificates installed

### Deployment Day (Production Release)

#### Pre-Launch Tasks (6 hours before)

1. **Final Testing in Staging:**
   ```bash
   # 1. Run full test suite
   npm test
   
   # 2. Performance test
   npm run test:performance
   
   # 3. Load test (1000 concurrent users)
   npm run test:load
   
   # 4. Security scan
   npm run test:security
   ```

2. **Database Migration:**
   ```bash
   # Create backup
   mongodump --uri="mongodb+srv://..." --out=backups/pre-production-$(date +%Y%m%d)
   
   # Run migrations (if any)
   npm run migrate:prod
   ```

3. **Asset Preparation:**
   ```bash
   # Upload static assets to CDN
   npm run deploy:assets
   
   # Verify CDN distribution
   curl -I https://cdn.scoutbridge.com/index.html
   ```

#### Launch Phase (Production Deployment)

1. **Backend Deployment:**
   ```bash
   # Deploy to production servers
   git checkout main
   git pull origin main
   npm install --production
   npm run build:server
   
   # Start with PM2
   pm2 start server.js --name scoutbridge-api --watch false
   pm2 save
   
   # Verify health
   curl https://api.scoutbridge.com/health
   ```

2. **Frontend Deployment:**
   ```bash
   # Build and deploy frontend
   cd client
   npm install --production
   npm run build
   
   # Deploy to CDN/hosting
   npm run deploy:frontend
   
   # Verify deployment
   curl -I https://app.scoutbridge.com
   ```

3. **Configuration Activation:**
   ```bash
   # Activate environment variables (via CI/CD or manual)
   # Verify with health check
   curl https://api.scoutbridge.com/api/health
   ```

#### Post-Launch Verification (First 2 hours)

1. **Critical Path Testing:**
   ```bash
   # 1. User signup flow
   # 2. Email verification
   # 3. Login/authentication
   # 4. Subscription creation
   # 5. Video upload
   # 6. Video analysis
   # 7. Report generation
   # 8. Export functionality
   ```

2. **Monitoring Checks:**
   - [ ] Error rate < 0.1%
   - [ ] API response time < 500ms (p95)
   - [ ] Database query time < 100ms (p95)
   - [ ] CPU usage < 70%
   - [ ] Memory usage < 80%
   - [ ] Disk usage < 85%

3. **External Service Verification:**
   - [ ] Stripe webhooks receiving events
   - [ ] Email sending working
   - [ ] S3 uploads functional
   - [ ] Redis cache working
   - [ ] CDN serving assets

### Post-Deployment (Hours 2-24)

#### Monitoring Dashboard
- Set up real-time dashboards for:
  - Error rate and types
  - API latency
  - Database performance
  - Subscription metrics
  - User activity
  - System resources

#### Alert Configuration
- Critical: Error rate > 1%
- Critical: Response time > 2s (p95)
- Warning: CPU > 80%
- Warning: Memory > 90%
- Warning: Disk > 95%

#### First Day Checklist
- [ ] No critical errors in logs
- [ ] All integrations working
- [ ] Scaling handles traffic
- [ ] Backups running successfully
- [ ] All team notified and monitoring

### Rollback Plan (If Issues Arise)

```bash
# 1. Immediate health check
curl https://api.scoutbridge.com/health

# 2. Check logs for errors
tail -f /var/log/scoutbridge/error.log

# 3. If critical: Revert to previous commit
git revert HEAD --no-edit
npm install
npm run build
pm2 restart scoutbridge-api

# 4. Verify rollback
curl https://api.scoutbridge.com/health

# 5. Notify team
# Incident report in #incidents channel
```

## Continuous Deployment

### CI/CD Pipeline Configuration

#### GitHub Actions Workflow

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run lint
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm run build:client
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H $PRODUCTION_SERVER >> ~/.ssh/known_hosts
          ssh -i ~/.ssh/deploy_key $PRODUCTION_USER@$PRODUCTION_SERVER \
            'cd /app/scoutbridge && git pull && npm install && npm run build && pm2 restart all'
```

## Infrastructure as Code

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["node", "server.js"]
```

Build and deploy:

```bash
docker build -t scoutbridge:1.0.0 .
docker tag scoutbridge:1.0.0 registry.example.com/scoutbridge:latest
docker push registry.example.com/scoutbridge:latest

# Deploy to Kubernetes
kubectl set image deployment/scoutbridge-api \
  scoutbridge-api=registry.example.com/scoutbridge:latest
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scoutbridge-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: scoutbridge-api
  template:
    metadata:
      labels:
        app: scoutbridge-api
    spec:
      containers:
      - name: scoutbridge-api
        image: registry.example.com/scoutbridge:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: scoutbridge-secrets
              key: mongodb-uri
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Backup & Disaster Recovery

### Daily Backup Strategy

```bash
#!/bin/bash
# backup.sh - Daily backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/scoutbridge/$DATE"

mkdir -p $BACKUP_DIR

# MongoDB backup
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/mongodb"

# Upload to S3
aws s3 sync $BACKUP_DIR s3://scoutbridge-backups/

# Keep only last 30 days
find /backups/scoutbridge -type d -mtime +30 -exec rm -rf {} \;
```

Schedule in crontab:
```bash
# Daily at 2 AM
0 2 * * * /scripts/backup.sh >> /var/log/backups.log 2>&1
```

## Performance Optimization

### Frontend Optimization

```bash
# Bundle analysis
npm run build -- --analyze

# Code splitting review
# Lazy load routes for performance
# Compress images
# Implement service worker caching
```

### Backend Optimization

```bash
# Database indexing
db.users.createIndex({ email: 1 })
db.subscriptions.createIndex({ userId: 1, status: 1 })
db.auditlogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 })

# Query optimization
# Use aggregation pipeline for complex queries
# Implement pagination for large result sets
# Cache frequent queries in Redis
```

## Support & Incident Response

### War Room Setup

- Slack channel: #incidents
- StatusPage: https://status.scoutbridge.com
- Incident commander designated
- 24/7 on-call rotation

### Incident Response Checklist

1. Identify and assess issue severity
2. Post to #incidents channel
3. Update StatusPage
4. Begin investigation
5. Implement fix or rollback
6. Verify resolution
7. Post-mortem within 24 hours
8. Implementation of preventive measures

## Support Contacts

- **Technical Support:** support@scoutbridge.com
- **Billing Issues:** billing@scoutbridge.com
- **Security Concerns:** security@scoutbridge.com
- **Emergency Hotline:** +1-XXX-XXX-XXXX
