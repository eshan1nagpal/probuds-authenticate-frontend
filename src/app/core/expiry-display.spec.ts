import { describe, expect, it } from 'vitest';
import { expiryDisplay } from './expiry-display';

describe('server expiry timestamp display', () => {
  it('preserves the server wall-clock time without assuming the browser timezone', () => {
    expect(expiryDisplay('2026-11-15T09:30:00')).toBe('15 Nov 2026, 09:30');
  });
  it('accepts timestamps with fractional seconds', () => {
    expect(expiryDisplay('2026-11-15T09:30:00.123456')).toBe('15 Nov 2026, 09:30');
  });
  it('does not display malformed or timezone-bearing values as a LocalDateTime', () => {
    expect(expiryDisplay('invalid')).toBeNull();
    expect(expiryDisplay(null)).toBeNull();
    expect(expiryDisplay('2026-11-15T09:30:00Z')).toBeNull();
  });
});
