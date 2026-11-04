import { expect, it } from 'vitest';
import { installContext } from '../../src/pwa/install-prompt';
const android = 'Mozilla/5.0 (Linux; Android 12; Infinix X665B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
it('picks how this browser can install the app', () => {
  expect(installContext(android, true, true)).toBe('installed');
  expect(installContext(android, false, true)).toBe('native');
  expect(installContext(android, false, false)).toBe('manual');
  expect(installContext(iphone, false, false)).toBe('ios');
  expect(installContext(android.replace('Mobile Safari', 'Telegram-Android Mobile Safari'), false, true)).toBe('in-app');
  expect(installContext('Mozilla/5.0 (Linux; Android 12; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', false, false)).toBe('in-app');
});
