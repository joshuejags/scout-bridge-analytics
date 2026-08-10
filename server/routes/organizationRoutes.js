const express = require('express');
const { authenticate } = require('../middleware/auth');
const organizationController = require('../controllers/organizationController');

const router = express.Router();

// All organization routes require authentication
router.use(authenticate);

/**
 * POST /api/organizations - Create organization
 */
router.post('/', organizationController.createOrganization);

/**
 * GET /api/organizations/my - Get user's organizations
 */
router.get('/my', organizationController.getMyOrganizations);

/**
 * GET /api/organizations/:organizationId - Get organization
 */
router.get('/:organizationId', organizationController.getOrganization);

/**
 * PUT /api/organizations/:organizationId - Update organization
 */
router.put('/:organizationId', organizationController.updateOrganization);

/**
 * POST /api/organizations/:organizationId/invite - Invite member
 */
router.post('/:organizationId/invite', organizationController.inviteMember);

/**
 * POST /api/organizations/:organizationId/accept-invitation - Accept invitation
 */
router.post('/:organizationId/accept-invitation', organizationController.acceptInvitation);

/**
 * PATCH /api/organizations/:organizationId/members/:memberId/role - Update member role
 */
router.patch('/:organizationId/members/:memberId/role', organizationController.updateMemberRole);

/**
 * DELETE /api/organizations/:organizationId/members/:memberId - Remove member
 */
router.delete('/:organizationId/members/:memberId', organizationController.removeMember);

/**
 * GET /api/organizations/:organizationId/audit-logs - Get audit logs
 */
router.get('/:organizationId/audit-logs', organizationController.getAuditLogs);

module.exports = router;
