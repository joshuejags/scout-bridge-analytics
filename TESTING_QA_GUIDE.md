# ScoutBridge Analytics - Testing & Quality Assurance Guide

## Testing Strategy

### Test Coverage Goals

- **Unit Tests:** 80% code coverage minimum
- **Integration Tests:** All critical APIs and workflows
- **E2E Tests:** Core user journeys (signup, upload, analysis, comparison)
- **Performance Tests:** API latency, database queries, bundle size
- **Security Tests:** OWASP top 10, authentication, authorization
- **Mobile Tests:** iOS Safari, Android Chrome, PWA functionality

## Unit Testing

### Backend Unit Tests

```bash
# Run backend tests
cd server
npm test

# Watch mode for development
npm test -- --watch

# Coverage report
npm test -- --coverage
```

**Key components to test:**

1. **Authentication**
   ```javascript
   // tests/auth.test.js
   describe('Authentication', () => {
     it('should generate valid JWT token');
     it('should reject invalid credentials');
     it('should handle token expiration');
     it('should support refresh tokens');
   });
   ```

2. **Subscriptions**
   ```javascript
   describe('Subscription Service', () => {
     it('should create subscription with Stripe');
     it('should enforce usage limits');
     it('should handle plan upgrades');
     it('should process cancellations');
   });
   ```

3. **Notifications**
   ```javascript
   describe('Notification Service', () => {
     it('should send in-app notifications');
     it('should send email notifications');
     it('should respect user preferences');
     it('should handle quiet hours');
   });
   ```

4. **Exports**
   ```javascript
   describe('Export Service', () => {
     it('should generate PDF exports');
     it('should generate CSV exports');
     it('should generate Excel exports');
     it('should clean up old exports');
   });
   ```

### Frontend Unit Tests

```bash
# Run frontend tests
cd client
npm test

# Coverage report
npm test -- --coverage

# Update snapshots
npm test -- -u
```

**Key components to test:**

1. **Authentication Flow**
2. **Subscription Management**
3. **Video Upload & Processing**
4. **Player Comparison**
5. **Report Generation**
6. **Search & Filtering**
7. **Notifications**

## Integration Testing

### API Integration Tests

```bash
# Run integration tests
npm run test:integration

# Test with specific database
MONGODB_TEST_URI=mongodb://localhost:27017/test npm test:integration
```

**Critical API flows to test:**

1. **User Registration & Email Verification**
   ```
   POST /api/auth/register
   POST /api/auth/verify-email
   POST /api/auth/login
   ```

2. **Subscription Workflow**
   ```
   POST /api/subscription/create
   POST /api/subscription/checkout
   PATCH /api/subscription/:id/upgrade
   DELETE /api/subscription/:id/cancel
   ```

3. **Video Upload & Analysis**
   ```
   POST /api/videos/upload
   POST /api/analysis/:videoId/process
   GET /api/analysis/:videoId/results
   ```

4. **Report Generation**
   ```
   POST /api/reports/create
   GET /api/reports/:reportId
   POST /api/exports/:reportId/generate
   ```

## End-to-End Testing

### E2E Test Scenarios

Using Playwright or Cypress:

```javascript
// tests/e2e/auth.spec.js
describe('Authentication E2E', () => {
  it('should complete user signup flow', async () => {
    // 1. Navigate to signup
    await page.goto('https://app.scoutbridge.com/register');
    
    // 2. Fill form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.fill('input[name="name"]', 'Test User');
    
    // 3. Submit
    await page.click('button[type="submit"]');
    
    // 4. Check email verification
    await page.waitForNavigation();
    expect(page.url()).toContain('/verify-email');
    
    // 5. Verify email (in test, bypass)
    await page.goto('https://app.scoutbridge.com');
    expect(page.locator('text=Dashboard')).toBeVisible();
  });
});
```

### Critical User Journeys

1. **Scout's Day-to-Day**
   - Login
   - Upload video
   - Run analysis
   - Review results
   - Create scouting report
   - Share report with team

2. **Club Manager**
   - Login
   - Manage team
   - View player profiles
   - Run team analytics
   - Export reports
   - Manage subscriptions

3. **Mobile User**
   - Login via mobile
   - View notifications
   - Browse players
   - View reports
   - Download app as PWA

## Performance Testing

### Load Testing

```bash
# Using k6
npm install -D k6

# Run load test
k6 run tests/performance/load-test.js
```

**Load Test Scenarios:**

1. **API Stress Test**
   - 1,000 concurrent users
   - Ramp up over 5 minutes
   - 30-minute sustained load
   - Check response times remain < 500ms

2. **Database Load**
   - 10,000 concurrent queries
   - Monitor connection pool
   - Verify no connection timeouts

3. **Video Processing**
   - 100 concurrent uploads
   - 10 concurrent analyses
   - Monitor queue depth
   - Verify GPU utilization

### Bundle Size Analysis

```bash
# Analyze bundle
npm run build:client -- --analyze

# Expected sizes:
# - main.js: < 150KB gzipped
# - vendor.js: < 200KB gzipped
# - Total: < 500KB gzipped

# Optimize if needed:
npm run build:client -- --optimize
```

### Browser Performance

```javascript
// Measure Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);  // Cumulative Layout Shift
getFID(console.log);  // First Input Delay
getFCP(console.log);  // First Contentful Paint
getLCP(console.log);  // Largest Contentful Paint
getTTFB(console.log); // Time to First Byte
```

**Performance Targets:**
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1
- TTFB: < 600ms

## Security Testing

### OWASP Top 10 Checks

```bash
# Run security audit
npm audit

# Check dependencies for vulnerabilities
npm audit --production

# Update vulnerable packages
npm audit fix
```

**Manual Security Tests:**

1. **SQL Injection**
   - Test with `' OR '1'='1`
   - Verify parameterized queries used
   - Confirm input validation

2. **Cross-Site Scripting (XSS)**
   - Test with `<script>alert('xss')</script>`
   - Verify HTML escaping
   - Check Content Security Policy headers

3. **Cross-Site Request Forgery (CSRF)**
   - Verify CSRF tokens on forms
   - Check SameSite cookie attributes
   - Confirm token validation on backend

4. **Authentication**
   - Test password requirements
   - Verify password reset security
   - Check session timeout
   - Test token expiration

5. **Authorization**
   - Verify role-based access control
   - Test field-level access control
   - Check organization isolation
   - Test data access restrictions

### Penetration Testing Checklist

- [ ] Run Burp Suite scan
- [ ] Test API endpoints for vulnerabilities
- [ ] Check for leaked secrets
- [ ] Verify SSL/TLS configuration
- [ ] Test rate limiting
- [ ] Check for authorization bypass
- [ ] Verify input validation

```bash
# Run security scan with OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://app.scoutbridge.com
```

## Mobile & PWA Testing

### PWA Functionality

```javascript
// Test service worker
describe('PWA Service Worker', () => {
  it('should register service worker');
  it('should cache assets');
  it('should work offline');
  it('should sync data when online');
  it('should show installation prompt');
});
```

### Mobile Responsiveness

**Test Devices:**
- iPhone 12 (6.1")
- iPhone SE (4.7")
- iPhone 14 Pro Max (6.7")
- Samsung Galaxy S21 (6.2")
- iPad Air (10.9")
- iPad Mini (7.9")

**Responsive Tests:**
- [ ] Navigation works on all screen sizes
- [ ] Forms are touch-friendly
- [ ] Images load appropriately
- [ ] Videos play correctly
- [ ] Modals display properly
- [ ] Scrolling is smooth
- [ ] No horizontal scroll

## Accessibility Testing

```bash
# Run accessibility audit
npm install -D axe-core axe-playwright

# Automated testing
npx axe scan https://app.scoutbridge.com
```

**Manual Accessibility Checks:**
- [ ] All images have alt text
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Form labels present
- [ ] Error messages clear
- [ ] Focus indicators visible

## Regression Testing

### Automated Regression Suite

```bash
# Run regression tests before each deployment
npm run test:regression

# This should cover:
# - All previously fixed bugs
# - Core functionality
# - Critical user paths
```

### Manual Regression Checklist

Before every release:

1. **Authentication**
   - [ ] User registration
   - [ ] Email verification
   - [ ] Login/logout
   - [ ] Password reset

2. **Subscriptions**
   - [ ] Tier display
   - [ ] Upgrade flow
   - [ ] Invoice history
   - [ ] Cancellation

3. **Core Features**
   - [ ] Video upload
   - [ ] Video analysis
   - [ ] Player profiles
   - [ ] Comparisons
   - [ ] Reports
   - [ ] Exports

4. **Admin Functions**
   - [ ] User management
   - [ ] Organization settings
   - [ ] Audit logs
   - [ ] Monitoring dashboard

## Test Automation Commands

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:security
npm run test:accessibility

# Generate coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch

# CI mode (non-interactive)
npm run test:ci
```

## Continuous Integration

### GitHub Actions Test Workflow

```yaml
name: Test & QA

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Generate coverage report
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
      
      - name: Security audit
        run: npm audit
```

## Quality Gates

### Definition of Done

Before merging to main:

- [ ] All unit tests pass (80%+ coverage)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No console errors or warnings
- [ ] Linting passes
- [ ] Security audit passes
- [ ] Performance metrics acceptable
- [ ] Accessibility checks pass
- [ ] Code review approved
- [ ] Regression tests pass
- [ ] Documentation updated

## Monitoring & Alerting (Post-Deployment)

### Key Metrics to Monitor

```javascript
// Application Performance Monitoring
- Error rate (target: < 0.1%)
- API latency p95 (target: < 500ms)
- Database latency p95 (target: < 100ms)
- Failed job queue depth (target: 0)
- Undelivered emails (target: 0)
- Subscription churn rate
- Trial conversion rate
- User engagement metrics
```

### Alert Thresholds

- **Critical:** Error rate > 1%, Latency > 2s, CPU > 90%
- **Warning:** Error rate > 0.5%, Latency > 1s, CPU > 75%
- **Info:** Performance degradation, unusual patterns

---

**Last Updated:** August 2026
**Next Review:** Before production launch
