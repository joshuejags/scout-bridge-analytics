const mongoose = require('mongoose');

// Organization roles
const ORGANIZATION_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SCOUT: 'scout',
  COACH: 'coach',
  ANALYST: 'analyst',
  PLAYER: 'player',
};

// Role permissions
const ROLE_PERMISSIONS = {
  [ORGANIZATION_ROLES.OWNER]: ['*'], // full access
  [ORGANIZATION_ROLES.ADMIN]: [
    'manage_team',
    'manage_users',
    'manage_players',
    'view_analytics',
    'export_data',
    'manage_settings',
  ],
  [ORGANIZATION_ROLES.MANAGER]: [
    'manage_team',
    'manage_players',
    'view_analytics',
    'assign_scouts',
  ],
  [ORGANIZATION_ROLES.SCOUT]: [
    'view_analytics',
    'create_reports',
    'manage_watchlist',
  ],
  [ORGANIZATION_ROLES.COACH]: [
    'view_analytics',
    'view_team_videos',
  ],
  [ORGANIZATION_ROLES.ANALYST]: [
    'view_analytics',
    'export_data',
  ],
  [ORGANIZATION_ROLES.PLAYER]: [
    'view_own_profile',
    'view_own_videos',
  ],
};

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['individual', 'club', 'academy', 'agency'],
      default: 'individual',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Members with roles
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        email: String,
        role: {
          type: String,
          enum: Object.values(ORGANIZATION_ROLES),
          default: ORGANIZATION_ROLES.SCOUT,
        },
        status: {
          type: String,
          enum: ['active', 'pending', 'inactive'],
          default: 'pending',
        },
        joinedAt: Date,
        invitedAt: Date,
        inviteToken: String,
        inviteTokenExpires: Date,
      },
    ],
    
    // Teams within organization
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
      },
    ],
    
    // Subscription
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
    },
    
    // Organization settings
    settings: {
      visibility: {
        type: String,
        enum: ['private', 'internal', 'public'],
        default: 'private',
      },
      allowPublicReports: { type: Boolean, default: false },
      dataRetentionDays: { type: Number, default: 90 },
      auditLogsEnabled: { type: Boolean, default: true },
    },
    
    // Billing contact
    billingContact: {
      name: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    
    // Organization metadata
    logo: String, // S3 URL
    website: String,
    description: String,
    
    // Status
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
    },
    
    // Audit trail
    auditLogs: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        action: String,
        resource: String,
        resourceId: String,
        changes: mongoose.Schema.Types.Mixed,
        timestamp: Date,
      },
    ],
  },
  { timestamps: true }
);

/**
 * Generate organization slug from name
 */
organizationSchema.pre('save', function generateSlug(next) {
  if (!this.isModified('name')) return next();
  
  this.slug = this.name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  
  next();
});

/**
 * Add member to organization
 */
organizationSchema.methods.addMember = function addMember(userId, role = ORGANIZATION_ROLES.SCOUT) {
  const existingMember = this.members.find((m) => m.userId?.toString() === userId.toString());
  if (existingMember) return existingMember;
  
  const member = { userId, role, status: 'active', joinedAt: new Date() };
  this.members.push(member);
  return member;
};

/**
 * Remove member from organization
 */
organizationSchema.methods.removeMember = function removeMember(userId) {
  this.members = this.members.filter((m) => m.userId?.toString() !== userId.toString());
};

/**
 * Update member role
 */
organizationSchema.methods.updateMemberRole = function updateMemberRole(userId, newRole) {
  const member = this.members.find((m) => m.userId?.toString() === userId.toString());
  if (member) {
    member.role = newRole;
  }
  return member;
};

/**
 * Check if user has permission in organization
 */
organizationSchema.methods.hasPermission = function hasPermission(userId, permission) {
  const member = this.members.find((m) => m.userId?.toString() === userId.toString());
  if (!member) return false;
  
  const permissions = ROLE_PERMISSIONS[member.role] || [];
  return permissions.includes('*') || permissions.includes(permission);
};

/**
 * Log action in audit trail
 */
organizationSchema.methods.logAction = function logAction(userId, action, resource, resourceId, changes = {}) {
  this.auditLogs.push({
    userId,
    action,
    resource,
    resourceId,
    changes,
    timestamp: new Date(),
  });
  
  // Keep only last 1000 logs
  if (this.auditLogs.length > 1000) {
    this.auditLogs = this.auditLogs.slice(-1000);
  }
};

module.exports = {
  model: mongoose.model('Organization', organizationSchema),
  ORGANIZATION_ROLES,
  ROLE_PERMISSIONS,
};
