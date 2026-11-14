import { expect, it } from 'vitest';
import { nicknameMessage, nicknamePattern } from '../../src/features/nickname';
it('signs exactly the message the backend verifies (backend/test/nicknames.test.ts pins the same text)', () => {
  expect(nicknameMessage('0xABCdef0000000000000000000000000000000001', 'KiwiKing', '2026-11-12T10:00:00.000Z'))
    .toBe('Set my Slyyce nickname\nAddress: 0xabcdef0000000000000000000000000000000001\nNickname: KiwiKing\nTime: 2026-11-12T10:00:00.000Z');
  expect(nicknamePattern.test('Slice_Queen')).toBe(true);
  expect(nicknamePattern.test('no')).toBe(false);
});
