const router = require('express').Router();
const exportController = require('../controllers/exportController');

// Create export
router.post('/exports', exportController.createExport);

// Generate/process export
router.post('/exports/:exportId/generate', exportController.generateExport);

// Get export history
router.get('/exports', exportController.getExportHistory);

// Download export
router.get('/exports/:exportId/download', exportController.downloadExport);

// Delete export
router.delete('/exports/:exportId', exportController.deleteExport);

// Schedule recurring export
router.post('/exports/:exportId/schedule', exportController.scheduleExport);

module.exports = router;
