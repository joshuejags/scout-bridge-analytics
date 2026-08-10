const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const csv = require('csv-stringify');
const fs = require('fs');
const path = require('path');
const SavedReport = require('../models/SavedReport');
const ReportExport = require('../models/ReportExport');
const AuditService = require('./AuditService');

class ExportService {
  constructor() {
    this.exportsDir = path.join(__dirname, '../../exports');
    this.setupExportsDir();
  }

  setupExportsDir() {
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  /**
   * Create an export task
   */
  async createExport(userId, type, format, options = {}) {
    try {
      const { organizationId, reportId, filters = {}, scheduled } = options;

      const exportDoc = new ReportExport({
        userId,
        organizationId,
        reportId,
        type,
        format,
        filters,
        scheduled,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day download link
      });

      await exportDoc.save();

      // Log the export creation
      await AuditService.log(userId, 'export.create', {
        organizationId,
        resourceType: 'export',
        resourceId: exportDoc._id.toString(),
        details: { type, format },
      });

      return exportDoc;
    } catch (error) {
      console.error('Error creating export:', error);
      throw error;
    }
  }

  /**
   * Generate PDF export
   */
  async generatePDF(exportDoc, data) {
    try {
      const fileName = `${exportDoc.type}-${Date.now()}.pdf`;
      const filePath = path.join(this.exportsDir, fileName);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Add title
      doc.fontSize(24).font('Helvetica-Bold').text(exportDoc.type.replace(/_/g, ' ').toUpperCase(), {
        align: 'center',
      });

      doc.moveDown();
      doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()}`, {
        align: 'right',
      });

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // Add content based on export type
      if (exportDoc.type === 'scout_report') {
        this.addScoutReportContent(doc, data);
      } else if (exportDoc.type === 'player_profile') {
        this.addPlayerProfileContent(doc, data);
      } else if (exportDoc.type === 'team_analysis') {
        this.addTeamAnalysisContent(doc, data);
      }

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          const stats = fs.statSync(filePath);
          resolve({
            fileName,
            filePath,
            fileSize: stats.size,
          });
        });
        stream.on('error', reject);
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Generate Excel export
   */
  async generateExcel(exportDoc, data) {
    try {
      const fileName = `${exportDoc.type}-${Date.now()}.xlsx`;
      const filePath = path.join(this.exportsDir, fileName);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data');

      // Add headers
      if (exportDoc.type === 'player_profile' && Array.isArray(data)) {
        const headers = [
          'Name',
          'Position',
          'Age',
          'Height',
          'Weight',
          'Club',
          'Country',
          'Rating',
        ];
        worksheet.addRow(headers);

        data.forEach((player) => {
          worksheet.addRow([
            player.name,
            player.position,
            player.age,
            player.height,
            player.weight,
            player.club,
            player.country,
            player.rating,
          ]);
        });
      } else if (exportDoc.type === 'team_analysis') {
        const headers = [
          'Date',
          'Opponent',
          'Result',
          'Goals For',
          'Goals Against',
          'Possession %',
          'Shots',
        ];
        worksheet.addRow(headers);

        if (Array.isArray(data)) {
          data.forEach((match) => {
            worksheet.addRow([
              match.date,
              match.opponent,
              match.result,
              match.goalsFor,
              match.goalsAgainst,
              match.possession,
              match.shots,
            ]);
          });
        }
      }

      // Format headers
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF667eea' } };

      // Auto-size columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const cellLength = cell.value ? cell.value.toString().length : 0;
          if (cellLength > maxLength) {
            maxLength = cellLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });

      await workbook.xlsx.writeFile(filePath);

      const stats = fs.statSync(filePath);
      return {
        fileName,
        filePath,
        fileSize: stats.size,
      };
    } catch (error) {
      console.error('Error generating Excel:', error);
      throw error;
    }
  }

  /**
   * Generate CSV export
   */
  async generateCSV(exportDoc, data) {
    try {
      const fileName = `${exportDoc.type}-${Date.now()}.csv`;
      const filePath = path.join(this.exportsDir, fileName);

      return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(filePath);

        if (exportDoc.type === 'player_profile' && Array.isArray(data)) {
          const stringifier = csv.stringify({
            header: true,
            columns: ['name', 'position', 'age', 'height', 'weight', 'club', 'country', 'rating'],
          });

          stringifier.pipe(output);
          data.forEach((player) => stringifier.write(player));
          stringifier.end();
        }

        output.on('finish', () => {
          const stats = fs.statSync(filePath);
          resolve({
            fileName,
            filePath,
            fileSize: stats.size,
          });
        });

        output.on('error', reject);
      });
    } catch (error) {
      console.error('Error generating CSV:', error);
      throw error;
    }
  }

  /**
   * Helper: Add scout report content to PDF
   */
  addScoutReportContent(doc, data) {
    doc.fontSize(14).font('Helvetica-Bold').text('Scout Report', { underline: true });
    doc.moveDown();

    if (data.playerName) {
      doc.fontSize(12).text(`Player: ${data.playerName}`);
      doc.text(`Position: ${data.position}`);
      doc.text(`Age: ${data.age}`);
      doc.moveDown();
    }

    if (data.strengths) {
      doc.fontSize(12).font('Helvetica-Bold').text('Strengths:');
      doc.fontSize(11).font('Helvetica');
      doc.text(data.strengths);
      doc.moveDown();
    }

    if (data.weaknesses) {
      doc.fontSize(12).font('Helvetica-Bold').text('Weaknesses:');
      doc.fontSize(11).font('Helvetica');
      doc.text(data.weaknesses);
      doc.moveDown();
    }

    if (data.recommendation) {
      doc.fontSize(12).font('Helvetica-Bold').text('Recommendation:');
      doc.fontSize(11).font('Helvetica');
      doc.text(data.recommendation);
    }
  }

  /**
   * Helper: Add player profile content to PDF
   */
  addPlayerProfileContent(doc, data) {
    doc.fontSize(14).font('Helvetica-Bold').text('Player Profile', { underline: true });
    doc.moveDown();

    if (Array.isArray(data) && data.length > 0) {
      data.forEach((player, index) => {
        if (index > 0) doc.addPage();

        doc.fontSize(12).font('Helvetica-Bold').text(player.name);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Position: ${player.position}`);
        doc.text(`Age: ${player.age}`);
        doc.text(`Club: ${player.club}`);
        doc.text(`Country: ${player.country}`);
        doc.moveDown();
      });
    }
  }

  /**
   * Helper: Add team analysis content to PDF
   */
  addTeamAnalysisContent(doc, data) {
    doc.fontSize(14).font('Helvetica-Bold').text('Team Analysis', { underline: true });
    doc.moveDown();

    if (Array.isArray(data) && data.length > 0) {
      data.forEach((match, index) => {
        doc.fontSize(11).font('Helvetica-Bold').text(`Match ${index + 1}`);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Date: ${match.date}`);
        doc.text(`Opponent: ${match.opponent}`);
        doc.text(`Result: ${match.result}`);
        doc.text(`Possession: ${match.possession}%`);
        doc.moveDown();
      });
    }
  }

  /**
   * Get export history
   */
  async getExportHistory(userId, organizationId, pagination = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const skip = (page - 1) * limit;

      const exports = await ReportExport.find({ userId, organizationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await ReportExport.countDocuments({ userId, organizationId });

      return {
        exports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error fetching export history:', error);
      throw error;
    }
  }

  /**
   * Update export status
   */
  async updateExportStatus(exportId, status, metadata = {}) {
    try {
      const update = { status, ...metadata };
      const exportDoc = await ReportExport.findByIdAndUpdate(exportId, update, { new: true });
      return exportDoc;
    } catch (error) {
      console.error('Error updating export status:', error);
      throw error;
    }
  }

  /**
   * Schedule recurring exports
   */
  async scheduleRecurringExport(userId, exportId, frequency) {
    try {
      const nextRun = this.calculateNextRun(frequency);

      const exportDoc = await ReportExport.findByIdAndUpdate(
        exportId,
        {
          scheduled: {
            enabled: true,
            frequency,
            nextRun,
          },
        },
        { new: true }
      );

      return exportDoc;
    } catch (error) {
      console.error('Error scheduling export:', error);
      throw error;
    }
  }

  /**
   * Calculate next run time
   */
  calculateNextRun(frequency) {
    const now = new Date();
    const nextRun = new Date(now);

    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }

    return nextRun;
  }

  /**
   * Cleanup old exports
   */
  async cleanupOldExports(daysOld = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const exports = await ReportExport.find({
        createdAt: { $lt: cutoffDate },
        status: 'completed',
      });

      for (const exp of exports) {
        if (exp.filePath && fs.existsSync(exp.filePath)) {
          fs.unlinkSync(exp.filePath);
        }
        await ReportExport.deleteOne({ _id: exp._id });
      }

      console.log(`Cleaned up ${exports.length} old exports`);
      return exports.length;
    } catch (error) {
      console.error('Error cleaning up old exports:', error);
      throw error;
    }
  }
}

module.exports = new ExportService();
