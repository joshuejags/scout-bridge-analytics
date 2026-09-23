const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

// Tests run against a dedicated database so they never touch real dev/prod
// data. Reuses the same Mongo instance (MONGODB_URI's host) but a distinct
// db name, so no separate test infrastructure (e.g. mongodb-memory-server)
// is required.
const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/scout-bridge-analytics';
process.env.MONGODB_URI = baseUri.replace(/\/[^/?]+(\?|$)/, '/scout-bridge-analytics-test$1');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';

const mongoose = require('mongoose');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Mongoose's automatic index creation can race the first test when the
  // connection is established before all models have registered their
  // indexes. Build the declared indexes explicitly so tests exercise the
  // same uniqueness constraints as the application.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
