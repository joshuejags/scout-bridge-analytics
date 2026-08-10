const {
  detectShot,
  detectPass,
  detectTackle,
  detectInterception,
  calculateDetectionQuality,
} = require('../eventDetector');

describe('Event Detection Module', () => {
  const mockPlayerData = {
    id: 'player1',
    position: { x: 0.8, y: 0.5 },
    pose: {
      keypoints: [
        { x: 0.8, y: 0.45 },
        { x: 0.8, y: 0.5 },
        { x: 0.8, y: 0.55 },
        { x: 0.75, y: 0.48 },
        { x: 0.85, y: 0.48 },
        { x: 0.75, y: 0.52 },
        { x: 0.85, y: 0.52 },
      ],
    },
  };

  const mockBallData = {
    position: { x: 0.78, y: 0.5 },
  };

  const mockOpponentData = {
    id: 'opponent1',
    position: { x: 0.82, y: 0.51 },
    pose: {
      keypoints: [
        { x: 0.82, y: 0.45 },
        { x: 0.82, y: 0.5 },
        { x: 0.82, y: 0.55 },
        { x: 0.77, y: 0.48 },
        { x: 0.87, y: 0.48 },
        { x: 0.77, y: 0.52 },
        { x: 0.87, y: 0.52 },
      ],
    },
  };

  describe('Shot Detection', () => {
    it('should detect shots when near goal', () => {
      const result = detectShot(mockPlayerData, mockBallData);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.details).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });

    it('should have low confidence when far from goal', () => {
      const farPlayerData = {
        ...mockPlayerData,
        position: { x: 0.2, y: 0.5 },
      };
      const result = detectShot(farPlayerData, mockBallData);
      expect(result.confidence).toBeLessThan(0.3);
    });

    it('should handle missing position data', () => {
      const result = detectShot({}, mockBallData);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Incomplete');
    });

    it('should use recent frames for velocity calculation', () => {
      const frames = [
        { ball: { position: { x: 0.75, y: 0.5 } } },
        { ball: { position: { x: 0.76, y: 0.5 } } },
        { ball: { position: { x: 0.78, y: 0.5 } } },
      ];
      const result = detectShot(mockPlayerData, mockBallData, frames);
      expect(result.details.velocityFactor).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pass Detection', () => {
    it('should detect passes with moderate ball velocity', () => {
      const frames = [
        { ball: { position: { x: 0.7, y: 0.5 } } },
        { ball: { position: { x: 0.72, y: 0.5 } } },
        { ball: { position: { x: 0.74, y: 0.5 } } },
      ];
      const teamPlayers = [
        { id: 'player2', position: { x: 0.85, y: 0.4 } },
        { id: 'player3', position: { x: 0.75, y: 0.6 } },
      ];
      const result = detectPass(mockPlayerData, mockBallData, teamPlayers, frames);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should have higher confidence with nearby receivers', () => {
      const teamPlayers = [
        { id: 'player2', position: { x: 0.78, y: 0.48 } },
      ];
      const result = detectPass(mockPlayerData, mockBallData, teamPlayers);
      expect(result.details.receiverProximityFactor).toBeGreaterThan(0);
    });

    it('should handle empty team players array', () => {
      const result = detectPass(mockPlayerData, mockBallData, []);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.details.receiverProximityFactor).toBe(0);
    });
  });

  describe('Tackle Detection', () => {
    it('should detect tackles with close proximity', () => {
      const result = detectTackle(mockPlayerData, mockOpponentData, mockBallData);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.details.proximityFactor).toBeGreaterThan(0);
    });

    it('should require ball involvement', () => {
      const farBallData = { position: { x: 0.3, y: 0.5 } };
      const result = detectTackle(mockPlayerData, mockOpponentData, farBallData);
      expect(result.details.ballInvolvementFactor).toBe(0);
    });

    it('should handle missing opponent data', () => {
      const result = detectTackle(mockPlayerData, {}, mockBallData);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Incomplete');
    });

    it('should detect body contact from pose data', () => {
      const result = detectTackle(mockPlayerData, mockOpponentData, mockBallData);
      expect(result.details.bodyContactFactor).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Interception Detection', () => {
    it('should detect interceptions with good positioning', () => {
      const opponentData = {
        id: 'opponent1',
        position: { x: 0.9, y: 0.5 },
      };
      const result = detectInterception(mockPlayerData, mockBallData, opponentData);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should favor player closer to ball', () => {
      const closerPlayerData = {
        ...mockPlayerData,
        position: { x: 0.77, y: 0.5 },
      };
      const opponentData = { position: { x: 0.6, y: 0.5 } };
      const result = detectInterception(closerPlayerData, mockBallData, opponentData);
      expect(result.details.timingFactor).toBeGreaterThan(0);
    });

    it('should handle null opponent data', () => {
      const result = detectInterception(mockPlayerData, mockBallData, null);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Detection Quality Metrics', () => {
    it('should calculate quality for multiple actions', () => {
      const actions = [
        { type: 'pass', confidence: 0.85 },
        { type: 'shot', confidence: 0.72 },
        { type: 'tackle', confidence: 0.91 },
      ];
      const metrics = calculateDetectionQuality(actions, [mockPlayerData], { trackingData: Array(100).fill({}) });
      
      expect(metrics.totalActionsDetected).toBe(3);
      expect(metrics.averageActionConfidence).toBeGreaterThan(0);
      expect(metrics.qualityScore).toBeGreaterThan(0);
      expect(metrics.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should return zero quality for no actions', () => {
      const metrics = calculateDetectionQuality([], [], { trackingData: [] });
      expect(metrics.qualityScore).toBe(0);
    });

    it('should calculate detection density correctly', () => {
      const actions = Array(10).fill({ confidence: 0.8 });
      const playerData = Array(5).fill(mockPlayerData);
      const ballData = { trackingData: Array(20).fill({}) };
      
      const metrics = calculateDetectionQuality(actions, playerData, ballData);
      expect(metrics.detectionDensity).toBe(10 / (5 * 20)); // actions / (players * frames)
    });

    it('should measure detection coverage correctly', () => {
      const actions = [
        { confidence: 0.8 },
        { confidence: 0.5 },
        { confidence: 0.9 },
        { confidence: 0.3 },
      ];
      const metrics = calculateDetectionQuality(actions, [], {});
      
      // 2 out of 4 actions have confidence > 0.6
      expect(metrics.detectionCoverage).toBe(0.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle NaN in position calculations', () => {
      const badData = { position: { x: NaN, y: NaN } };
      const result = detectShot(badData, mockBallData);
      expect(result.confidence).toBe(0);
    });

    it('should cap confidence at 1.0', () => {
      // Try to create a scenario where confidence might exceed 1
      const frames = [
        { ball: { position: { x: 0.7, y: 0.5 } } },
        { ball: { position: { x: 0.8, y: 0.5 } } },
        { ball: { position: { x: 0.9, y: 0.5 } } },
      ];
      const result = detectShot(mockPlayerData, mockBallData, frames);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty frame arrays', () => {
      const result = detectPass(mockPlayerData, mockBallData, [], []);
      expect(result.confidence).toBeDefined();
    });
  });

  describe('Confidence Distribution', () => {
    it('should distribute confidence across multiple factors', () => {
      const result = detectShot(mockPlayerData, mockBallData);
      const detailsSum = Object.values(result.details).reduce((a, b) => a + b, 0);
      expect(detailsSum).toBeLessThanOrEqual(result.confidence + 0.01); // Allow small floating-point variance
    });

    it('should have reasoning matching detection type', () => {
      const shotResult = detectShot(mockPlayerData, mockBallData);
      expect(shotResult.reasoning).toContain('Shot');
      
      const passResult = detectPass(mockPlayerData, mockBallData);
      expect(passResult.reasoning).toContain('Pass');
      
      const tackleResult = detectTackle(mockPlayerData, mockOpponentData, mockBallData);
      expect(tackleResult.reasoning).toContain('Tackle');
    });
  });
});
