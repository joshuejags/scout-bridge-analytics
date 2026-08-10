const { model: Organization, ORGANIZATION_ROLES } = require('../models/Organization');
const { model: User } = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Create a new organization
 */
exports.createOrganization = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, type = 'club', description, website } = req.body;

    // Create slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    // Check if slug already exists
    const existingOrg = await Organization.findOne({ slug });
    if (existingOrg) {
      return res.status(400).json({
        success: false,
        error: 'Organization name already in use',
      });
    }

    const organization = new Organization({
      name,
      slug,
      type,
      owner: userId,
      description,
      website,
    });

    // Add owner as admin
    organization.members.push({
      userId,
      email: req.user.email,
      role: ORGANIZATION_ROLES.OWNER,
      status: 'active',
      joinedAt: new Date(),
    });

    // Log action
    organization.logAction(userId, 'create', 'organization', organization._id, {
      name,
      type,
    });

    await organization.save();

    // Update user's primary organization
    const user = await User.findById(userId);
    user.primaryOrganizationId = organization._id;
    user.organizations = [{ organizationId: organization._id, role: ORGANIZATION_ROLES.OWNER }];
    await user.save();

    res.status(201).json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create organization',
    });
  }
};

/**
 * Get organization by ID
 */
exports.getOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user._id;

    const organization = await Organization.findById(organizationId)
      .populate('owner', 'name email')
      .populate('members.userId', 'name email')
      .populate('teams', 'name')
      .populate('subscriptionId');

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Check if user is member
    const isMember = organization.members.some((m) => m.userId?._id?.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch organization',
    });
  }
};

/**
 * Get user's organizations
 */
exports.getMyOrganizations = async (req, res) => {
  try {
    const userId = req.user._id;

    const organizations = await Organization.find({
      'members.userId': userId,
    })
      .select('_id name slug type status')
      .populate('subscriptionId', 'plan status');

    res.json({
      success: true,
      organizations,
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch organizations',
    });
  }
};

/**
 * Update organization settings
 */
exports.updateOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user._id;
    const updates = req.body;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Check if user is owner
    if (organization.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only organization owner can update settings',
      });
    }

    // Update allowed fields
    const allowedFields = ['name', 'description', 'website', 'logo', 'settings', 'billingContact'];
    allowedFields.forEach((field) => {
      if (updates[field]) {
        organization[field] = updates[field];
      }
    });

    organization.logAction(userId, 'update', 'organization', organizationId, updates);

    await organization.save();

    res.json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update organization',
    });
  }
};

/**
 * Invite member to organization
 */
exports.inviteMember = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user._id;
    const { email, role = ORGANIZATION_ROLES.SCOUT } = req.body;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Check if user is owner or admin
    const userRole = organization.members.find((m) => m.userId?.toString() === userId.toString())?.role;
    if (![ORGANIZATION_ROLES.OWNER, ORGANIZATION_ROLES.ADMIN].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Only owner/admin can invite members',
      });
    }

    // Check if member already exists
    const existingMember = organization.members.find((m) => m.email === email);
    if (existingMember) {
      return res.status(400).json({
        success: false,
        error: 'Member already invited',
      });
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const member = {
      email,
      role,
      status: 'pending',
      invitedAt: new Date(),
      inviteToken,
      inviteTokenExpires,
    };

    organization.members.push(member);
    organization.logAction(userId, 'invite_member', 'organization', organizationId, { email, role });

    await organization.save();

    // Send invitation email
    const inviteUrl = `${process.env.FRONTEND_URL}/organizations/${organizationId}/join?token=${inviteToken}`;
    // Email sending would happen here (nodemailer)
    console.log(`Invitation sent to ${email}: ${inviteUrl}`);

    res.json({
      success: true,
      message: 'Invitation sent',
      member,
    });
  } catch (error) {
    console.error('Error inviting member:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invite member',
    });
  }
};

/**
 * Accept organization invitation
 */
exports.acceptInvitation = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user._id;
    const { inviteToken } = req.body;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Find pending member with token
    const pendingMember = organization.members.find(
      (m) => m.inviteToken === inviteToken && m.status === 'pending'
    );

    if (!pendingMember) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired invitation',
      });
    }

    if (new Date() > pendingMember.inviteTokenExpires) {
      return res.status(400).json({
        success: false,
        error: 'Invitation expired',
      });
    }

    // Update member
    pendingMember.userId = userId;
    pendingMember.status = 'active';
    pendingMember.joinedAt = new Date();
    pendingMember.inviteToken = undefined;
    pendingMember.inviteTokenExpires = undefined;

    organization.logAction(userId, 'accept_invitation', 'organization', organizationId, {
      role: pendingMember.role,
    });

    await organization.save();

    // Update user
    const user = await User.findById(userId);
    const orgEntry = user.organizations.find((o) => o.organizationId.toString() === organizationId);
    if (!orgEntry) {
      user.organizations.push({
        organizationId,
        role: pendingMember.role,
      });
    } else {
      orgEntry.role = pendingMember.role;
    }
    await user.save();

    res.json({
      success: true,
      message: 'Invitation accepted',
      organization,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept invitation',
    });
  }
};

/**
 * Update member role
 */
exports.updateMemberRole = async (req, res) => {
  try {
    const { organizationId, memberId } = req.params;
    const userId = req.user._id;
    const { role } = req.body;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Check if user is owner
    if (organization.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only organization owner can change roles',
      });
    }

    const member = organization.members.find((m) => m._id.toString() === memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    member.role = role;
    organization.logAction(userId, 'update_member_role', 'organization', organizationId, {
      memberId,
      newRole: role,
    });

    await organization.save();

    res.json({
      success: true,
      member,
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update member role',
    });
  }
};

/**
 * Remove member from organization
 */
exports.removeMember = async (req, res) => {
  try {
    const { organizationId, memberId } = req.params;
    const userId = req.user._id;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Check if user is owner
    if (organization.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only organization owner can remove members',
      });
    }

    const memberIndex = organization.members.findIndex((m) => m._id.toString() === memberId);
    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    const removedMember = organization.members[memberIndex];
    organization.members.splice(memberIndex, 1);

    organization.logAction(userId, 'remove_member', 'organization', organizationId, {
      memberId,
      memberEmail: removedMember.email,
    });

    await organization.save();

    res.json({
      success: true,
      message: 'Member removed',
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove member',
    });
  }
};

/**
 * Get audit logs
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user._id;
    const { limit = 100, skip = 0 } = req.query;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Check if user is member
    const isMember = organization.members.some((m) => m.userId?.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const logs = organization.auditLogs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(parseInt(skip), parseInt(skip) + parseInt(limit));

    res.json({
      success: true,
      logs,
      total: organization.auditLogs.length,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
    });
  }
};
