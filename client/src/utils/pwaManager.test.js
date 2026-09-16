import fs from 'fs';
import path from 'path';
import { initializePWA, shouldBypassServiceWorker } from './pwaManager';

describe('initializePWA', () => {
  it('returns false when service workers are unavailable', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });

    await expect(initializePWA()).resolves.toBe(false);
  });

  it('bypasses service worker interception for backend API requests on other origins', () => {
    expect(shouldBypassServiceWorker('http://localhost:5000/api/analysis/abc/process')).toBe(true);
    expect(shouldBypassServiceWorker('http://localhost:3000/api/auth/me')).toBe(false);
    expect(shouldBypassServiceWorker('/manifest.json')).toBe(false);
  });

  it('references manifest icon files that actually exist', () => {
    const manifestPath = path.resolve(__dirname, '../../public/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    for (const icon of manifest.icons) {
      const target = path.join(path.dirname(manifestPath), icon.src.replace(/^\//, ''));
      expect(fs.existsSync(target)).toBe(true);
    }
  });
});
