import type { InteractionType, LeadStatus } from '@prisma/client';

/**
 * Mapa de transiciones permitidas en el pipeline.
 * Solo avanza (NEW → CONTACTED → QUALIFIED).
 * QUALIFIED, WON y LOST son estados terminales — no se sugiere transición.
 */
const TRANSITIONS: Partial<Record<LeadStatus, Partial<Record<InteractionType, LeadStatus>>>> = {
  NEW: {
    CALL: 'CONTACTED',
    EMAIL: 'CONTACTED',
    VISIT: 'CONTACTED',
    WHATSAPP: 'CONTACTED',
  },
  CONTACTED: {
    CALL: 'QUALIFIED',
    VISIT: 'QUALIFIED',
  },
};

/**
 * Devuelve el estado sugerido o null si no aplica ninguna transición.
 * Función pura: sin efectos secundarios, importable en cliente y servidor.
 */
export function suggestStatusTransition(
  currentStatus: LeadStatus,
  interactionType: InteractionType,
): LeadStatus | null {
  return TRANSITIONS[currentStatus]?.[interactionType] ?? null;
}
