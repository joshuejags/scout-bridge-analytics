const ExportService = require('../services/ExportService');
const ReportExport = require('../models/ReportExport');
const SavedReport = require('../models/SavedReport');
const { validateObjectId, validatePagination } = require('../utils/validators');

exports.createExport = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type, format, reportId, filters } = req.body;

    if (!['scout_report', 'player_profile', 'team_analysis', 'match_analysis', 'analytics'].includes(type)) {
      return res.status(400).json({ error: 'Invalid export type' });
    }

    if (!['pdf', 'csv', 'excel', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid export format' });
    }

    const exportDoc = await ExportService.createExport(req.user._id, type, format, {
      organizationId: req.user.primaryOrganizationId,
      reportId,
      filters,
    });

    res.status(201).json(exportDoc);
  } catch (error) {
    console.error('Error creating export:', error);
    res.status(500).json({ error: 'Failed to create export' });
  }
};

exports.generateExport = async (req, res) => {
  try {
    const { exportId } = req.params;
    validateObjectId(exportId);

    const exportDoc = await ReportExport.findById(exportId);

    if (!exportDoc) {
      return res.status(404).json({ error: 'Export not found' });
    }

    if (exportDoc.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update status to processing
    await ExportService.updateExportStatus(exportId, 'processing');

    let result;
    let data = {};

    // Fetch data based on export type
    if (exportDoc.reportId) {
      const report = await SavedReport.findById(exportDoc.reportId);
      data = report ? report.toObject() : {};
    }

    // Generate export based on format
    if (exportDoc.format === 'pdf') {
      result = await ExportService.generatePDF(exportDoc, data);
    } else if (exportDoc.format === 'excel') {
      result = await ExportService.generateExcel(exportDoc, data);
    } else if (exportDoc.format === 'csv') {
      result = await ExportService.generateCSV(exportDoc, data);
    } else if (exportDoc.format === 'json') {
      result = {
        fileName: `${exportDoc.type}-${Date.now()}.json`,
        fileSize: JSON.stringify(data).length,
      };
    }

    // Update export with success info
    const downloadUrl = `/api/exports/${exportId}/download`;
    await ExportService.updateExportStatus(exportId, 'completed', {
      fileName: result.fileName,
      fileSize: result.fileSize,
      filePath: result.filePath,
      downloadUrl,
      progress: { current: 100, total: 100 },
    });

    res.json({
      success: true,
      downloadUrl,
      fileName: result.fileName,
      fileSize: result.fileSize,
    });
  } catch (error) {
    console.error('Error generating export:', error);

    const { exportId } = req.params;
    await ExportService.updateExportStatus(exportId, 'failed', {
      error: error.message,
    });

    res.status(500).json({ error: 'Failed to generate export' });
  }
};

exports.getExportHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { page = 1, limit = 20 } = req.query;
    const pagination = validatePagination(page, limit);

    const result = await ExportService.getExportHistory(
      req.user._id,
      req.user.primaryOrganizationId,
      pagination
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching export history:', error);
    res.status(500).json({ error: 'Failed to fetch export history' });
  }
};

exports.downloadExport = async (req, res) => {
  try {
    const { exportId } = req.params;
    validateObjectId(exportId);

    const exportDoc = await ReportExport.findById(exportId);

    if (!exportDoc) {
      return res.status(404).json({ error: 'Export not found' });
    }

    if (
      exportDoc.userId.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (exportDoc.status !== 'completed') {
      return res.status(400).json({ error: 'Export not ready for download' });
    }

    if (exportDoc.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Download link has expired' });
    }

    const fs = require('fs');
    const filePath = exportDoc.filePath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Export file not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${exportDoc.fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading export:', error);
    res.status(500).json({ error: 'Failed to download export' });
  }
};

exports.deleteExport = async (req, res) => {
  try {
    const { exportId } = req.params;
    validateObjectId(exportId);

    const exportDoc = await ReportExport.findById(exportId);

    if (!exportDoc) {
      return res.status(404).json({ error: 'Export not found' });
    }

    if (exportDoc.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file if it exists
    const fs = require('fs');
    if (exportDoc.filePath && fs.existsSync(exportDoc.filePath)) {
      fs.unlinkSync(exportDoc.filePath);
    }

    await ReportExport.deleteOne({ _id: exportId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting export:', error);
    res.status(500).json({ error: 'Failed to delete export' });
  }
};

exports.scheduleExport = async (req, res) => {
  try {
    const { exportId } = req.params;
    const { frequency } = req.body;

    validateObjectId(exportId);

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }

    const exportDoc = await ReportExport.findById(exportId);

    if (!exportDoc) {
      return res.status(404).json({ error: 'Export not found' });
    }

    if (exportDoc.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await ExportService.scheduleRecurringExport(req.user._id, exportId, frequency);

    res.json(result);
  } catch (error) {
    console.error('Error scheduling export:', error);
    res.status(500).json({ error: 'Failed to schedule export' });
  }
};
