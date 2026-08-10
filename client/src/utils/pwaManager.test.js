import { initializePWA } from './pwaManager';

describe('initializePWA', () => {
  it('returns false when service workers are unavailable', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });

    await expect(initializePWA()).resolves.toBe(false);
  });
});
