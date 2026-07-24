const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, param } = require('express-validator');
const videoController = require('../controllers/videoController');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: process.env.MAX_FILE_SIZE || 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|mkv|flv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

const idParam = param('id').isMongoId().withMessage('Invalid video id');
const uploadMetaValidators = [
  body('team').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid team id'),
  body('opponentTeam')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Invalid opponent team id'),
  body('sport')
    .optional({ values: 'falsy' })
    .isIn(['soccer', 'basketball', 'hockey', 'rugby'])
    .withMessage('Invalid sport'),
];

// Routes. Body validation for the upload route runs after multer has
// parsed the multipart form, since express-validator can't read
// multipart fields before that.
router.post(
  '/upload',
  upload.single('video'),
  uploadMetaValidators,
  validate,
  videoController.uploadVideo
);

// Chunked upload: for files large enough that one long-lived multipart
// POST is a reliability risk (network drop = start over, and some
// reverse proxies/load balancers time out long-idle requests outright).
// init declares the file and its metadata up front; chunk is called
// repeatedly with raw binary bodies; complete assembles the result once
// every declared byte has arrived. See server/utils/chunkedUploads.js.
router.post(
  '/upload/init',
  [body('originalName').trim().notEmpty().withMessage('originalName is required'), ...uploadMetaValidators],
  validate,
  videoController.initChunkedUpload
);
router.post(
  '/upload/:uploadId/chunk',
  express.raw({ type: '*/*', limit: '10mb' }),
  videoController.uploadChunk
);
router.get('/upload/:uploadId/status', videoController.getChunkedUploadStatus);
router.post('/upload/:uploadId/complete', videoController.completeChunkedUpload);

router.get('/', videoController.getVideos);
router.get('/:id', [idParam], validate, videoController.getVideoById);
router.delete('/:id', requireRole('admin'), [idParam], validate, videoController.deleteVideo);

module.exports = router;
