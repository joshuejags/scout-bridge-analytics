/**
 * AI Report Generator
 * Creates automated scouting reports with AI-generated insights, strengths, weaknesses, and recommendations
 */

const analyzePlayerStrengths = (playerData, actions, stats) => {
  const strengths = [];

  // Analyze based on distance covered
  if (stats?.distanceCovered > 8000) {
    strengths.push({
      area: 'Movement & Endurance',
      insight: `Outstanding work rate with ${Math.round(stats.distanceCovered / 1000)} km covered. Demonstrates excellent fitness and commitment to physical demands.`,
      confidence: 0.95,
    });
  }

  // Analyze based on sprint count
  if (stats?.sprintCount > 15) {
    strengths.push({
      area: 'Intensity & Explosiveness',
      insight: `High-frequency sprints (${stats.sprintCount}) indicate excellent acceleration and competitive intensity throughout the match.`,
      confidence: 0.90,
    });
  }

  // Analyze based on action completion
  const totalActions = actions?.length || 0;
  if (totalActions > 5) {
    strengths.push({
      area: 'Technical Involvement',
      insight: `Consistently involved in key actions (${totalActions} events), showing good positioning and decision-making.`,
      confidence: 0.85,
    });
  }

  // Analyze offensive contributions
  const shots = actions?.filter(a => a.type === 'shot')?.length || 0;
  if (shots > 0) {
    strengths.push({
      area: 'Offensive Threat',
      insight: `Demonstrates attacking ambition with ${shots} shot${shots > 1 ? 's' : ''}, indicating confidence and opportunity recognition.`,
      confidence: 0.80,
    });
  }

  // Analyze defensive contributions
  const defenseActions = actions?.filter(a => a.type === 'tackle' || a.type === 'interception')?.length || 0;
  if (defenseActions > 3) {
    strengths.push({
      area: 'Defensive Solidity',
      insight: `Active defender with ${defenseActions} defensive actions, showing positioning awareness and willingness to compete for the ball.`,
      confidence: 0.85,
    });
  }

  return strengths.slice(0, 5);
};

const analyzePlayerWeaknesses = (playerData, actions, stats, metrics) => {
  const weaknesses = [];

  // Analyze low distance
  if (stats?.distanceCovered < 4000) {
    weaknesses.push({
      area: 'Movement Efficiency',
      insight: `Lower distance covered (${Math.round(stats.distanceCovered / 1000)} km) suggests potential fitness concerns or limited involvement in play.`,
      confidence: 0.80,
    });
  }

  // Analyze low sprint count
  if (stats?.sprintCount < 5) {
    weaknesses.push({
      area: 'Intensity & Pace',
      insight: `Minimal high-intensity efforts. May indicate need for improved fitness conditioning or tactical positioning.`,
      confidence: 0.75,
    });
  }

  // Analyze pass completion
  if (metrics?.passCompletion && metrics.passCompletion < 60) {
    weaknesses.push({
      area: 'Passing Accuracy',
      insight: `Pass completion below 60% suggests technical inconsistency or poor decision-making in ball distribution.`,
      confidence: 0.85,
    });
  }

  // Analyze pressing intensity
  if (metrics?.pressingIntensity && metrics.pressingIntensity < 30) {
    weaknesses.push({
      area: 'Defensive Pressure',
      insight: `Low pressing intensity may indicate reluctance to challenge for the ball or tactical instructions to cover space rather than press.`,
      confidence: 0.70,
    });
  }

  // Analyze low action volume
  if (actions?.length < 2) {
    weaknesses.push({
      area: 'Match Impact',
      insight: `Minimal involvement in key actions suggests limited influence on match play. May need improved positioning or decision-making.`,
      confidence: 0.80,
    });
  }

  return weaknesses.slice(0, 4);
};

const identifyDevelopmentAreas = (playerData, actions, stats, metrics, strengths, weaknesses) => {
  const areas = [];

  // If high activity but low accuracy, focus on decision-making
  if (actions?.length > 5 && metrics?.passCompletion < 70) {
    areas.push({
      area: 'Decision Making',
      recommendation: 'Increased mental training focus on situation assessment and timing of passes. Video analysis of decision-making patterns.',
      priority: 'high',
    });
  }

  // If low pressing, develop defensive positioning
  if (metrics?.pressingIntensity < 40) {
    areas.push({
      area: 'Defensive Positioning',
      recommendation: 'Work on trigger recognition for pressing and defensive spacing. Positioning drills and tactical familiarity.',
      priority: 'high',
    });
  }

  // If high distance but low accuracy, focus on efficiency
  if (stats?.distanceCovered > 8000 && metrics?.passCompletion < 65) {
    areas.push({
      area: 'Technical Efficiency',
      recommendation: 'Balance energy expenditure with output. Improve movement precision and reduce wasted motion.',
      priority: 'medium',
    });
  }

  // If low sprint count, develop intensity
  if (stats?.sprintCount < 8) {
    areas.push({
      area: 'Physical Conditioning',
      recommendation: 'Interval training program to increase high-intensity effort capacity and explosive power.',
      priority: 'medium',
    });
  }

  // If few offensive actions but high movement, develop attacking awareness
  const offensiveActions = actions?.filter(a => a.type === 'shot' || a.type === 'pass')?.length || 0;
  if (stats?.distanceCovered > 6000 && offensiveActions < 3) {
    areas.push({
      area: 'Attacking Awareness',
      recommendation: 'Tactical coaching on attacking movement patterns and chance creation. Increase shot volume in training.',
      priority: 'medium',
    });
  }

  return areas.slice(0, 4);
};

const generateExecutiveSummary = (playerData, stats, metrics, strengths, weaknesses, recommendation) => {
  const performanceRating = Math.round((recommendation.score || 50) / 20);
  const performanceLabel = ['Poor', 'Below Average', 'Average', 'Good', 'Excellent', 'Outstanding'][performanceRating];

  let summary = `${performanceLabel} all-around performance with `;

  if (strengths.length > 0) {
    const topStrength = strengths[0];
    summary += `standout ${topStrength.area.toLowerCase()}. `;
  }

  if (weaknesses.length > 0) {
    const mainWeakness = weaknesses[0];
    summary += `Primary development area: ${mainWeakness.area.toLowerCase()}.`;
  } else {
    summary += `Solid execution across key areas.`;
  }

  summary += ` Recommendation: ${recommendation.label.toLowerCase()}.`;

  return summary;
};

const generateRecommendationScore = (stats, metrics, actions) => {
  let score = 50; // Base score

  // Scoring factors
  if (stats?.distanceCovered > 8000) score += 15;
  if (stats?.distanceCovered > 6000) score += 10;
  if (stats?.sprintCount > 15) score += 10;
  if (metrics?.passCompletion > 75) score += 10;
  if (metrics?.pressingIntensity > 60) score += 8;
  if (actions?.length > 5) score += 8;

  // Penalty factors
  if (stats?.distanceCovered < 4000) score -= 20;
  if (metrics?.passCompletion < 50) score -= 15;
  if (actions?.length === 0) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const generateAIReport = (analysis) => {
  if (!analysis) return null;

  const { playerData = [], actions = [], ballPossession = [], video = {} } = analysis;
  
  // Get team-specific player data
  const teamPlayers = playerData.filter(p => p);
  if (teamPlayers.length === 0) return null;

  const player = teamPlayers[0];
  const stats = player.statistics || {};

  // Calculate metrics
  const xg = actions.filter(a => a.type === 'shot').length * 0.12;
  const xa = actions.filter(a => a.type === 'pass').length * 0.02;
  const passCompletion = actions.filter(a => a.type === 'pass' && a.confidence > 0.6).length / (actions.filter(a => a.type === 'pass').length || 1) * 100;
  const pressingIntensity = actions.filter(a => a.type === 'tackle' || a.type === 'interception').length / 10 * 100;

  const metrics = {
    xg: Math.round(xg * 100) / 100,
    xa: Math.round(xa * 100) / 100,
    passCompletion: Math.round(passCompletion),
    pressingIntensity: Math.round(Math.min(pressingIntensity, 100)),
  };

  // Generate analysis components
  const strengths = analyzePlayerStrengths(playerData, actions, stats);
  const weaknesses = analyzePlayerWeaknesses(playerData, actions, stats, metrics);
  const recommendationScore = generateRecommendationScore(stats, metrics, actions);

  const recommendation = {
    score: recommendationScore,
    label: recommendationScore >= 80 ? 'Strong shortlist candidate'
      : recommendationScore >= 60 ? 'Promising profile'
      : recommendationScore >= 40 ? 'Monitor for future'
      : 'Needs further evaluation',
  };

  const developmentAreas = identifyDevelopmentAreas(playerData, actions, stats, metrics, strengths, weaknesses);
  const executiveSummary = generateExecutiveSummary(playerData, stats, metrics, strengths, weaknesses, recommendation);

  return {
    timestamp: new Date().toISOString(),
    videoInfo: {
      name: video.originalName || 'Analysis',
      sport: video.sport || 'soccer',
      date: video.createdAt || new Date().toISOString(),
    },
    playerMetrics: metrics,
    playerStats: stats,
    strengths,
    weaknesses,
    developmentAreas,
    recommendation,
    executiveSummary,
  };
};

export const formatReportForExport = (report, format = 'markdown') => {
  if (format === 'markdown') {
    let md = `# Scouting Report\n\n`;
    md += `**${report.videoInfo.name}** | ${report.videoInfo.sport}\n\n`;
    
    md += `## Executive Summary\n${report.executiveSummary}\n\n`;
    
    md += `## Metrics\n`;
    md += `- Expected Goals (xG): ${report.playerMetrics.xg}\n`;
    md += `- Expected Assists (xA): ${report.playerMetrics.xa}\n`;
    md += `- Pass Completion: ${report.playerMetrics.passCompletion}%\n`;
    md += `- Pressing Intensity: ${report.playerMetrics.pressingIntensity}%\n\n`;
    
    md += `## Strengths\n`;
    report.strengths.forEach(s => {
      md += `- **${s.area}**: ${s.insight}\n`;
    });
    md += '\n';
    
    md += `## Areas for Development\n`;
    report.weaknesses.forEach(w => {
      md += `- **${w.area}**: ${w.insight}\n`;
    });
    md += '\n';
    
    md += `## Development Plan\n`;
    report.developmentAreas.forEach(d => {
      md += `- **${d.area}** (${d.priority}): ${d.recommendation}\n`;
    });
    
    md += `\n## Recommendation\n**${report.recommendation.label}** (Score: ${report.recommendation.score}/100)\n`;
    
    return md;
  }
  
  return JSON.stringify(report, null, 2);
};
