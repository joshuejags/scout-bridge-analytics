const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryServer = null;

async function connectMongo(mongoose, options = {}) {
  const uriFromEnv = process.env.MONGODB_URI || 'mongodb://localhost:27017/scout-bridge-analytics';
  const mongoOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ...(options.mongoose || {}),
  };

  try {
    await mongoose.connect(uriFromEnv, mongoOptions);
    console.log('[mongo] Connected to configured MongoDB instance.');
    return { uri: uriFromEnv, memoryServer: null };
  } catch (err) {
    if (process.env.MONGODB_URI || process.env.DISABLE_MONGO_MEMORY_SERVER === 'true') {
      throw err;
    }

    console.warn('[mongo] MongoDB is unavailable; starting in-memory MongoDB fallback for local development.');
    memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri, mongoOptions);
    console.log(`[mongo] Connected to in-memory MongoDB at ${memoryUri}`);
    return { uri: memoryUri, memoryServer };
  }
}

async function stopMongoMemoryServer() {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = {
  connectMongo,
  stopMongoMemoryServer,
};
