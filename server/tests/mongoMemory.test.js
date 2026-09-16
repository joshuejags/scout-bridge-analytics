jest.mock('mongodb-memory-server', () => ({
  MongoMemoryServer: {
    create: jest.fn(),
  },
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectMongo, stopMongoMemoryServer } = require('../utils/mongoMemory');

describe('mongoMemory', () => {
  const originalMongoUri = process.env.MONGODB_URI;
  const originalDisable = process.env.DISABLE_MONGO_MEMORY_SERVER;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MONGODB_URI;
    delete process.env.DISABLE_MONGO_MEMORY_SERVER;
    jest.spyOn(mongoose, 'connect');
  });

  afterEach(() => {
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = originalMongoUri;
    if (originalDisable === undefined) delete process.env.DISABLE_MONGO_MEMORY_SERVER; else process.env.DISABLE_MONGO_MEMORY_SERVER = originalDisable;
    jest.restoreAllMocks();
    return stopMongoMemoryServer();
  });

  it('falls back to an in-memory MongoDB instance when no configured database is reachable', async () => {
    const created = {
      getUri: jest.fn(() => 'mongodb://memory/test'),
      stop: jest.fn().mockResolvedValue(undefined),
    };
    MongoMemoryServer.create.mockResolvedValue(created);
    mongoose.connect
      .mockRejectedValueOnce(new Error('could not connect'))
      .mockResolvedValueOnce(undefined);

    const result = await connectMongo(mongoose);

    expect(MongoMemoryServer.create).toHaveBeenCalledTimes(1);
    expect(mongoose.connect).toHaveBeenNthCalledWith(
      1,
      'mongodb://localhost:27017/scout-bridge-analytics',
      expect.objectContaining({ useNewUrlParser: true, useUnifiedTopology: true })
    );
    expect(mongoose.connect).toHaveBeenNthCalledWith(
      2,
      'mongodb://memory/test',
      expect.objectContaining({ useNewUrlParser: true, useUnifiedTopology: true })
    );
    expect(result.uri).toBe('mongodb://memory/test');
  });
});
