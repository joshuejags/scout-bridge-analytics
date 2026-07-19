const express = require('express');
const analysisController = require('../controllers/analysisController');

const router = express.Router();

router.post('/:videoId/process', analysisController.processAnalysis);
router.get('/:videoId', analysisController.getAnalysisByVideo);

module.exports = router;
