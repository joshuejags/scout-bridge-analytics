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

// Routes. Body validation for the upload route runs after multer has
// parsed the multipart form, since express-validator can't read
// multipart fields before that.
router.post(
  '/upload',
  upload.single('video'),
  [
    body('team').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid team id'),
    body('opponentTeam')
      .optional({ values: 'falsy' })
      .isMongoId()
      .withMessage('Invalid opponent team id'),
    body('sport')
      .optional({ values: 'falsy' })
      .isIn(['soccer', 'basketball', 'hockey', 'rugby'])
      .withMessage('Invalid sport'),
  ],
  validate,
  videoController.uploadVideo
);
router.get('/', videoController.getVideos);
router.get('/:id', [idParam], validate, videoController.getVideoById);
router.delete('/:id', requireRole('admin'), [idParam], validate, videoController.deleteVideo);

module.exports = router;
