const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');

// The server process always runs with cwd=server/, but the documented
// .env lives at the project root (see README setup steps), so it was
// never actually being loaded by the bare dotenv.config() default.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = require('./app');
const { initSocket } = require('./utils/socket');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scout-bridge-analytics', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// socket.io needs the raw HTTP server (not just the Express app) so it can
// upgrade connections to WebSocket alongside the existing HTTP routes.
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
