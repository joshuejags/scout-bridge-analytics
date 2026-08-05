const { uploadJsonObject } = require('../utils/artifactStore');

describe('artifactStore', () => {
  it('writes a small json artifact and returns store info', async () => {
    const res = await uploadJsonObject('test/artifacts/demo.json', { hello: 'world' });
    expect(res).toBeDefined();
    expect(res.key).toBeDefined();
  });
});
