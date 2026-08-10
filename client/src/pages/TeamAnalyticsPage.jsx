import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import PerformanceTrends from '../components/PerformanceTrends';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { apiUrl } from '../utils/api';
import './TeamAnalyticsPage.css';

const TeamAnalyticsPage = () => {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeamAnalytics = async () => {
      try {
        const teamResponse = await axios.get(apiUrl(`/teams/${teamId}`));
        setTeam(teamResponse.data);

        const analysisResponse = await axios.get(apiUrl('/analysis'));
        const teamAnalyses = analysisResponse.data.filter(
          (a) => a.video?.team === teamId || a.video?.team?._id === teamId
        );
        setAnalyses(teamAnalyses);
      } catch (err) {
        setError('Unable to load team analytics.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (teamId) {
      fetchTeamAnalytics();
    }
  }, [teamId]);

  const teamMetrics = useMemo(() => {
    if (analyses.length === 0) {
      return {
        matchesAnalyzed: 0,
        totalPlayers: 0,
        avgPossession: 0,
        avgDistance: 0,
        avgSprints: 0,
        avgTackles: 0,
        formations: [],
        playerPerformance: [],
      };
    }

    const allPlayers = new Map();
    let totalPossession = 0;
    let totalDistance = 0;
    let totalSprints = 0;
    let totalTackles = 0;
    const formations = [];

    analyses.forEach((analysis) => {
      if (analysis.playerData) {
        analysis.playerData.forEach((player) => {
          const playerId = player.playerId?._id || player.trackId;
          if (playerId) {
            if (!allPlayers.has(playerId)) {
              allPlayers.set(playerId, {
                id: playerId,
                name: player.playerId?.name || `Player ${player.jerseyNumber || '?'}`,
                jerseyNumber: player.jerseyNumber,
                appearances: 0,
                totalDistance: 0,
                totalSprints: 0,
                avgSpeed: [],
              });
            }

            const playerStats = allPlayers.get(playerId);
            playerStats.appearances += 1;
            playerStats.totalDistance += player.statistics?.distanceCovered || 0;
            playerStats.totalSprints += player.statistics?.sprintCount || 0;
            if (player.statistics?.averageSpeed) {
              playerStats.avgSpeed.push(player.statistics.averageSpeed);
            }
          }
        });

        totalDistance += analysis.playerData.reduce(
          (sum, p) => sum + (p.statistics?.distanceCovered || 0),
          0
        );
        totalSprints += analysis.playerData.reduce(
          (sum, p) => sum + (p.statistics?.sprintCount || 0),
          0
        );

        if (analysis.tacticalData?.teams) {
          analysis.tacticalData.teams.forEach((t) => {
            formations.push({
              match: analysis.video?.fileName || 'Unknown',
              formation: t.formation?.lineup?.join('-') || 'Unknown',
              compactness: t.shape?.compactness || 0,
            });
          });
        }

        const ballPossession = analysis.ballPossession || [];
        const teamPossessionTime = ballPossession.reduce((sum, bp) => sum + (bp.duration || 0), 0);
        totalPossession += teamPossessionTime;
      }

      if (analysis.actions) {
        totalTackles += analysis.actions.filter((a) => a.type === 'tackle').length;
      }
    });

    const playerArray = Array.from(allPlayers.values()).map((p) => ({
      ...p,
      avgSpeedValue: p.avgSpeed.length > 0 ? Math.round(p.avgSpeed.reduce((a, b) => a + b, 0) / p.avgSpeed.length) : 0,
      distancePerAppearance: Math.round(p.totalDistance / p.appearances),
    }));

    return {
      matchesAnalyzed: analyses.length,
      totalPlayers: allPlayers.size,
      avgPossession: Math.round(totalPossession / analyses.length),
      avgDistance: Math.round(totalDistance / analyses.length),
      avgSprints: Math.round(totalSprints / analyses.length),
      avgTackles: Math.round(totalTackles / analyses.length),
      formations,
      playerPerformance: playerArray.sort((a, b) => b.totalDistance - a.totalDistance).slice(0, 10),
    };
  }, [analyses]);

  const performanceTrendData = useMemo(() => {
    return analyses.slice(0, 20).map((analysis, idx) => {
      const playerDistance = analysis.playerData?.reduce(
        (sum, p) => sum + (p.statistics?.distanceCovered || 0),
        0
      ) || 0;
      const avgDistance = analysis.playerData?.length ? Math.round(playerDistance / analysis.playerData.length) : 0;
      return {
        label: `M${idx + 1}`,
        value: avgDistance,
      };
    });
  }, [analyses]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!team) {
    return (
      <div className="page-shell">
        <Toast type="error" message={error || 'Team not found'} onClose={() => {}} />
      </div>
    );
  }

  return (
    <div className="page-shell team-analytics-page">
      <div className="page-header">
        <Link to="/teams" className="back-button">
          ← Back to teams
        </Link>
        <div className="page-heading">
          <div className="page-kicker">{team.league || 'Team analytics'}</div>
          <h1 className="page-title">{team.name}</h1>
          <p className="page-lead">Squad-wide performance metrics and tactical analysis across analyzed matches.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-card__label">Matches analyzed</p>
          <p className="kpi-card__value">{teamMetrics.matchesAnalyzed}</p>
          <p className="kpi-card__meta">Video clips in system</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Unique players</p>
          <p className="kpi-card__value">{teamMetrics.totalPlayers}</p>
          <p className="kpi-card__meta">Squad members tracked</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Avg distance/player</p>
          <p className="kpi-card__value">{teamMetrics.avgDistance}</p>
          <p className="kpi-card__meta">Meters per match</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Avg sprints</p>
          <p className="kpi-card__value">{teamMetrics.avgSprints}</p>
          <p className="kpi-card__meta">High-intensity efforts</p>
        </div>
      </div>

      {analyses.length > 0 && (
        <>
          <section className="surface-card analysis-panel">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Performance trend</h2>
                <p className="card-subtitle">Average player distance covered across recent matches.</p>
              </div>
            </div>
            <PerformanceTrends data={performanceTrendData} metric="distance" unit="m" />
          </section>

          <div className="team-analytics-grid">
            <section className="surface-card analysis-panel">
              <div className="card-title-row">
                <div>
                  <h2 className="card-title">Top performers</h2>
                  <p className="card-subtitle">Squad members by total distance covered.</p>
                </div>
              </div>
              {teamMetrics.playerPerformance.length > 0 ? (
                <div className="player-performance-list">
                  {teamMetrics.playerPerformance.map((player, idx) => (
                    <div key={player.id} className="player-performance-row">
                      <div className="player-rank">{idx + 1}</div>
                      <div className="player-info">
                        <p className="player-name">
                          {player.name}
                          {player.jerseyNumber && <span className="jersey-badge">#{player.jerseyNumber}</span>}
                        </p>
                        <p className="player-meta">{player.appearances} appearances</p>
                      </div>
                      <div className="player-stats">
                        <span className="stat-item">
                          <span className="stat-label">Distance</span>
                          <span className="stat-value">{Math.round(player.totalDistance)} m</span>
                        </span>
                        <span className="stat-item">
                          <span className="stat-label">Avg speed</span>
                          <span className="stat-value">{player.avgSpeedValue} km/h</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No player data available.</p>
              )}
            </section>

            <section className="surface-card analysis-panel">
              <div className="card-title-row">
                <div>
                  <h2 className="card-title">Formation history</h2>
                  <p className="card-subtitle">Team shape evolution across matches.</p>
                </div>
              </div>
              {teamMetrics.formations.length > 0 ? (
                <div className="formation-list">
                  {teamMetrics.formations.map((f, idx) => (
                    <div key={idx} className="formation-row">
                      <div className="formation-info">
                        <p className="formation-match">{f.match}</p>
                        <p className="formation-shape">{f.formation}</p>
                      </div>
                      <div className="formation-compactness">
                        <span className="compactness-label">Compactness</span>
                        <span className="compactness-value">{Math.round(f.compactness)} m</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No formation data available.</p>
              )}
            </section>
          </div>
        </>
      )}

      {analyses.length === 0 && (
        <div className="surface-card analysis-panel empty-analytics">
          <p>No match analysis data available for this team yet.</p>
          <p className="empty-meta">Upload and analyze matches involving this team to see analytics.</p>
        </div>
      )}
    </div>
  );
};

export default TeamAnalyticsPage;
