function buildReportInsights(analysis) {
  const playerData = Array.isArray(analysis?.playerData) ? analysis.playerData : [];
  const actions = Array.isArray(analysis?.actions) ? analysis.actions : [];
  const highlightedMoments = Array.isArray(analysis?.summary?.highlightedMoments)
    ? analysis.summary.highlightedMoments.slice(0, 4)
    : [];
  const trackedPlayers = Number(analysis?.summary?.totalPlayers || playerData.length || 0);
  const verifiedTracks = playerData.filter((player) => player?.verified).length;
  const eventBreakdown = buildEventBreakdown(actions);
  const actionCounts = eventBreakdown.reduce((acc, action) => {
    acc[action.type] = action.count;
    return acc;
  }, {});
  const standoutPlayers = [...playerData]
    .sort((a, b) => {
      const distanceGap = (b?.statistics?.distanceCovered || 0) - (a?.statistics?.distanceCovered || 0);
      if (distanceGap !== 0) return distanceGap;
      return (b?.statistics?.sprintCount || 0) - (a?.statistics?.sprintCount || 0);
    })
    .slice(0, 3)
    .map((player, index) => ({
      label: getPlayerLabel(player, index),
      distanceCovered: Number(player?.statistics?.distanceCovered || 0),
      sprintCount: Number(player?.statistics?.sprintCount || 0),
      activationArea: player?.statistics?.activationArea || 'Unknown',
      verified: Boolean(player?.verified),
    }));
  const tacticalSignals = buildTacticalSignals(analysis?.tacticalData?.teams);
  const totalActions = actions.length;
  const recommendationScore = buildRecommendationScore({
    totalActions,
    highlightedMoments: highlightedMoments.length,
    verifiedTracks,
    trackedPlayers,
    standoutPlayer: standoutPlayers[0],
    tacticalSignalsCount: tacticalSignals.length,
  });
  const confidenceScore = buildConfidenceScore({
    trackedPlayers,
    verifiedTracks,
    totalActions,
    highlightedMoments: highlightedMoments.length,
    tacticalSignalsCount: tacticalSignals.length,
  });
  const recommendationLabel =
    recommendationScore >= 75 ? 'Priority live view' : recommendationScore >= 55 ? 'Shortlist review' : 'Monitor';
  const confidenceLabel =
    confidenceScore >= 70 ? 'High confidence' : confidenceScore >= 45 ? 'Medium confidence' : 'Low confidence';
  const recruitmentSignals = buildRecruitmentSignals({
    standoutPlayers,
    actionCounts,
    trackedPlayers,
    verifiedTracks,
    highlightedMoments: highlightedMoments.length,
  });
  const developmentAreas = buildDevelopmentAreas({
    standoutPlayers,
    actionCounts,
    totalActions,
    highlightedMoments: highlightedMoments.length,
  });
  const topEvent = eventBreakdown[0];
  const topPlayer = standoutPlayers[0];
  const suggestedSummary = [
    `Recommendation: ${recommendationLabel}.`,
    `Tracked ${trackedPlayers} players over ${Number(analysis?.summary?.matchDuration || 0)} seconds with ${totalActions} logged actions.`,
    topPlayer ? `${topPlayer.label} set the work rate with ${topPlayer.distanceCovered}m covered and ${topPlayer.sprintCount} sprints.` : 'No standout player movement was isolated.',
    topEvent ? `Most frequent event: ${topEvent.count} ${pluralize(topEvent.type, topEvent.count)}.` : 'No major actions were detected.',
  ].join(' ');

  return {
    suggestedSummary,
    recommendation: {
      label: recommendationLabel,
      score: recommendationScore,
      reason: `Built from ${trackedPlayers} tracked players, ${verifiedTracks} verified tracks, ${totalActions} logged actions, and ${tacticalSignals.length} tactical shape signal${tacticalSignals.length === 1 ? '' : 's'}.`,
    },
    confidence: {
      label: confidenceLabel,
      score: confidenceScore,
    },
    metrics: {
      trackedPlayers,
      verifiedTracks,
      totalActions,
      highlightedMoments: highlightedMoments.length,
    },
    eventBreakdown,
    recruitmentSignals,
    tacticalSignals,
    developmentAreas,
    standoutPlayers,
    highlightedMoments: highlightedMoments.map((moment) => ({
      frameNumber: Number(moment?.frameNumber || 0),
      type: moment?.type || 'highlight',
      description: moment?.description || '',
    })),
  };
}

function buildEventBreakdown(actions) {
  return Object.entries(
    actions.reduce((acc, action) => {
      acc[action?.type || 'unknown'] = (acc[action?.type || 'unknown'] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
}

function buildTacticalSignals(teams) {
  if (!Array.isArray(teams) || teams.length === 0) return [];
  return teams.slice(0, 2).map((team) => {
    const width = Number(team?.shape?.width || 0).toFixed(1);
    const compactness = Number(team?.shape?.compactness || 0).toFixed(1);
    const lineCount = Number(team?.formation?.lineCount || 0);
    const lineup = Array.isArray(team?.formation?.lineup) && team.formation.lineup.length > 0
      ? team.formation.lineup.join('-')
      : 'unconfirmed spacing';
    return `${formatTeamColor(team?.teamColor)} held ${width}m width with ${compactness}m compactness across ${lineCount || 'unconfirmed'} line${lineCount === 1 ? '' : 's'} (${lineup}).`;
  });
}

function buildRecommendationScore({ totalActions, highlightedMoments, verifiedTracks, trackedPlayers, standoutPlayer, tacticalSignalsCount }) {
  const activityScore = Math.min(36, totalActions * 5 + highlightedMoments * 3);
  const movementScore = Math.min(
    34,
    Math.round(Number(standoutPlayer?.distanceCovered || 0) / 90) + Number(standoutPlayer?.sprintCount || 0) * 2
  );
  const verificationRate = trackedPlayers > 0 ? verifiedTracks / trackedPlayers : 0;
  const structureScore = Math.min(30, Math.round(verificationRate * 22) + (tacticalSignalsCount > 0 ? 8 : 0));
  return Math.min(100, activityScore + movementScore + structureScore);
}

function buildConfidenceScore({ trackedPlayers, verifiedTracks, totalActions, highlightedMoments, tacticalSignalsCount }) {
  const verificationRate = trackedPlayers > 0 ? verifiedTracks / trackedPlayers : 0;
  return Math.min(
    100,
    Math.round(verificationRate * 60) + Math.min(20, totalActions * 2) + Math.min(10, highlightedMoments * 3) + (tacticalSignalsCount > 0 ? 10 : 0)
  );
}

function buildRecruitmentSignals({ standoutPlayers, actionCounts, trackedPlayers, verifiedTracks, highlightedMoments }) {
  const signals = [];
  const topPlayer = standoutPlayers[0];
  if (topPlayer) {
    signals.push(
      `${topPlayer.label} led the clip for work rate with ${topPlayer.distanceCovered}m covered, ${topPlayer.sprintCount} sprints, and activity concentrated in ${topPlayer.activationArea}.`
    );
  }
  if (actionCounts.shot) {
    signals.push(`${actionCounts.shot} ${pluralize('shot', actionCounts.shot)} flagged final-third involvement worth a second pass.`);
  }
  if (actionCounts.pass) {
    signals.push(`${actionCounts.pass} ${pluralize('pass', actionCounts.pass)} show repeated involvement in circulation phases.`);
  }
  const defensiveRegains = Number(actionCounts.tackle || 0) + Number(actionCounts.interception || 0);
  if (defensiveRegains > 0) {
    signals.push(`${defensiveRegains} regain actions (${Number(actionCounts.tackle || 0)} tackles, ${Number(actionCounts.interception || 0)} interceptions) suggest defensive engagement.`);
  }
  if (trackedPlayers > 0) {
    signals.push(`${verifiedTracks} of ${trackedPlayers} tracks are verified, lifting trust in the observed profile.`);
  }
  if (highlightedMoments > 0) {
    signals.push(`${highlightedMoments} highlighted moment${highlightedMoments === 1 ? '' : 's'} can be reviewed quickly before a live decision.`);
  }
  return signals.slice(0, 4);
}

function buildDevelopmentAreas({ standoutPlayers, actionCounts, totalActions, highlightedMoments }) {
  const areas = [];
  const topPlayer = standoutPlayers[0];
  if (topPlayer && (topPlayer.distanceCovered >= 1200 || topPlayer.sprintCount >= 3)) {
    areas.push('Repeat sprint output and recovery between high-intensity actions.');
  }
  if (actionCounts.pass) {
    areas.push('Ball circulation involvement under pressure and speed of release.');
  }
  if (actionCounts.shot) {
    areas.push('Final-third end product, shot timing, and decision quality.');
  }
  if (Number(actionCounts.tackle || 0) + Number(actionCounts.interception || 0) > 0) {
    areas.push('Counter-press timing and regain positioning after turnovers.');
  }
  if (areas.length === 0 && (totalActions > 0 || highlightedMoments > 0)) {
    areas.push('Consistency of involvements across the match sample.');
  }
  if (areas.length === 0) {
    areas.push('Broader match samples are needed before locking development priorities.');
  }
  return areas.slice(0, 3);
}

function getPlayerLabel(player, index) {
  if (player?.playerId?.name) return player.playerId.name;
  if (player?.jerseyNumber != null) return `#${player.jerseyNumber}`;
  if (player?.trackId) return `Track ${player.trackId}`;
  return `Track ${index + 1}`;
}

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

function formatTeamColor(teamColor) {
  return teamColor || 'Unidentified unit';
}

module.exports = {
  buildReportInsights,
};
