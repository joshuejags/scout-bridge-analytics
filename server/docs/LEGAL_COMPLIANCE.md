# Legal Compliance & Privacy Requirements

## CRITICAL BLOCKER: Privacy Policy & Terms of Service

**Status:** ⚠️ BLOCKING - Cannot launch publicly without legal review

### Problem Statement

ScoutBridge Analytics platform:
- **Stores:** Video recordings of real people (identifiable)
- **Processes:** Biometric data (pose estimation, jersey numbers)
- **Shares:** Performance metrics with teammates/scouts
- **Retains:** Historical data for recruitment tracking

**Current gaps:**
- ❌ No Privacy Policy
- ❌ No Terms of Service
- ❌ No GDPR compliance statement
- ❌ No data deletion procedures (infrastructure exists, policy doesn't)
- ❌ No data retention policy
- ❌ No individual rights procedures

### Legal Framework

**Applicable regulations:**
1. **GDPR** (EU/EEA users)
   - Requires explicit privacy notice
   - Right to access, rectification, deletion (RTBF)
   - Lawful basis for processing
   - Data protection impact assessment

2. **CCPA** (California users)
   - Consumer right to know, delete, opt-out
   - Privacy policy required
   - Opt-out link on homepage

3. **PIPEDA** (Canadian users)
   - Consent for collection/use
   - Access to personal information
   - Correction, deletion rights

4. **ISO/IEC 27001** (Security standard)
   - Information security management
   - Data protection policies
   - Access control

### What Needs to be Done (Timeline)

#### Phase 1: Immediate (Before any public launch)

1. **Coordinate with Legal:**
   - Hire external privacy counsel OR internal legal review
   - Estimated cost: $5K-$15K
   - Timeline: 2-4 weeks

2. **Create Privacy Policy**
   - What data we collect (video, biometric, metadata)
   - Why we collect it (sports analytics, recruitment)
   - How we store/protect it
   - Who we share it with
   - User rights and deletion procedures
   - Retention periods

3. **Create Terms of Service**
   - Acceptable use policy
   - Copyright/IP ownership
   - Liability limitations
   - Dispute resolution
   - Video usage rights

4. **Implement Technical Compliance**
   - Add privacy policy link to homepage
   - Add ToS acceptance on signup
   - Implement data deletion endpoints
   - Create GDPR request handling process

#### Phase 2: Post-Launch (First 30 days)

1. **Privacy Policy Review**
   - Monitor for compliance issues
   - Adjust based on user feedback
   - Ensure consistent with data practices

2. **Consent Workflow**
   - Get explicit video consent from filmed players
   - Document consent for regulatory audits
   - Create consent withdrawal mechanism

3. **Documentation**
   - Data Processing Addendum (DPA) for enterprise customers
   - Data Retention Policy
   - Breach Notification Procedure

### Regulatory Checklist

#### GDPR Compliance

- [ ] Privacy policy published and accessible
- [ ] Lawful basis for video processing documented
- [ ] User consent obtained before video processing
- [ ] Data processing impact assessment completed
- [ ] Data retention periods specified (< 3 years recommended)
- [ ] Right to access implemented (export user data)
- [ ] Right to deletion implemented (cascade delete: video → analysis)
- [ ] Data breach notification procedure documented
- [ ] International data transfer mechanisms in place (if using US hosting)
- [ ] Data Protection Officer contact information provided

#### CCPA Compliance (California)

- [ ] Privacy policy includes CCPA-specific notices
- [ ] "Do Not Sell" link on homepage
- [ ] Consumer right to know endpoint
- [ ] Consumer right to delete endpoint
- [ ] Consumer right to opt-out endpoint
- [ ] Non-discrimination clause documented

#### General Security

- [ ] SSL/TLS encryption for all data in transit
- [ ] Database encryption at rest
- [ ] Access logging for all data access
- [ ] Automated backup and recovery tested
- [ ] Incident response plan documented
- [ ] Third-party security audit completed

### Implementation Guide

#### 1. Data Classification

ScoutBridge processes these data types:

```
PERSONAL DATA:
├── Identity: Name, Email, Player ID
├── Biometric: Pose estimation, Jersey number, Physical attributes
├── Video: Match recordings (identifiable people)
└── Behavioral: Login activity, Scout reports, Performance metrics

SPECIAL CATEGORY (GDPR):
├── Biometric data (pose estimation, facial features in video)
└── Video of real people (identifiable)

SENSITIVE (CCPA):
├── Video recordings
└── Performance data (could reveal trade secrets)
```

#### 2. Lawful Basis Selection

Choose ONE from:
1. **Consent** (users explicitly opt-in) - Recommended for cloud storage
2. **Contract** (processing necessary for service) - OK for match analytics
3. **Legal Obligation** (required by law) - Not applicable
4. **Vital Interests** (safety/health) - Not applicable
5. **Public Task** (governmental function) - Not applicable
6. **Legitimate Interests** (business need, balanced with privacy) - OK with documentation

**Recommended: Consent + Contract**
- Consent for video storage/processing
- Contract for analytics during service use

#### 3. Privacy Policy Template

```markdown
# Privacy Policy

**Last Updated:** [DATE]

## 1. Introduction

ScoutBridge Analytics ("Company", "we", "us") operates [website]. This page informs 
you of our policies regarding the collection, use, and disclosure of personal data 
when you use our Service and the choices you have associated with that data.

## 2. Information Collection and Use

### 2.1 Types of Data Collected

**Personal Information:**
- Name, email address, phone number
- Account credentials
- Team/club affiliation
- Payment information (if applicable)

**Video Data:**
- Match recordings you upload
- Extracted metadata (player positions, jersey numbers)
- Biometric data (pose estimation, movement patterns)

**Usage Data:**
- IP address, browser type, pages visited
- Time/date of access
- Device information
- Cookies and similar tracking

### 2.2 Purpose of Collection

- Providing sports analytics services
- Player performance tracking
- Recruitment support
- Service improvement and fraud prevention

### 2.3 Lawful Basis (GDPR)

For EU residents, our lawful basis is:
- **Consent:** For video storage (you explicitly enable this)
- **Contract:** For analytics during service use

## 3. Data Retention

- **Video files:** [30/90/180] days (or until you delete)
- **Analysis results:** [same as video]
- **User account:** Until account deletion
- **Logs:** [30] days

## 4. User Rights (GDPR/CCPA)

You have the right to:
- **Access:** Request a copy of your data
- **Rectification:** Correct inaccurate data
- **Erasure:** Request deletion of your data ("Right to Forgotten")
- **Portability:** Export your data in machine-readable format
- **Objection:** Opt-out of analytics/tracking

**To exercise rights:** Email [privacy@company.com]

## 5. Data Security

We implement:
- SSL/TLS encryption for data in transit
- AES-256 encryption for data at rest
- Access control and authentication
- Regular security audits
- Incident response procedures

## 6. Third-Party Services

**Video Storage:** AWS S3 (S3 Data Processing Addendum)
**Analytics:** [Service name] (GDPR compliant)
**Email:** [Service name] (GDPR compliant)

## 7. Cookies

We use:
- **Necessary:** Authentication, session management
- **Analytics:** Usage tracking (you can opt-out)
- **Performance:** Loading optimization
- **Marketing:** Targeted ads (CCPA: you can opt-out)

## 8. International Data Transfers

Your data may be transferred to [countries] for processing. We use:
- Standard Contractual Clauses (for EU data)
- Your explicit consent
- Supplementary measures (encryption, anonymization)

## 9. Data Breach Notification

We will notify you within [72 hours] of discovering a breach that risks your rights, 
as required by GDPR.

## 10. Children's Privacy

Our Service is not intended for children under 13 (COPPA) or 16 (GDPR). We do not 
knowingly collect data from children.

## 11. Changes to This Policy

We may update this policy. We will notify you by email or prominent notice.

## 12. Contact Us

- **Data Protection Officer:** [name@company.com]
- **Privacy Inquiries:** [privacy@company.com]
- **Complaints:** [privacy@company.com]
```

#### 4. Terms of Service Template

```markdown
# Terms of Service

**Last Updated:** [DATE]

## 1. Agreement to Terms

By accessing and using ScoutBridge Analytics, you accept and agree to be bound by 
the terms and provision of this agreement.

## 2. Use License

Permission is granted to temporarily download one copy of the materials (information, 
software, and graphics) on ScoutBridge Analytics for personal, non-commercial 
transitory viewing only. This is the grant of a license, not a transfer of title.

### 2.1 Restrictions

You may not:
- Modify or copy materials
- Use for commercial purpose
- Transfer materials to another person
- Attempt to decompile or reverse engineer software
- Remove any copyright or proprietary notations
- Transmit materials over a network
- Use for any unlawful purpose

## 3. Video Content

### 3.1 You Retain Ownership

You retain all rights to videos you upload. We don't claim ownership of your content.

### 3.2 License to Us

By uploading, you grant us a:
- **Worldwide, non-exclusive, royalty-free license** to:
  - Store and backup your video
  - Process for analytics (pose estimation, player tracking)
  - Display analytics results to authorized team members
  - Improve our algorithms (anonymized, no video retained)

### 3.3 Sharing

You control who sees your videos:
- **Private:** Only you and invited team members
- **Team:** All team members can access
- **Public:** Anyone with link (future feature)

### 3.4 Prohibited Content

You may not upload:
- Copyrighted broadcasts (full matches from professional leagues)
- Non-consensual recordings of people
- Illegal activity
- Hate speech or harassment

## 4. Video Deletion

You can delete videos anytime:
- Video file deleted immediately
- Analysis results deleted immediately
- Backup copies deleted within [30] days
- Processing cannot be undone

## 5. Limitations of Liability

To the fullest extent permissible by law:
- ScoutBridge is provided "as is"
- We're not liable for:
  - Loss of video or analysis
  - Service interruption
  - Inaccurate analytics results
  - Third-party actions
- Maximum liability: Amount paid in last 12 months

## 6. Disclaimer of Warranties

The materials on ScoutBridge's website are provided on an 'as is' basis. ScoutBridge 
makes no warranties, expressed or implied, and hereby disclaims and negates all other 
warranties including, without limitation, implied warranties or conditions of 
merchantability, fitness for a particular purpose, or non-infringement of intellectual 
property or other violation of rights.

## 7. Limitations

In no event shall ScoutBridge or its suppliers be liable for any damages (including, 
without limitation, damages for loss of data or profit, or due to business 
interruption) arising out of the use or inability to use the materials on 
ScoutBridge's website.

## 8. Accuracy of Materials

The materials appearing on ScoutBridge's website could include technical, 
typographical, or photographic errors. ScoutBridge does not warrant that any of the 
materials on its website are accurate, complete, or current.

## 9. Links

ScoutBridge has not reviewed all of the sites linked to its website and is not 
responsible for the contents of any such linked site. The inclusion of any link does 
not imply endorsement by ScoutBridge of the site. Use of any such linked website is at 
the user's own risk.

## 10. Modifications

ScoutBridge may revise these terms of service for its website at any time without 
notice. By using this website, you are agreeing to be bound by the then current version 
of these terms of service.

## 11. Governing Law

These terms of service are governed by and construed in accordance with the laws of 
[STATE/COUNTRY], and you irrevocably submit to the exclusive jurisdiction of the 
courts in that location.

## 12. Dispute Resolution

- **Negotiation:** First, parties attempt to resolve in good faith (30 days)
- **Mediation:** If unresolved, binding mediation in [LOCATION]
- **Arbitration:** Final disputes resolved via arbitration (not court)
- **Waiver of Class Action:** You waive right to class action lawsuits

## 13. Acceptance

By accessing and using this website, you acknowledge that you have read, understood, 
and agree to be bound by all the terms and conditions of this agreement.
```

### 5. Data Deletion Implementation

**Current infrastructure (already exists):**
```javascript
// Cascade delete when video is deleted:
video.deleted = true → Analysis.deleteMany({ video: video._id })
                    → S3 file deleted
                    → Thumbnails deleted
                    → Tracking data artifacts deleted
```

**What's needed (add these endpoints):**
```javascript
// New endpoints for user data rights:

// GDPR Right to Access - Export user data
GET /api/user/data-export
→ Returns JSON of: user profile, all videos, all analyses, activity logs

// GDPR Right to Deletion - Delete account + all data
DELETE /api/user/account
→ Deletes: user account, all videos, all analyses, all preferences
→ Returns confirmation

// GDPR Objection - Opt-out of analytics
POST /api/user/opt-out-analytics
→ Disables: tracking, recommendations, algorithm training

// CCPA Consumer Requests
GET /api/ccpa/data-request
POST /api/ccpa/delete-request
POST /api/ccpa/opt-out
```

### 6. Consent Workflow

**For Video Uploads:**
```
User clicks "Upload Video"
    ↓
"Consent Dialog" appears:
- "This video will be analyzed by AI"
- "Biometric data (pose) will be extracted"
- "Uploaded for up to 30 days"
- "Shareable with team members"
- "I consent" checkbox
    ↓
User confirms
    ↓
Video upload proceeds
```

**For EU/GDPR:**
```
On signup (if EU detected):
- Show full privacy notice
- Require explicit checkbox consent
- Store consent timestamp + version
```

### 7. Documentation Requirements

Create these documents:

1. **PRIVACY_POLICY.md** (public, on website)
   - Legal language
   - All data types covered
   - User rights procedures
   - Contact information

2. **TERMS_OF_SERVICE.md** (public, on website)
   - Liability limitations
   - Video ownership
   - Acceptable use policy
   - Dispute resolution

3. **DATA_PROCESSING_ADDENDUM.md** (for enterprise customers)
   - Processor/controller roles
   - Data processing instructions
   - Sub-processor list
   - Data transfer mechanisms

4. **INCIDENT_RESPONSE.md** (internal)
   - Breach detection procedures
   - Notification timelines (72 hrs for GDPR)
   - Internal escalation
   - Public communication templates

5. **DATA_RETENTION_POLICY.md** (internal)
   - Retention periods for each data type
   - Deletion procedures
   - Compliance checks

### 8. Deployment Checklist

Before public launch:

- [ ] Privacy policy reviewed by legal counsel
- [ ] Terms of service reviewed by legal counsel
- [ ] Consent workflows implemented
- [ ] Data deletion endpoints implemented and tested
- [ ] Right to access endpoints implemented and tested
- [ ] Privacy policy published on website
- [ ] ToS acceptance required on signup
- [ ] Privacy link in footer on every page
- [ ] Contact form for privacy inquiries
- [ ] Data breach response plan documented
- [ ] Third-party DPAs obtained (AWS, etc.)
- [ ] Automated deletion jobs scheduled
- [ ] Security audit completed
- [ ] Privacy impact assessment completed

### 9. Estimated Timeline & Cost

| Task | Timeline | Cost |
|------|----------|------|
| Legal review of policies | 2-4 weeks | $5K-$15K |
| Privacy policy drafting | 1 week | Included |
| Terms of service drafting | 1 week | Included |
| Technical implementation | 1 week | Internal |
| Testing and deployment | 1 week | Internal |
| **Total** | **6-8 weeks** | **$5K-$15K** |

### 10. References

- GDPR Official Text: https://gdpr-info.eu/
- CCPA Law: https://oag.ca.gov/privacy/ccpa
- Privacy by Design: https://ico.org.uk/for-organisations/uk-gdpr/
- ISO 27001: https://www.iso.org/isoiec-27001-information-security-management.html
- DPA Template: https://ec.europa.eu/info/law/law-topic/data-protection_en

## Action Items

1. **[PRIORITY 1]** Schedule meeting with legal counsel
   - Review this document
   - Determine applicable regulations
   - Estimate timeline & cost

2. **[PRIORITY 2]** Draft privacy policy & ToS
   - Use templates above as starting point
   - Tailor to specific use cases
   - Get legal review

3. **[PRIORITY 3]** Implement technical requirements
   - Add privacy policy/ToS pages
   - Implement data export endpoints
   - Implement data deletion endpoints
   - Add consent dialogs

4. **[PRIORITY 4]** Test compliance
   - Test GDPR right-to-access flow
   - Test GDPR right-to-delete flow
   - Test CCPA opt-out flow
   - Document procedures

5. **[PRIORITY 5]** Deploy to production
   - Publish policies on website
   - Enable consent workflows
   - Monitor for compliance issues

## Support Contacts

- **Privacy Questions:** [TBD - assign to person]
- **Legal Counsel:** [TBD - external or internal]
- **Data Protection Officer:** [TBD - required for GDPR]
- **Customer Support:** [TBD - handle data requests]
