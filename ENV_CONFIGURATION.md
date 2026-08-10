# ScoutBridge Analytics - Environment Configuration Guide

## Prerequisites Setup

Before deploying to production, configure the following environment variables in your deployment environment.

### Database Configuration

```bash
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/scoutbridge
MONGODB_OPTIONS=retryWrites=true&w=majority&maxPoolSize=100
```

### Authentication & Security

```bash
JWT_SECRET=your-secure-random-jwt-secret-32-chars-minimum
JWT_EXPIRY=7d
REFRESH_TOKEN_SECRET=your-secure-refresh-token-secret
SESSION_SECRET=your-session-secret-for-cookies
CORS_ORIGINS=https://app.scoutbridge.com,https://www.scoutbridge.com
```

### Stripe Integration (Payment Processing)

```bash
STRIPE_SECRET_KEY=sk_live_xxxxx...
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx...
STRIPE_WEBHOOK_SECRET=whsec_xxxxx...

# Stripe Price IDs (create these in Stripe dashboard)
STRIPE_PRICE_SCOUT_PRO_MONTHLY=price_xxxxx
STRIPE_PRICE_SCOUT_PRO_ANNUAL=price_xxxxx
STRIPE_PRICE_CLUB_PRO_MONTHLY=price_xxxxx
STRIPE_PRICE_CLUB_PRO_ANNUAL=price_xxxxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxxxx
STRIPE_PRICE_ENTERPRISE_ANNUAL=price_xxxxx

# Stripe product IDs
STRIPE_PRODUCT_SCOUT_PRO=prod_xxxxx
STRIPE_PRODUCT_CLUB_PRO=prod_xxxxx
STRIPE_PRODUCT_ENTERPRISE=prod_xxxxx
```

### Email Configuration (SMTP)

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx...
SMTP_FROM=noreply@scoutbridge.com
SMTP_SECURE=true

# Or use Resend
RESEND_API_KEY=re_xxxxx...
```

### AWS S3 (Video Storage)

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_S3_BUCKET=scoutbridge-videos
AWS_S3_BUCKET_PUBLIC=scoutbridge-public

# S3 presigned URL expiry (in seconds)
AWS_PRESIGNED_URL_EXPIRY=3600
```

### Redis Configuration (Caching & Jobs)

```bash
REDIS_URL=redis://user:password@localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_MAX_CONNECTIONS=50
```

### Video Processing (AI/ML)

```bash
PYTHON_API_URL=http://localhost:5001
YOLOV8_MODEL_PATH=/models/yolov8n.pt
YOLOV8_POSE_MODEL_PATH=/models/yolov8-pose.pt
INFERENCE_TIMEOUT=300
GPU_ENABLED=true
```

### Push Notifications (PWA)

```bash
VAPID_PUBLIC_KEY=xxxxx...
VAPID_PRIVATE_KEY=xxxxx...
VAPID_SUBJECT=mailto:support@scoutbridge.com
```

### Frontend Configuration

```bash
REACT_APP_API_BASE_URL=https://api.scoutbridge.com
REACT_APP_VAPID_PUBLIC_KEY=xxxxx...
REACT_APP_ENVIRONMENT=production
REACT_APP_VERSION=1.0.0
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx...
```

### General Application

```bash
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://app.scoutbridge.com
BACKEND_URL=https://api.scoutbridge.com

# Environment
ENVIRONMENT=production
APP_NAME=ScoutBridge Analytics
APP_VERSION=1.0.0

# Debug/Logging
LOG_LEVEL=info
DEBUG=false
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### Admin Configuration

```bash
ADMIN_EMAIL=admin@scoutbridge.com
SUPPORT_EMAIL=support@scoutbridge.com
BILLING_EMAIL=billing@scoutbridge.com

# Features
ENABLE_TRIALS=true
TRIAL_DAYS=14
ENABLE_FREE_TIER=true
ENABLE_STRIPE_WEBHOOKS=true
```

### Rate Limiting

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_ADMIN=true
```

## Configuration by Environment

### Development

- Use `.env.development`
- Mock Stripe (stripe-mock)
- Local MongoDB
- Resend API with test domain
- Verbose logging

### Staging

- Use `.env.staging`
- Stripe test keys with real sandbox
- MongoDB staging cluster
- Real SMTP configuration
- Standard logging

### Production

- Use `.env.production`
- Stripe live keys with production products
- MongoDB production cluster with backups
- Production SMTP/SES configuration
- Minimal logging (security)
- Sentry for error tracking
- CloudFlare/CDN configured

## Critical Configuration Steps

1. **Stripe Setup:**
   ```bash
   # Create products in Stripe dashboard
   # Scout Pro - $9.99/mo or $99.99/yr
   # Club Pro - $29.99/mo or $299.99/yr
   # Enterprise - Custom pricing
   
   # Create webhook endpoint: https://api.scoutbridge.com/webhooks/stripe
   # Subscribe to events: payment_intent.succeeded, customer.subscription.updated
   ```

2. **Email Configuration:**
   ```bash
   # Verify sender domain
   # Create email templates for:
   # - Welcome
   # - Subscription confirmation
   # - Upgrade notification
   # - Invoice receipt
   # - Trial expiration warning
   ```

3. **OAuth/SSO Setup (Future):**
   ```bash
   # Google OAuth
   GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxx
   
   # GitHub OAuth
   GITHUB_CLIENT_ID=xxxxx
   GITHUB_CLIENT_SECRET=xxxxx
   ```

4. **Push Notifications Setup:**
   ```bash
   # Generate VAPID keys:
   npm install -g web-push
   web-push generate-vapid-keys
   ```

## Deployment Checklist

- [ ] Database backups configured
- [ ] Redis cluster configured
- [ ] S3 buckets created and secured
- [ ] Stripe products and prices created
- [ ] Stripe webhooks configured
- [ ] Email service verified
- [ ] SSL certificates configured
- [ ] CDN configured
- [ ] Monitoring/alerting configured
- [ ] Logging aggregation configured
- [ ] Backup strategy documented
- [ ] Disaster recovery plan in place
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Load testing completed

## Support

For configuration assistance:
- GitHub Issues: https://github.com/joshuejags/scout-bridge-analytics/issues
- Documentation: https://docs.scoutbridge.com
- Support Email: support@scoutbridge.com
