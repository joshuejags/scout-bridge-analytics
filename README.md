# Scout Bridge Analytics

A comprehensive sports analytics platform built with MERN stack and Computer Vision. Upload match highlights to get detailed player performance data including tracking, action detection, and performance statistics.

## Features

- 📹 **Video Upload**: Upload match highlights in multiple formats (MP4, AVI, MOV, MKV, FLV)
- 👥 **Player Tracking**: Real-time player detection and tracking using YOLO
- ⚽ **Ball Detection**: Automatic ball tracking and possession analysis
- 📊 **Performance Analytics**: Player statistics including distance covered, speed, movements
- 🔥 **Heatmaps**: Visualize player movement patterns and activity areas
- 🎯 **Action Detection**: Identify passes, shots, tackles, and other game actions
- 📈 **Real-time Streaming**: Stream analysis results for live events

## Tech Stack

### Backend
- **Framework**: Express.js (Node.js)
- **Database**: MongoDB
- **File Upload**: Multer
- **Video Processing**: FFmpeg integration ready
- **Computer Vision**: YOLO (YOLOv8), OpenPose

### Frontend
- **Framework**: React 18
- **Router**: React Router v6
- **HTTP Client**: Axios
- **Charting**: Chart.js
- **Styling**: CSS3

### Machine Learning
- **Object Detection**: YOLOv8 (Ultralytics)
- **Pose Estimation**: OpenPose
- **Python**: 3.8+

## Project Structure

```
scout-bridge-analytics/
├── server/                 # Express backend
│   ├── models/            # MongoDB schemas
│   ├── controllers/        # Route controllers
│   ├── routes/            # API routes
│   ├── cv/                # Computer vision modules
│   ├── middleware/        # Express middleware
│   ├── utils/             # Utility functions
│   └── server.js          # Entry point
├── client/                # React frontend
│   ├── public/            # Static files
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Utility functions
│   │   ├── App.jsx
│   │   └── index.jsx
│   └── package.json
├── .env.example           # Environment variables template
├── .gitignore
├── package.json           # Root package config
└── README.md
```

## Installation

### Prerequisites
- Node.js >= 14.0
- npm or yarn
- MongoDB (local or cloud)
- Python 3.8+ (for CV components)

### Setup Steps

1. **Clone and Install Dependencies**
   ```bash
   git clone https://github.com/yourusername/scout-bridge-analytics.git
   cd scout-bridge-analytics
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set Up Python Environment** (for CV components)
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r server/requirements.txt
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

## Running the Application

### Development Mode
```bash
# From root directory - runs both server and client
npm run dev

# Or individually:
npm run server    # Runs Express server on port 5000
npm run client    # Runs React app on port 3000
```

### Production Build
```bash
npm run build
```

## API Endpoints

### Videos
- `GET /api/videos` - Get all videos
- `GET /api/videos/:id` - Get specific video
- `POST /api/videos/upload` - Upload video file
- `DELETE /api/videos/:id` - Delete video

### Analysis
- `GET /api/analysis/:videoId` - Get video analysis
- `POST /api/analysis/:videoId/process` - Start video analysis

## Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/scout-bridge-analytics

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_key_here

# File Upload
MAX_FILE_SIZE=500000000  # 500MB
UPLOAD_DIR=./uploads

# CV/ML
PYTHON_ENV_PATH=./venv
YOLO_MODEL=yolov8n.pt
OPENPOSE_MODEL_PATH=./models/openpose

# Frontend
REACT_APP_API_URL=http://localhost:5000/api
```

## Computer Vision Components

### Player Detection (YOLO)
- Detects players in video frames
- Provides bounding boxes and confidence scores
- Real-time processing capability

### Ball Tracking
- Color-based ball detection
- Possession analysis
- Movement trajectory tracking

### Performance Metrics
- Distance covered calculation
- Speed and acceleration
- Movement patterns and heatmaps
- Action classification

## Development Guidelines

### Backend Development
1. Create new routes in `server/routes/`
2. Implement controllers in `server/controllers/`
3. Define schemas in `server/models/`
4. Use middleware for validation and authentication

### Frontend Development
1. Create components in `client/src/components/`
2. Create pages in `client/src/pages/`
3. Use Axios for API calls
4. Follow React best practices

### CV Module Development
1. Add new CV modules in `server/cv/`
2. Implement detectors inheriting from base classes
3. Add logging for debugging
4. Update video analyzer to use new modules

## Testing

```bash
# Backend tests
npm test --prefix server

# Frontend tests
npm test --prefix client
```

## Deployment

### Docker Support (Coming Soon)
```bash
docker-compose up
```

### Cloud Deployment
- AWS: EC2 + RDS + S3
- Google Cloud: Compute Engine + Cloud SQL + Cloud Storage
- Azure: App Service + Cosmos DB + Blob Storage

## Performance Optimization

- Video streaming with chunking
- Lazy loading for video lists
- Database indexing on frequently queried fields
- Caching analysis results
- GPU acceleration for CV models (CUDA)

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB service
mongod --version

# Use MongoDB Atlas for cloud database
```

### YOLO Model Download
```bash
# Models auto-download on first use
# Or pre-download:
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

### Port Already in Use
```bash
# Change ports in .env
# Or kill process using port:
lsof -ti:5000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :5000   # Windows
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing documentation
- Review code examples in `/examples`

## Roadmap

- [ ] Real-time WebSocket streaming
- [ ] Advanced action recognition
- [ ] Multi-sport support
- [ ] Team analytics dashboard
- [ ] Player comparison tools
- [ ] Cloud storage integration
- [ ] Mobile app
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Advanced ML models (3D pose, tactical analysis)

## Acknowledgments

- YOLO by Ultralytics
- OpenPose community
- MERN Stack resources
