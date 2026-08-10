# ScoutBridge Analytics - Product Capabilities & API Summary

## Platform Overview

ScoutBridge Analytics is a **production-ready commercial SaaS platform** serving:
- **Scouts** - Video analysis and player scouting
- **Clubs** - Team analytics and squad management  
- **Academies** - Talent identification and development
- **Agents** - Client representation and career management
- **Players** - Personal performance analytics

## Core Features by Role

### For Scouts

✅ **Video Analysis**
- AI-powered event detection (shots, passes, tackles, fouls)
- Pose estimation for player positioning and movement
- Video player with timeline controls
- Event mapping with spatial visualization

✅ **Player Intelligence**
- Comprehensive player profiles
- Performance statistics and trends
- Heatmaps showing player positioning
- AI-generated player comparisons

✅ **Scouting Workflows**
- Prospect tracking and watchlists
- Scouting report generation (AI-assisted)
- Recruitment pipeline management
- Candidate shortlisting

✅ **Reporting**
- Scout report templates
- PDF/Excel/CSV export
- Shareable report links
- Draft and saved reports

### For Clubs

✅ **Team Management**
- Squad profiles and statistics
- Player performance tracking
- Team analytics hub
- Match analysis

✅ **Analytics**
- Performance trends over time
- Possession and passing statistics
- xG and xA metrics
- Heatmaps and formation analysis

✅ **Recruitment**
- Multi-club player comparison
- Recruitment pipeline
- Collaboration with scouts
- Candidate management

✅ **Administration**
- User and team management
- Role-based permissions
- Organization settings
- Audit logging

### For Enterprises

✅ **Multi-Organization Support**
- Support unlimited teams/organizations
- Cross-organization collaboration
- Enterprise-grade permissions
- Dedicated support

✅ **Billing & Compliance**
- Subscription management
- Usage analytics
- Audit logs for compliance
- Data retention policies

✅ **Advanced Features**
- Custom analytics
- API access for integrations
- Scheduled reports
- Data exports

---

## Complete API Reference

### Authentication API

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "scout@example.com",
  "password": "SecurePassword123!",
  "name": "John Scout"
}

Response: 201 Created
{
  "user": { "id", "email", "name", "role" },
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "scout@example.com",
  "password": "SecurePassword123!"
}

Response: 200 OK
{
  "user": { "id", "email", "name", "role" },
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### Verify Email
```http
POST /api/auth/verify-email/:token
Response: 200 OK
{ "success": true, "message": "Email verified" }
```

#### Password Reset
```http
POST /api/auth/forgot-password
{ "email": "scout@example.com" }

POST /api/auth/reset-password/:token
{ "password": "NewPassword123!" }
```

### Video Management API

#### Upload Video
```http
POST /api/videos/upload
Content-Type: multipart/form-data

Parameters:
- file: video file (MP4, MOV, AVI)
- title: string
- description: string (optional)
- teamId: ObjectId (optional)
- matchDate: ISO date (optional)

Response: 201 Created
{
  "videoId": "...",
  "title": "...",
  "url": "https://cdn.scoutbridge.com/videos/...",
  "status": "uploaded"
}
```

#### Get Video
```http
GET /api/videos/:videoId
Response: 200 OK
{
  "id": "...",
  "title": "...",
  "url": "...",
  "duration": 3600,
  "uploadedAt": "2026-08-10T00:00:00Z",
  "analysis": { "events": [...], "duration": 3600 }
}
```

#### List Videos
```http
GET /api/videos?page=1&limit=20&sort=-uploadedAt
Response: 200 OK
{
  "videos": [...],
  "pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 }
}
```

#### Delete Video
```http
DELETE /api/videos/:videoId
Response: 200 OK
{ "success": true }
```

### Analysis API

#### Analyze Video
```http
POST /api/analysis/:videoId/analyze
Content-Type: application/json

{
  "eventTypes": ["shot", "pass", "tackle"],
  "includeHeatmap": true,
  "includePose": true
}

Response: 202 Accepted
{
  "analysisId": "...",
  "status": "processing",
  "progress": 0,
  "estimatedTime": 120
}
```

#### Get Analysis Results
```http
GET /api/analysis/:analysisId/results
Response: 200 OK
{
  "analysisId": "...",
  "status": "completed",
  "events": [
    {
      "type": "shot",
      "timestamp": 3.14,
      "x": 50,
      "y": 65,
      "player": "John Doe",
      "confidence": 0.95
    },
    ...
  ],
  "heatmaps": {
    "team1": "https://cdn.scoutbridge.com/heatmaps/...",
    "team2": "https://cdn.scoutbridge.com/heatmaps/..."
  },
  "statistics": {
    "shots": 12,
    "passes": 456,
    "tackles": 34
  }
}
```

#### Get Analysis Status
```http
GET /api/analysis/:analysisId/status
Response: 200 OK
{
  "status": "processing",
  "progress": 45,
  "estimatedTime": 60
}
```

### Player API

#### Get Player
```http
GET /api/players/:playerId
Response: 200 OK
{
  "id": "...",
  "name": "Kylian Mbappé",
  "position": "LW",
  "age": 25,
  "height": 178,
  "weight": 77,
  "club": "Real Madrid",
  "country": "France",
  "statistics": { ... },
  "videos": [ ... ],
  "ratings": { ... }
}
```

#### Search Players
```http
GET /api/players?search=mbappé&position=LW&club=Real%20Madrid
Response: 200 OK
{
  "players": [...],
  "pagination": { ... }
}
```

#### Compare Players
```http
POST /api/players/compare
Content-Type: application/json

{
  "playerIds": ["playerId1", "playerId2", "playerId3"]
}

Response: 200 OK
{
  "players": [...],
  "comparison": {
    "ratings": { ... },
    "statistics": { ... },
    "strengths": { ... },
    "weaknesses": { ... }
  }
}
```

### Team API

#### Get Team
```http
GET /api/teams/:teamId
Response: 200 OK
{
  "id": "...",
  "name": "Real Madrid",
  "country": "Spain",
  "league": "La Liga",
  "players": [...],
  "analytics": { ... }
}
```

#### Get Team Analytics
```http
GET /api/teams/:teamId/analytics?startDate=2026-01-01&endDate=2026-08-01
Response: 200 OK
{
  "teamId": "...",
  "periodAnalysis": [
    {
      "date": "2026-08-01",
      "possession": 62.5,
      "shotsFor": 15,
      "shotsAgainst": 8,
      "passes": 612,
      "goalsFor": 3,
      "goalsAgainst": 1
    },
    ...
  ],
  "trends": { ... }
}
```

### Reports API

#### Create Report
```http
POST /api/reports
Content-Type: application/json

{
  "type": "scout_report",
  "playerId": "...",
  "title": "Mbappé Scouting Report",
  "body": "...",
  "strengths": ["Speed", "Finishing"],
  "weaknesses": ["Defensive work"],
  "recommendation": "Highly Recommended",
  "score": 9.2,
  "teamId": "..." (optional)
}

Response: 201 Created
{
  "reportId": "...",
  "createdAt": "2026-08-10T00:00:00Z",
  "status": "draft"
}
```

#### Get Report
```http
GET /api/reports/:reportId
Response: 200 OK
{
  "id": "...",
  "type": "scout_report",
  "title": "...",
  "body": "...",
  "createdAt": "...",
  "updatedAt": "...",
  "createdBy": { "id", "name", "email" }
}
```

#### List Reports
```http
GET /api/reports?status=published&type=scout_report
Response: 200 OK
{
  "reports": [...],
  "pagination": { ... }
}
```

#### Publish Report
```http
PATCH /api/reports/:reportId/publish
Response: 200 OK
{ "reportId": "...", "status": "published" }
```

### Subscription API

#### Get Current Subscription
```http
GET /api/subscription/current
Response: 200 OK
{
  "subscriptionId": "...",
  "plan": "scout_pro",
  "status": "active",
  "startDate": "2026-01-01",
  "renewalDate": "2026-09-01",
  "cancelAtPeriodEnd": false,
  "features": {
    "videoAnalysis": true,
    "playerComparison": true,
    "aiInsights": true,
    "teamCollaboration": false
  }
}
```

#### Get Available Plans
```http
GET /api/subscription/plans
Response: 200 OK
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "billing": "monthly",
      "features": { ... }
    },
    {
      "id": "scout_pro",
      "name": "Scout Pro",
      "price": 9.99,
      "billing": "monthly",
      "features": { ... }
    },
    ...
  ]
}
```

#### Create Subscription
```http
POST /api/subscription/checkout
Content-Type: application/json

{
  "plan": "scout_pro",
  "billingPeriod": "annual",
  "paymentMethod": "stripe"
}

Response: 200 OK
{
  "clientSecret": "...",
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

#### Upgrade Subscription
```http
PATCH /api/subscription/upgrade
Content-Type: application/json

{
  "newPlan": "club_pro"
}

Response: 200 OK
{ "subscriptionId": "...", "plan": "club_pro", "status": "active" }
```

### Notification API

#### Get Notifications
```http
GET /api/notifications?limit=20&read=false
Response: 200 OK
{
  "notifications": [
    {
      "id": "...",
      "type": "video_processed",
      "title": "Video Processing Complete",
      "message": "Your video has been analyzed",
      "read": false,
      "createdAt": "2026-08-10T00:00:00Z"
    },
    ...
  ],
  "unreadCount": 5
}
```

#### Mark as Read
```http
PATCH /api/notifications/:notificationId/read
Response: 200 OK
{ "id": "...", "read": true }
```

#### Update Preferences
```http
PUT /api/notifications/preferences
Content-Type: application/json

{
  "email": true,
  "inApp": true,
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  },
  "digestFrequency": "daily"
}

Response: 200 OK
{ "preferences": { ... } }
```

### Organization API

#### Create Organization
```http
POST /api/organizations
Content-Type: application/json

{
  "name": "Real Madrid CF",
  "type": "club",
  "description": "Spanish football club",
  "website": "https://www.realmadrid.com"
}

Response: 201 Created
{ "organizationId": "...", "slug": "real-madrid-cf" }
```

#### Add Team Member
```http
POST /api/organizations/:orgId/members
Content-Type: application/json

{
  "email": "coach@realmadrid.com",
  "role": "manager"
}

Response: 200 OK
{
  "invitationId": "...",
  "email": "coach@realmadrid.com",
  "status": "pending",
  "expiresAt": "2026-08-17T00:00:00Z"
}
```

### Export API

#### Create Export
```http
POST /api/exports
Content-Type: application/json

{
  "type": "scout_report",
  "format": "pdf",
  "reportId": "..."
}

Response: 201 Created
{
  "exportId": "...",
  "status": "pending",
  "format": "pdf"
}
```

#### Generate Export
```http
POST /api/exports/:exportId/generate
Response: 200 OK
{
  "exportId": "...",
  "status": "completed",
  "downloadUrl": "https://api.scoutbridge.com/api/exports/.../download",
  "expiresAt": "2026-08-17T00:00:00Z"
}
```

#### Download Export
```http
GET /api/exports/:exportId/download
Response: 200 OK
(Binary file download)
```

### Audit & Monitoring API

#### Get Audit Logs (Admin)
```http
GET /api/audit/organizations/:orgId/audit-logs?action=user.login&limit=50
Response: 200 OK
{
  "logs": [
    {
      "id": "...",
      "userId": "...",
      "action": "user.login",
      "timestamp": "2026-08-10T00:00:00Z",
      "ipAddress": "192.168.1.1",
      "status": 200
    },
    ...
  ],
  "pagination": { ... }
}
```

#### Get System Health (Admin)
```http
GET /api/monitoring/health
Response: 200 OK
{
  "status": "healthy",
  "metrics": {
    "errorRate": 0.05,
    "apiLatency": 245,
    "dbLatency": 52,
    "activeUsers": 1234,
    "memoryUsage": 62.3,
    "cpuUsage": 45.2
  }
}
```

#### Get Alerts (Admin)
```http
GET /api/monitoring/alerts?severity=critical
Response: 200 OK
{
  "alerts": [
    {
      "id": "...",
      "alertType": "performance",
      "severity": "critical",
      "title": "High API Latency",
      "message": "API latency exceeded 2 seconds",
      "status": "active"
    },
    ...
  ],
  "count": 3
}
```

---

## Rate Limiting

All API endpoints are rate limited:

- **Authentication:** 5 requests per minute
- **Video Upload:** 10 per hour per user
- **Analysis:** 50 per day per subscription tier
- **Search:** 100 per minute
- **General API:** 1000 requests per hour

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1628498400
```

## Error Handling

All errors return standard format:

```json
{
  "error": "Subscription required",
  "code": "SUBSCRIPTION_REQUIRED",
  "statusCode": 402,
  "details": {
    "requiredPlan": "scout_pro",
    "currentPlan": "free"
  }
}
```

Common error codes:
- `401` - Unauthorized (invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `422` - Validation error
- `429` - Rate limit exceeded
- `500` - Internal server error

## Webhooks (Coming Soon)

Supported webhook events:
- `subscription.created`
- `subscription.updated`
- `payment.succeeded`
- `video.analyzed`
- `report.published`
- `user.invited`
- `organization.created`

---

**API Version:** 1.0.0  
**Last Updated:** August 2026  
**Status:** Production Ready
