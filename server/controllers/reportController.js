const Analysis = require('../models/Analysis');
const SavedReport = require('../models/SavedReport');
const Video = require('../models/Video');
const { buildReportInsights } = require('../utils/reportInsights');
const REPORT_TEMPLATES = ['scout-summary', 'recruitment-decision', 'player-development'];

exports.listSavedReports = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const reports = await SavedReport.find(filter)
      .populate('owner', 'name role')
      .populate('video', 'originalName sport status createdAt')
      .sort({ updatedAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.saveReport = async (req, res) => {
  try {
    const video = await Video.findById(req.body.videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const analysis = await Analysis.findOne({ video: req.body.videoId }).populate({
      path: 'playerData.playerId',
      select: 'name',
    });
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found for this video' });
    }

    const insightSnapshot = buildReportInsights(analysis.toObject ? analysis.toObject() : analysis);
    const generatedSummary = buildGeneratedSummary(analysis, insightSnapshot);
    const report = await SavedReport.findOneAndUpdate(
      { owner: req.user._id, video: video._id },
      {
        owner: req.user._id,
        video: video._id,
        analysis: analysis._id,
        template: normalizeTemplate(req.body.template),
        title: req.body.title?.trim() || `${video.originalName} scouting report`,
        summary: req.body.summary?.trim() || generatedSummary,
        tags: normalizeTags(req.body.tags),
        insightSnapshot,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    )
      .populate('owner', 'name role')
      .populate('video', 'originalName sport status createdAt');

    res.status(201).json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateSavedReport = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, owner: req.user._id };
    const report = await SavedReport.findOneAndUpdate(
      filter,
      {
        template: normalizeTemplate(req.body.template),
        title: req.body.title?.trim(),
        summary: req.body.summary?.trim(),
        tags: req.body.tags ? normalizeTags(req.body.tags) : undefined,
      },
      { new: true, runValidators: true }
    )
      .populate('owner', 'name role')
      .populate('video', 'originalName sport status createdAt');

    if (!report) {
      return res.status(404).json({ error: 'Saved report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.exportSavedReport = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, owner: req.user._id };
    const report = await SavedReport.findOne(filter)
      .populate('owner', 'name role')
      .populate('video', 'originalName sport status createdAt')
      .populate('analysis');

    if (!report) {
      return res.status(404).json({ error: 'Saved report not found' });
    }

    const content = buildExportContent(report);
    const safeTitle = report.title.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'saved-report';
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.md"`);
    res.send(content);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteSavedReport = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, owner: req.user._id };
    const report = await SavedReport.findOneAndDelete(filter);
    if (!report) {
      return res.status(404).json({ error: 'Saved report not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

function normalizeTags(tags) {
  const input = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : [];
  return [...new Set(input.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8))];
}

function normalizeTemplate(template) {
  return REPORT_TEMPLATES.includes(template) ? template : 'scout-summary';
}

function buildGeneratedSummary(analysis, insightSnapshot) {
  return (
    insightSnapshot?.suggestedSummary ||
    `Tracked ${analysis.summary?.totalPlayers || 0} players across ${analysis.summary?.matchDuration || 0} seconds. No major actions were detected.`
  );
}

function buildExportContent(report) {
  const templateLabel = {
    'scout-summary': 'Scout Summary',
    'recruitment-decision': 'Recruitment Decision',
    'player-development': 'Player Development',
  }[report.template] || 'Scout Summary';
  const insightSnapshot = report.insightSnapshot || buildReportInsights(report.analysis || {});
  const actionLines = (insightSnapshot.eventBreakdown || []).map((action) => `- ${action.type}: ${action.count}`);
  const standoutLines = (insightSnapshot.standoutPlayers || []).map(
    (player) =>
      `- ${player.label}: ${player.distanceCovered}m covered, ${player.sprintCount} sprints, activation area ${player.activationArea}${
        player.verified ? ', verified' : ''
      }`
  );
  const highlightLines = (insightSnapshot.highlightedMoments || []).map(
    (moment) => `- Frame ${moment.frameNumber}: ${moment.type} - ${moment.description || 'Reviewable highlight'}`
  );
  const templateSections = buildTemplateSections(report.template, report.summary, insightSnapshot);

  return [
    `# ${report.title}`,
    '',
    `**Template:** ${templateLabel}`,
    `**Video:** ${report.video?.originalName || 'Unknown video'}`,
    `**Sport:** ${report.video?.sport || 'soccer'}`,
    `**Status:** ${report.video?.status || 'saved'}`,
    `**Saved by:** ${report.owner?.name || 'ScoutBridge user'}`,
    `**Updated:** ${new Date(report.updatedAt).toLocaleString()}`,
    '',
    ...templateSections,
    '## Match Context',
    `- Tracked players: ${insightSnapshot.metrics?.trackedPlayers || report.analysis?.summary?.totalPlayers || 0}`,
    `- Verified tracks: ${insightSnapshot.metrics?.verifiedTracks || 0}`,
    `- Match duration: ${report.analysis?.summary?.matchDuration || 0} seconds`,
    `- Logged actions: ${insightSnapshot.metrics?.totalActions || (report.analysis?.actions || []).length || 0}`,
    '',
    '## Event Breakdown',
    ...(actionLines.length ? actionLines : ['- No major actions detected']),
    '',
    '## Standout Profiles',
    ...(standoutLines.length ? standoutLines : ['- No standout player profiles yet']),
    '',
    '## Highlights',
    ...(highlightLines.length ? highlightLines : ['- No highlighted moments']),
    '',
    '## Tags',
    ...(report.tags?.length ? report.tags.map((tag) => `- ${tag}`) : ['- No tags']),
    '',
  ].join('\n');
}

function buildTemplateSections(template, summary, insightSnapshot) {
  const recommendationLines = [
    `- Recommendation: ${insightSnapshot.recommendation?.label || 'Monitor'}`,
    `- Decision score: ${insightSnapshot.recommendation?.score || 0}/100`,
    `- Confidence: ${insightSnapshot.confidence?.label || 'Low confidence'} (${insightSnapshot.confidence?.score || 0}/100)`,
    `- Rationale: ${insightSnapshot.recommendation?.reason || 'No rationale generated.'}`,
  ];
  const recruitmentLines = (insightSnapshot.recruitmentSignals || []).map((signal) => `- ${signal}`);
  const tacticalLines = (insightSnapshot.tacticalSignals || []).map((signal) => `- ${signal}`);
  const developmentLines = (insightSnapshot.developmentAreas || []).map((signal) => `- ${signal}`);

  if (template === 'recruitment-decision') {
    return [
      '## Decision Snapshot',
      ...(recommendationLines.length ? recommendationLines : ['- No decision snapshot available.']),
      '',
      '## Why This Prospect Stands Out',
      ...(recruitmentLines.length ? recruitmentLines : ['- No recruitment signals generated.']),
      '',
      '## Tactical Fit Notes',
      ...(tacticalLines.length ? tacticalLines : ['- Tactical fit needs a broader sample.']),
      '',
    ];
  }

  if (template === 'player-development') {
    return [
      '## Development Snapshot',
      summary || insightSnapshot.suggestedSummary || 'No summary provided.',
      '',
      '## Training Priorities',
      ...(developmentLines.length ? developmentLines : ['- No development priorities generated.']),
      '',
      '## Supporting Recruitment Signals',
      ...(recruitmentLines.length ? recruitmentLines : ['- No supporting signals generated.']),
      '',
      '## Tactical Context',
      ...(tacticalLines.length ? tacticalLines : ['- Tactical context unavailable.']),
      '',
    ];
  }

  return [
    '## Executive Summary',
    summary || insightSnapshot.suggestedSummary || 'No summary provided.',
    '',
    '## Recommendation',
    ...(recommendationLines.length ? recommendationLines : ['- No recommendation generated.']),
    '',
    '## Recruitment Signals',
    ...(recruitmentLines.length ? recruitmentLines : ['- No recruitment signals generated.']),
    '',
    '## Tactical Notes',
    ...(tacticalLines.length ? tacticalLines : ['- Tactical notes unavailable.']),
    '',
  ];
}
