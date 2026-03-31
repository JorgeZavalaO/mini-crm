import { describe, expect, it } from 'vitest';
import { suggestStatusTransition } from '@/lib/lead-status-transitions';

describe('suggestStatusTransition', () => {
  // ── Transiciones desde NEW ──────────────────────────────────────
  it.each([
    ['CALL', 'CONTACTED'],
    ['EMAIL', 'CONTACTED'],
    ['VISIT', 'CONTACTED'],
    ['WHATSAPP', 'CONTACTED'],
  ] as const)('NEW + %s → sugiere CONTACTED', (interactionType, expected) => {
    expect(suggestStatusTransition('NEW', interactionType)).toBe(expected);
  });

  it('NEW + NOTE → null (nota interna, no cuenta como contacto con cliente)', () => {
    expect(suggestStatusTransition('NEW', 'NOTE')).toBeNull();
  });

  // ── Transiciones desde CONTACTED ───────────────────────────────
  it.each([
    ['CALL', 'QUALIFIED'],
    ['VISIT', 'QUALIFIED'],
  ] as const)('CONTACTED + %s → sugiere QUALIFIED', (interactionType, expected) => {
    expect(suggestStatusTransition('CONTACTED', interactionType)).toBe(expected);
  });

  it.each(['EMAIL', 'WHATSAPP', 'NOTE'] as const)(
    'CONTACTED + %s → null (no alcanza para calificar)',
    (interactionType) => {
      expect(suggestStatusTransition('CONTACTED', interactionType)).toBeNull();
    },
  );

  // ── Estados terminales / sin transición ────────────────────────
  it.each(['QUALIFIED', 'WON', 'LOST'] as const)(
    '%s + cualquier tipo → null (estado terminal)',
    (status) => {
      expect(suggestStatusTransition(status, 'CALL')).toBeNull();
      expect(suggestStatusTransition(status, 'EMAIL')).toBeNull();
      expect(suggestStatusTransition(status, 'NOTE')).toBeNull();
      expect(suggestStatusTransition(status, 'VISIT')).toBeNull();
      expect(suggestStatusTransition(status, 'WHATSAPP')).toBeNull();
    },
  );
});
