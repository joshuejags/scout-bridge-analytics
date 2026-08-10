/**
 * Enhanced Event Detection Module
 * Improves accuracy of shot, pass, tackle, and interception detection
 * with confidence scoring and detection quality metrics
 */

/**
 * Calculate shot detection confidence based on multiple heuristics
 * @param {Object} playerData - Current player position and velocity
 * @param {Object} ballData - Ball position and movement
 * @param {Array} recentFrames - Last N frames for trend analysis
 * @returns {Object} { confidence, details, reasoning }
 */
export const detectShot = (playerData, ballData, recentFrames = []) => {
  let confidence = 0;
  const details = {
    distanceFromGoal: 0,
    velocityFactor: 0,
    trajectoryFactor: 0,
    bodyPositionFactor: 0,
  };

  try {
    if (!playerData?.position || !ballData?.position) return { confidence: 0, details, reasoning: 'Incomplete positional data' };

    // 1. Distance from goal (closer = higher shot probability)
    const distanceFromGoal = Math.abs(playerData.position.x - 0.95); // Assuming goal at x=0.95 (normalized)
    if (distanceFromGoal < 0.3) {
      details.distanceFromGoal = Math.max(0, 1 - distanceFromGoal / 0.3) * 0.3;
      confidence += details.distanceFromGoal;
    }

    // 2. Ball velocity (faster = higher shot probability)
    if (recentFrames.length > 1) {
      const prevBall = recentFrames[recentFrames.length - 2]?.ball;
      const currBall = recentFrames[recentFrames.length - 1]?.ball;
      if (prevBall && currBall) {
        const ballVelocity = Math.sqrt(
          Math.pow(currBall.position.x - prevBall.position.x, 2) +
          Math.pow(currBall.position.y - prevBall.position.y, 2)
        );
        if (ballVelocity > 0.02) {
          // High velocity threshold
          details.velocityFactor = Math.min(ballVelocity / 0.05, 1) * 0.35;
          confidence += details.velocityFactor;
        }
      }
    }

    // 3. Player-ball proximity (close = higher shot probability)
    const playerBallDistance = Math.sqrt(
      Math.pow(playerData.position.x - ballData.position.x, 2) +
      Math.pow(playerData.position.y - ballData.position.y, 2)
    );
    if (playerBallDistance < 0.15) {
      details.trajectoryFactor = Math.max(0, 1 - playerBallDistance / 0.15) * 0.2;
      confidence += details.trajectoryFactor;
    }

    // 4. Body orientation towards goal (if pose available)
    if (playerData.pose?.keypoints) {
      const shoulderDirection = estimateBodyDirection(playerData.pose);
      const goalDirection = 1; // Normalized goal direction
      const orientationScore = Math.abs(shoulderDirection - goalDirection) < 0.5 ? 0.15 : 0;
      details.bodyPositionFactor = orientationScore;
      confidence += orientationScore;
    }

    return {
      confidence: Math.min(confidence, 1),
      details,
      reasoning: `Shot detected: distance=${(distanceFromGoal * 100).toFixed(1)}%, velocity=${(details.velocityFactor * 100).toFixed(1)}%, proximity=${(details.trajectoryFactor * 100).toFixed(1)}%`,
    };
  } catch (error) {
    return { confidence: 0, details, reasoning: `Error in shot detection: ${error.message}` };
  }
};

/**
 * Calculate pass detection confidence
 * @param {Object} playerData - Current player position
 * @param {Object} ballData - Ball position and movement
 * @param {Array} teamPlayers - Other players on same team
 * @param {Array} recentFrames - Last N frames for trend analysis
 * @returns {Object} { confidence, details, reasoning }
 */
export const detectPass = (playerData, ballData, teamPlayers = [], recentFrames = []) => {
  let confidence = 0;
  const details = {
    ballVelocityFactor: 0,
    receiverProximityFactor: 0,
    trajectoryFactor: 0,
    supportingPositionFactor: 0,
  };

  try {
    if (!playerData?.position || !ballData?.position) return { confidence: 0, details, reasoning: 'Incomplete positional data' };

    // 1. Ball velocity (moderate velocity = pass, not dribble)
    if (recentFrames.length > 1) {
      const ballVelocity = calculateVelocity(recentFrames, 'ball');
      if (ballVelocity > 0.005 && ballVelocity < 0.04) {
        // Moderate velocity range for passes
        details.ballVelocityFactor = 0.25;
        confidence += details.ballVelocityFactor;
      }
    }

    // 2. Receiver proximity (teammate near ball trajectory)
    if (teamPlayers.length > 0) {
      const nearestReceiver = findNearestTeammate(ballData.position, teamPlayers);
      if (nearestReceiver && nearestReceiver.distance < 0.25) {
        details.receiverProximityFactor = Math.max(0, 1 - nearestReceiver.distance / 0.25) * 0.3;
        confidence += details.receiverProximityFactor;
      }
    }

    // 3. Ball trajectory from passer (should move away from passer)
    if (recentFrames.length > 1) {
      const trajectoryScore = calculateTrajectoryAwayFromPlayer(recentFrames, playerData.position, 'ball');
      if (trajectoryScore > 0.5) {
        details.trajectoryFactor = trajectoryScore * 0.25;
        confidence += details.trajectoryFactor;
      }
    }

    // 4. Player positioning (supporting position relative to team)
    const isInSupportingPosition = checkSupportingPosition(playerData.position, teamPlayers);
    if (isInSupportingPosition) {
      details.supportingPositionFactor = 0.2;
      confidence += details.supportingPositionFactor;
    }

    return {
      confidence: Math.min(confidence, 1),
      details,
      reasoning: `Pass detected: velocity=${(details.ballVelocityFactor * 100).toFixed(1)}%, receiver=${(details.receiverProximityFactor * 100).toFixed(1)}%, trajectory=${(details.trajectoryFactor * 100).toFixed(1)}%`,
    };
  } catch (error) {
    return { confidence: 0, details, reasoning: `Error in pass detection: ${error.message}` };
  }
};

/**
 * Calculate tackle detection confidence
 * @param {Object} playerData - Current player position and pose
 * @param {Object} opponentData - Opponent player position and pose
 * @param {Object} ballData - Ball position
 * @param {Array} recentFrames - Last N frames for trend analysis
 * @returns {Object} { confidence, details, reasoning }
 */
export const detectTackle = (playerData, opponentData, ballData, recentFrames = []) => {
  let confidence = 0;
  const details = {
    proximityFactor: 0,
    bodyContactFactor: 0,
    ballInvolvementFactor: 0,
    movementFactor: 0,
  };

  try {
    if (!playerData?.position || !opponentData?.position || !ballData?.position) {
      return { confidence: 0, details, reasoning: 'Incomplete positional data' };
    }

    // 1. Player-opponent proximity (very close = likely tackle)
    const playerOpponentDistance = Math.sqrt(
      Math.pow(playerData.position.x - opponentData.position.x, 2) +
      Math.pow(playerData.position.y - opponentData.position.y, 2)
    );
    if (playerOpponentDistance < 0.2) {
      details.proximityFactor = Math.max(0, 1 - playerOpponentDistance / 0.2) * 0.25;
      confidence += details.proximityFactor;
    }

    // 2. Body contact detection (from pose analysis)
    if (playerData.pose?.keypoints && opponentData.pose?.keypoints) {
      const contactScore = detectBodyContact(playerData.pose, opponentData.pose);
      details.bodyContactFactor = contactScore * 0.3;
      confidence += details.bodyContactFactor;
    }

    // 3. Ball proximity to both players (tackle involves ball)
    const playerBallDist = Math.sqrt(
      Math.pow(playerData.position.x - ballData.position.x, 2) +
      Math.pow(playerData.position.y - ballData.position.y, 2)
    );
    const opponentBallDist = Math.sqrt(
      Math.pow(opponentData.position.x - ballData.position.x, 2) +
      Math.pow(opponentData.position.y - ballData.position.y, 2)
    );
    if (playerBallDist < 0.15 && opponentBallDist < 0.15) {
      details.ballInvolvementFactor = 0.25;
      confidence += details.ballInvolvementFactor;
    }

    // 4. Aggressive movement towards opponent
    if (recentFrames.length > 2) {
      const playerVelocity = calculateVelocity(recentFrames, 'player', playerData.id);
      if (playerVelocity > 0.02) {
        details.movementFactor = 0.2;
        confidence += details.movementFactor;
      }
    }

    return {
      confidence: Math.min(confidence, 1),
      details,
      reasoning: `Tackle detected: proximity=${(details.proximityFactor * 100).toFixed(1)}%, contact=${(details.bodyContactFactor * 100).toFixed(1)}%, ball=${(details.ballInvolvementFactor * 100).toFixed(1)}%`,
    };
  } catch (error) {
    return { confidence: 0, details, reasoning: `Error in tackle detection: ${error.message}` };
  }
};

/**
 * Calculate interception detection confidence
 * @param {Object} playerData - Current player position
 * @param {Object} ballData - Ball position and movement
 * @param {Object} opponentData - Opponent with ball
 * @param {Array} recentFrames - Last N frames for trend analysis
 * @returns {Object} { confidence, details, reasoning }
 */
export const detectInterception = (playerData, ballData, opponentData, recentFrames = []) => {
  let confidence = 0;
  const details = {
    positioningFactor: 0,
    timingFactor: 0,
    ballVelocityFactor: 0,
    reactionSpeedFactor: 0,
  };

  try {
    if (!playerData?.position || !ballData?.position) {
      return { confidence: 0, details, reasoning: 'Incomplete positional data' };
    }

    // 1. Player positioned between ball and opponent
    const isInterceptingPosition = checkInterceptingPosition(playerData.position, ballData.position, opponentData?.position);
    if (isInterceptingPosition) {
      details.positioningFactor = 0.3;
      confidence += details.positioningFactor;
    }

    // 2. Timing: player reaches ball before opponent
    if (opponentData?.position) {
      const playerBallDist = distance(playerData.position, ballData.position);
      const opponentBallDist = distance(opponentData.position, ballData.position);
      if (playerBallDist < opponentBallDist) {
        details.timingFactor = Math.min((opponentBallDist - playerBallDist) / 0.2, 1) * 0.3;
        confidence += details.timingFactor;
      }
    }

    // 3. Ball moving quickly (pass being intercepted)
    if (recentFrames.length > 1) {
      const ballVelocity = calculateVelocity(recentFrames, 'ball');
      if (ballVelocity > 0.01) {
        details.ballVelocityFactor = Math.min(ballVelocity / 0.04, 1) * 0.2;
        confidence += details.ballVelocityFactor;
      }
    }

    // 4. Player reaction speed (quick directional change towards ball)
    if (recentFrames.length > 2) {
      const playerReactionScore = calculateReactionSpeed(recentFrames, playerData.id);
      details.reactionSpeedFactor = playerReactionScore * 0.2;
      confidence += details.reactionSpeedFactor;
    }

    return {
      confidence: Math.min(confidence, 1),
      details,
      reasoning: `Interception detected: position=${(details.positioningFactor * 100).toFixed(1)}%, timing=${(details.timingFactor * 100).toFixed(1)}%, ball=${(details.ballVelocityFactor * 100).toFixed(1)}%`,
    };
  } catch (error) {
    return { confidence: 0, details, reasoning: `Error in interception detection: ${error.message}` };
  }
};

/**
 * Calculate detection quality metrics for an analysis
 * @param {Array} actions - Detected actions
 * @param {Array} playerData - Player tracking data
 * @param {Object} ballData - Ball tracking data
 * @returns {Object} Quality metrics
 */
export const calculateDetectionQuality = (actions, playerData, ballData) => {
  const metrics = {
    totalActionsDetected: actions.length,
    averageActionConfidence: 0,
    detectionCoverage: 0,
    qualityScore: 0,
    detectionDensity: 0,
  };

  if (!actions || actions.length === 0) {
    metrics.qualityScore = 0;
    return metrics;
  }

  // Average confidence across all actions
  const confidences = actions.map(a => a.confidence || 0);
  metrics.averageActionConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  // Detection density (actions per player per frame)
  if (playerData && playerData.length > 0 && ballData?.trackingData) {
    const totalFrames = ballData.trackingData.length || 1;
    metrics.detectionDensity = actions.length / (playerData.length * totalFrames);
  }

  // Detection coverage (fraction of actions with high confidence)
  const highConfidenceCount = confidences.filter(c => c > 0.6).length;
  metrics.detectionCoverage = highConfidenceCount / confidences.length;

  // Overall quality score (0-100)
  metrics.qualityScore = (
    metrics.averageActionConfidence * 50 +
    metrics.detectionCoverage * 50
  ) * 100;

  return metrics;
};

// ============== Helper Functions ==============

const distance = (p1, p2) => {
  if (!p1 || !p2) return Infinity;
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const calculateVelocity = (frames, objectType, playerId = null) => {
  if (frames.length < 2) return 0;
  const curr = frames[frames.length - 1];
  const prev = frames[frames.length - 2];
  
  let pos1, pos2;
  if (objectType === 'ball') {
    pos1 = prev.ball?.position;
    pos2 = curr.ball?.position;
  } else if (objectType === 'player') {
    pos1 = prev.players?.find(p => p.id === playerId)?.position;
    pos2 = curr.players?.find(p => p.id === playerId)?.position;
  }

  return pos1 && pos2 ? distance(pos1, pos2) : 0;
};

const findNearestTeammate = (ballPosition, teamPlayers) => {
  let nearest = null;
  let minDistance = Infinity;

  teamPlayers.forEach(player => {
    const dist = distance(ballPosition, player.position);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = { ...player, distance: dist };
    }
  });

  return nearest;
};

const estimateBodyDirection = (pose) => {
  if (!pose?.keypoints || pose.keypoints.length < 6) return 0;
  // Simple heuristic: compare shoulder positions to estimate facing direction
  const leftShoulder = pose.keypoints[5];
  const rightShoulder = pose.keypoints[6];
  if (!leftShoulder || !rightShoulder) return 0;
  return rightShoulder.x > leftShoulder.x ? 1 : -1;
};

const calculateTrajectoryAwayFromPlayer = (frames, playerPos, objectType) => {
  if (frames.length < 2) return 0;
  
  const positions = frames.map(f => 
    objectType === 'ball' ? f.ball?.position : f.players?.[0]?.position
  ).filter(p => p);

  if (positions.length < 2) return 0;

  const prev = positions[positions.length - 2];
  const curr = positions[positions.length - 1];

  const distToPrev = distance(playerPos, prev);
  const distToCurr = distance(playerPos, curr);

  return Math.max(0, Math.min(1, (distToCurr - distToPrev) / 0.1));
};

const checkSupportingPosition = (playerPos, teamPlayers) => {
  if (!teamPlayers || teamPlayers.length === 0) return false;
  // Player is in supporting position if within 0.4 of nearest teammate
  const nearest = findNearestTeammate(playerPos, teamPlayers);
  return nearest && nearest.distance < 0.4;
};

const detectBodyContact = (pose1, pose2) => {
  if (!pose1?.keypoints || !pose2?.keypoints) return 0;
  // Simple contact detection: check if keypoints overlap
  let contactPoints = 0;
  pose1.keypoints.forEach((kp1, idx) => {
    const kp2 = pose2.keypoints[idx];
    if (kp1 && kp2 && distance(kp1, kp2) < 0.15) {
      contactPoints++;
    }
  });
  return contactPoints / pose1.keypoints.length;
};

const checkInterceptingPosition = (playerPos, ballPos, opponentPos) => {
  if (!opponentPos) return distance(playerPos, ballPos) < 0.15;
  
  // Player is intercepting if between opponent and ball
  const playerToBall = distance(playerPos, ballPos);
  const opponentToBall = distance(opponentPos, ballPos);
  const playerToOpponent = distance(playerPos, opponentPos);

  return playerToBall < opponentToBall && playerToOpponent < 0.3;
};

const calculateReactionSpeed = (frames, playerId) => {
  if (frames.length < 3) return 0;

  const positions = frames
    .map(f => f.players?.find(p => p.id === playerId)?.position)
    .filter(p => p);

  if (positions.length < 3) return 0;

  const vel1 = distance(positions[positions.length - 3], positions[positions.length - 2]);
  const vel2 = distance(positions[positions.length - 2], positions[positions.length - 1]);

  return Math.min(1, vel2 / (vel1 + 0.001)); // Acceleration ratio
};
