# ScoutBridge Analytics - Launch Checklist & Operations Runbook

## Pre-Launch Configuration (1-2 weeks before go-live)

### Week 1: External Services & Infrastructure

#### Stripe Configuration
- [ ] Create Stripe account (if not done)
- [ ] Set up products for each subscription tier
  - [ ] Free plan (no products needed)
  - [ ] Scout Pro ($9.99/month or $89.99/year)
  - [ ] Club Pro ($29.99/month or $269.99/year)
  - [ ] Enterprise (custom pricing)
- [ ] Configure webhook endpoints
  - [ ] `POST /api/webhooks/stripe` for all events
  - [ ] Enable events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] Add webhook signing secret to `.env` as `STRIPE_WEBHOOK_SECRET`
- [ ] Generate API keys and save to `.env`:
  - [ ] `STRIPE_SECRET_KEY` (live key)
  - [ ] `STRIPE_PUBLISHABLE_KEY` (live key)
  - [ ] `STRIPE_PRICE_SCOUT_PRO_MONTHLY` (product ID)
  - [ ] `STRIPE_PRICE_SCOUT_PRO_ANNUAL` (product ID)
  - [ ] `STRIPE_PRICE_CLUB_PRO_MONTHLY` (product ID)
  - [ ] `STRIPE_PRICE_CLUB_PRO_ANNUAL` (product ID)
  - [ ] `STRIPE_PRICE_ENTERPRISE` (product ID)
- [ ] Test webhook delivery
- [ ] Verify webhook signature verification works

#### Email Service Setup
- [ ] Choose email provider (Resend, SendGrid, or SMTP)
  
**Option A: Resend (Recommended)**
- [ ] Create Resend account
- [ ] Verify domain and DNS records
- [ ] Generate API key and add to `.env` as `RESEND_API_KEY`
- [ ] Update `SMTP_FROM_EMAIL` to `noreply@yourdomain.com`
- [ ] Test email delivery

**Option B: SendGrid**
- [ ] Create SendGrid account
- [ ] Verify sender identity
- [ ] Generate API key and add to `.env` as `SENDGRID_API_KEY`
- [ ] Update `SMTP_FROM_EMAIL` to verified address
- [ ] Test email delivery

**Option C: SMTP (Generic)**
- [ ] Configure SMTP settings in `.env`:
  - [ ] `SMTP_HOST` (e.g., smtp.gmail.com)
  - [ ] `SMTP_PORT` (usually 587)
  - [ ] `SMTP_USER` (email address)
  - [ ] `SMTP_PASS` (app password, not account password)
  - [ ] `SMTP_FROM_EMAIL` (display address)
  - [ ] `SMTP_FROM_NAME` ("ScoutBridge Analytics")
- [ ] Test email delivery

#### AWS S3 Configuration
- [ ] Create AWS account and S3 buckets
- [ ] Create two buckets:
  - [ ] `scoutbridge-videos` - for video uploads
  - [ ] `scoutbridge-exports` - for downloadable reports/exports
- [ ] Enable versioning on both buckets
- [ ] Set up lifecycle policies (30-day deletion for old versions)
- [ ] Configure CORS to allow frontend access
- [ ] Create IAM user with S3 access only
- [ ] Generate access keys and add to `.env`:
  - [ ] `AWS_ACCESS_KEY_ID`
  - [ ] `AWS_SECRET_ACCESS_KEY`
  - [ ] `AWS_S3_REGION` (e.g., us-east-1)
  - [ ] `AWS_S3_BUCKET_VIDEOS`
  - [ ] `AWS_S3_BUCKET_EXPORTS`
- [ ] Set up CloudFront CDN for videos
- [ ] Add CloudFront domain to `.env` as `AWS_CLOUDFRONT_DOMAIN`
- [ ] Test video upload to S3
- [ ] Test export download from S3

#### MongoDB Setup
- [ ] Create MongoDB Atlas account (if not done)
- [ ] Create production cluster (M10 minimum for prod)
  - [ ] Enable automatic backups (daily)
  - [ ] Enable point-in-time restore (30-day window)
  - [ ] Enable authentication and strong passwords
  - [ ] Whitelist production server IPs
- [ ] Create database and collection indexes:
  ```javascript
  // Run these on production MongoDB
  db.users.createIndex({ email: 1 }, { unique: true });
  db.users.createIndex({ stripeCustomerId: 1 });
  db.users.createIndex({ organizationId: 1 });
  
  db.subscriptions.createIndex({ userId: 1 });
  db.subscriptions.createIndex({ stripeSubscriptionId: 1 }, { unique: true });
  db.subscriptions.createIndex({ status: 1 });
  
  db.organizations.createIndex({ slug: 1 }, { unique: true });
  db.organizations.createIndex({ owner: 1 });
  
  db.auditlogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
  db.auditlogs.createIndex({ organizationId: 1 });
  db.auditlogs.createIndex({ action: 1 });
  
  db.notifications.createIndex({ userId: 1 });
  db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
  db.notifications.createIndex({ read: 1 });
  
  db.videos.createIndex({ uploadedBy: 1 });
  db.videos.createIndex({ createdAt: -1 });
  
  db.reportexports.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  db.reportexports.createIndex({ userId: 1 });
  
  db.operationalmetrics.createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 });
  db.operationalmetrics.createIndex({ metricType: 1 });
  ```
- [ ] Add MongoDB connection string to `.env` as `MONGODB_URI`
- [ ] Test connection from production server
- [ ] Set up automated backups
- [ ] Test restore procedure

#### Redis Setup
- [ ] Create Redis cluster (Redis Cloud or self-hosted)
  - [ ] Minimum 2GB for production
  - [ ] Enable persistence (RDB snapshots)
  - [ ] Enable replication for high availability
  - [ ] Set strong authentication password
- [ ] Add Redis URL to `.env` as `REDIS_URL`
- [ ] Test connection from production server
- [ ] Configure key eviction policy: `allkeys-lru`

### Week 2: Backend Configuration

#### Environment Variables
- [ ] Create `.env.production` with all required variables
- [ ] Review [ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md) for complete list
- [ ] Essential variables to set:
  ```
  NODE_ENV=production
  MONGODB_URI=<production-mongodb-url>
  REDIS_URL=<production-redis-url>
  JWT_SECRET=<secure-random-string>
  JWT_REFRESH_SECRET=<secure-random-string>
  STRIPE_SECRET_KEY=<stripe-live-key>
  STRIPE_WEBHOOK_SECRET=<webhook-secret>
  STRIPE_PRICE_*=<all-price-ids>
  RESEND_API_KEY=<api-key>
  AWS_ACCESS_KEY_ID=<key>
  AWS_SECRET_ACCESS_KEY=<secret>
  AWS_S3_BUCKET_VIDEOS=<bucket-name>
  AWS_S3_BUCKET_EXPORTS=<bucket-name>
  FRONTEND_URL=<https://yourdomain.com>
  BACKEND_URL=<https://api.yourdomain.com>
  VAPID_PUBLIC_KEY=<vapid-key>
  VAPID_PRIVATE_KEY=<vapid-key>
  ```
- [ ] Never commit `.env.production` to git
- [ ] Use deployment secrets (GitHub Actions, environment variables)

#### Application Configuration
- [ ] Update allowed origins for CORS
  ```javascript
  // server/app.js
  app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  }));
  ```
- [ ] Configure rate limiting for production
- [ ] Set up logging (Winston/Morgan config)
- [ ] Configure error tracking (Sentry)
  ```bash
  npm install @sentry/node --save
  ```

#### Monitoring Setup
- [ ] Create Sentry.io account
- [ ] Create project for ScoutBridge
- [ ] Add Sentry DSN to `.env` as `SENTRY_DSN`
- [ ] Initialize Sentry in `server/app.js`:
  ```javascript
  const Sentry = require('@sentry/node');
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  app.use(Sentry.Handlers.errorHandler());
  ```
- [ ] Test error tracking with test error

#### Security Configuration
- [ ] Generate strong JWT secrets (32+ character random strings)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Enable HTTPS only (redirect HTTP to HTTPS)
- [ ] Set up HSTS headers
- [ ] Configure helmet for security headers
  ```javascript
  const helmet = require('helmet');
  app.use(helmet());
  ```
- [ ] Set up rate limiting on auth endpoints
- [ ] Configure CORS with production domain only

### Week 2: Frontend Configuration

#### Build Configuration
- [ ] Update API endpoints in `.env.production`:
  ```
  REACT_APP_API_URL=https://api.yourdomain.com
  REACT_APP_STRIPE_PUBLIC_KEY=<stripe-publishable-key>
  REACT_APP_VAPID_PUBLIC_KEY=<vapid-public-key>
  REACT_APP_ENVIRONMENT=production
  ```
- [ ] Build production bundle:
  ```bash
  npm run build
  ```
- [ ] Verify bundle size < 500KB gzipped
- [ ] Test PWA functionality
- [ ] Verify service worker is registered

#### PWA Configuration
- [ ] Update `public/manifest.json` with correct domain
- [ ] Verify HTTPS on production
- [ ] Test PWA installation on mobile
- [ ] Test offline functionality
- [ ] Configure Web App Install Banner

#### CDN & Caching
- [ ] Set up CDN (Cloudflare, CloudFront, or similar)
- [ ] Configure cache headers:
  - [ ] Static assets: 1 year
  - [ ] index.html: 1 hour
  - [ ] API responses: no-cache
- [ ] Enable gzip compression
- [ ] Set up security headers via CDN

---

## Deployment Procedure (Day Before Launch)

### Pre-Deployment Testing

#### Database
- [ ] Test connection to production MongoDB
- [ ] Verify all collections exist
- [ ] Verify indexes are created
- [ ] Run test queries
- [ ] Test backup/restore procedures
- [ ] Verify TTL indexes working (wait 5 minutes)

#### External Services
- [ ] Test Stripe webhook delivery
- [ ] Test email delivery
- [ ] Test S3 upload/download
- [ ] Test Redis connection
- [ ] Test all API keys and secrets

#### Application
- [ ] Run full test suite locally
- [ ] Build frontend and backend
- [ ] Run linter and type checker
- [ ] No errors or critical warnings
- [ ] Test critical user journeys in staging

#### Load Testing
- [ ] Run load test with 100 concurrent users
- [ ] Run load test with 500 concurrent users
- [ ] Verify response times < 500ms p95
- [ ] Verify error rate < 0.1%
- [ ] Monitor database under load

### Staging Validation (Complete 2-3 hours before launch)

#### Full User Journey Testing
- [ ] [ ] Sign up new user
- [ ] [ ] Receive verification email
- [ ] [ ] Verify email
- [ ] [ ] Login
- [ ] [ ] Subscribe to Scout Pro plan
- [ ] [ ] Verify Stripe payment processed
- [ ] [ ] Receive subscription confirmation email
- [ ] [ ] Upload video
- [ ] [ ] Trigger analysis
- [ ] [ ] View analysis results
- [ ] [ ] Generate and export report
- [ ] [ ] Receive notification
- [ ] [ ] View audit logs (admin)
- [ ] [ ] Logout

#### Mobile Testing
- [ ] [ ] Access on iPhone (iOS)
- [ ] [ ] Access on Android phone
- [ ] [ ] Test responsive design
- [ ] [ ] Test PWA installation
- [ ] [ ] Test offline functionality
- [ ] [ ] Test touch interactions

#### API Testing
- [ ] [ ] Test all critical endpoints
- [ ] [ ] Verify rate limiting works
- [ ] [ ] Verify authentication required
- [ ] [ ] Verify authorization enforced
- [ ] [ ] Test error responses

#### Monitoring
- [ ] [ ] Verify Sentry error tracking works
- [ ] [ ] Verify monitoring dashboard accessible
- [ ] [ ] Verify alerts configured
- [ ] [ ] Test alert notification

### Pre-Launch Checklist (1 hour before)

- [ ] All code merged to main branch
- [ ] All tests passing
- [ ] No critical errors in Sentry
- [ ] All external services confirmed working
- [ ] Database backups created
- [ ] Rollback procedure tested and documented
- [ ] Monitoring dashboards open and ready
- [ ] Incident response team on standby
- [ ] Communication channels open
- [ ] Status page configured (if applicable)

---

## Launch Procedure (Go-Live)

### Phase 1: Deployment (30 minutes)

1. **Code Deployment**
   ```bash
   # Verify git status
   git status
   git log --oneline -5
   
   # Build backend
   cd server
   npm run build  # or npm install if needed
   
   # Build frontend
   cd ../client
   npm run build
   
   # Deploy (using Docker/Kubernetes)
   docker build -t scoutbridge:v1.0.0 .
   docker push <registry>/scoutbridge:v1.0.0
   kubectl set image deployment/scoutbridge \
     app=<registry>/scoutbridge:v1.0.0
   kubectl rollout status deployment/scoutbridge
   ```

2. **Health Checks**
   ```bash
   # Backend health check
   curl https://api.yourdomain.com/api/health
   
   # Verify database connected
   curl https://api.yourdomain.com/api/monitoring/health
   
   # Check error rate in Sentry
   # Should be 0% for first few minutes
   ```

3. **Feature Validation**
   ```bash
   # Verify all critical endpoints accessible
   curl https://api.yourdomain.com/api/auth/me
   curl https://api.yourdomain.com/api/subscription/plans
   curl https://api.yourdomain.com/api/notifications
   ```

### Phase 2: Monitoring (30-60 minutes after launch)

- [ ] Monitor API response times (target: < 500ms p95)
- [ ] Monitor error rate (target: < 0.1%)
- [ ] Monitor database queries (target: < 100ms p95)
- [ ] Monitor Redis memory usage
- [ ] Monitor server CPU (target: < 70%)
- [ ] Monitor server memory (target: < 80%)
- [ ] Check Sentry for errors (should be near 0%)
- [ ] Verify email delivery working
- [ ] Verify Stripe webhooks processing
- [ ] Check CloudFront cache hit rate

### Phase 3: User Onboarding (1-2 hours after launch)

- [ ] Enable user signups
- [ ] Monitor new user registration
- [ ] Monitor subscription purchases
- [ ] Check support tickets/emails
- [ ] Verify video uploads working
- [ ] Verify analysis processing
- [ ] Test video playback
- [ ] Check notification delivery

### Phase 4: Scaling (After 4 hours if needed)

If error rate or latency increases:
```bash
# Scale backend servers
kubectl scale deployment/scoutbridge --replicas=3

# Scale database connections
# Increase MongoDB Atlas tier if needed

# Monitor and confirm improvements
kubectl get pods
curl https://api.yourdomain.com/api/monitoring/health
```

---

## Incident Response (If Issues Occur)

### Minor Issues (Error rate 0.1-1%)

1. **Investigate**
   ```bash
   # Check Sentry for error patterns
   # Check logs for correlations
   # Check monitoring metrics
   ```

2. **Mitigation**
   - [ ] Scale up services if needed
   - [ ] Check and clear cache if needed
   - [ ] Restart problematic services
   - [ ] Monitor for improvement

3. **If Not Resolved in 30 mins**
   - [ ] Proceed to rollback

### Critical Issues (Error rate > 1%, downtime)

1. **Declare Incident**
   - [ ] Notify team leads
   - [ ] Open incident in status page
   - [ ] Post update to Slack

2. **Immediate Actions**
   - [ ] Begin rollback procedure (see below)
   - [ ] Restore from backup if database issue
   - [ ] Disable problematic feature if necessary

3. **Rollback Procedure**
   ```bash
   # Get previous deployment
   kubectl rollout history deployment/scoutbridge
   
   # Rollback to previous version
   kubectl rollout undo deployment/scoutbridge
   
   # Wait for rollback to complete
   kubectl rollout status deployment/scoutbridge
   
   # Verify health
   curl https://api.yourdomain.com/api/health
   ```

4. **Post-Incident**
   - [ ] Analyze root cause
   - [ ] Document issue and fix
   - [ ] Create follow-up PR for fix
   - [ ] Schedule retry deployment

---

## Post-Launch Operations

### First 24 Hours

- [ ] Monitor system health continuously
- [ ] Check error rates hourly
- [ ] Review customer feedback
- [ ] Respond to support tickets
- [ ] Monitor database size growth
- [ ] Check backup completion
- [ ] Verify no data loss

### First Week

- [ ] Daily health check meetings
- [ ] Monitor key metrics
- [ ] Fix any issues discovered
- [ ] Optimize performance bottlenecks
- [ ] Gather customer feedback
- [ ] Plan follow-up improvements
- [ ] Document issues found

### Ongoing Operations

#### Daily Tasks
- [ ] Check system health dashboard
- [ ] Review error logs in Sentry
- [ ] Monitor performance metrics
- [ ] Verify backups completed
- [ ] Check disk usage

#### Weekly Tasks
- [ ] Review subscription metrics
- [ ] Check user engagement
- [ ] Review support tickets
- [ ] Verify all integrations working
- [ ] Check security alerts
- [ ] Review cost metrics

#### Monthly Tasks
- [ ] Generate usage reports
- [ ] Review security logs
- [ ] Optimize database
- [ ] Clean up old logs
- [ ] Verify disaster recovery
- [ ] Plan capacity needs

---

## Troubleshooting Guide

### "Users can't login"

```bash
# 1. Check JWT secrets are configured
echo $JWT_SECRET
echo $JWT_REFRESH_SECRET

# 2. Check database connection
curl https://api.yourdomain.com/api/health

# 3. Check auth service logs
kubectl logs -f deployment/scoutbridge | grep -i auth

# 4. Verify user exists in database
db.users.findOne({ email: "user@example.com" })

# 5. Check CORS configuration
# Verify frontend domain is in CORS whitelist
```

### "Video uploads fail"

```bash
# 1. Check S3 connection
# Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
aws s3 ls s3://scoutbridge-videos/ --region us-east-1

# 2. Check S3 bucket permissions
# Verify bucket policy allows uploads

# 3. Check storage space
# Verify bucket doesn't have size limits

# 4. Check video processor queue
# Verify Redis is running
redis-cli ping
```

### "Analysis processing stuck"

```bash
# 1. Check BullMQ queue
redis-cli
keys analysis-*
LLEN analysis-queue

# 2. Check worker logs
kubectl logs -f deployment/worker | grep analysis

# 3. Restart worker if needed
kubectl restart deployment/worker

# 4. Check video file exists
# Verify in S3
```

### "High error rate"

```bash
# 1. Check Sentry for error patterns
# Look for common error types

# 2. Check database performance
# Verify queries are not slow

# 3. Check server resources
kubectl top nodes
kubectl top pods

# 4. Check recent deployments
kubectl rollout history deployment/scoutbridge

# 5. Consider rollback if recent deploy
```

### "Database running slow"

```bash
# 1. Check MongoDB performance
# In MongoDB Atlas console:
# - Check query performance
# - Review index usage
# - Check replication lag

# 2. Optimize indexes
db.videos.createIndex({ uploadedBy: 1, createdAt: -1 })

# 3. Scale MongoDB if needed
# Increase instance size in MongoDB Atlas

# 4. Check connection pool
# Verify sufficient connections
```

---

## Essential Monitoring Commands

```bash
# Check pod status
kubectl get pods -l app=scoutbridge

# View logs
kubectl logs -f deployment/scoutbridge --tail=100

# Port forward for local access
kubectl port-forward svc/scoutbridge 5000:5000

# Check resource usage
kubectl describe pod <pod-name>

# View events
kubectl get events --sort-by='.lastTimestamp'

# Scale deployment
kubectl scale deployment/scoutbridge --replicas=3

# Check rollout status
kubectl rollout status deployment/scoutbridge

# Restart deployment
kubectl rollout restart deployment/scoutbridge

# Check MongoDB backups
# In MongoDB Atlas console

# Check Redis memory
redis-cli INFO memory

# Check Sentry errors
# Visit https://sentry.io/organizations/scoutbridge/
```

---

## Contact Information

**On-Call Team**
- Engineering Lead: [Name] - [Phone]
- DevOps Lead: [Name] - [Phone]
- Product Manager: [Name] - [Phone]

**Emergency Contacts**
- Stripe Support: https://support.stripe.com
- AWS Support: https://console.aws.amazon.com/support
- MongoDB Support: https://support.mongodb.com
- SendGrid Support: https://support.sendgrid.com

**Communication**
- Incident Slack Channel: #scoutbridge-incidents
- On-Call Rotation: [Link to PagerDuty or similar]
- Status Page: https://status.scoutbridge.com

---

**Last Updated:** August 10, 2026  
**Version:** 1.0.0  
**Status:** Ready for Production Launch
