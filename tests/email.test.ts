import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock, resendConstructorMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  resendConstructorMock: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: resendConstructorMock.mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}));

vi.mock('@/lib/env', () => ({
  getEnv: () => ({
    RESEND_API_KEY: 're_test_key',
  }),
}));

import { sendQuoteEmail } from '@/lib/email';

describe('sendQuoteEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  });

  it('escapa html del body y sanea el subject', async () => {
    await sendQuoteEmail({
      to: 'cliente@example.com',
      quoteNumber: 'Q-2026-000001',
      clientName: 'ACME\r\nBCC:evil@example.com',
      currency: 'PEN',
      taxRate: 0.18,
      subtotal: 100,
      taxAmount: 18,
      totalAmount: 118,
      validUntil: null,
      notes: '<script>alert(1)</script>\nLinea 2',
      senderName: '<b>Ventas</b>',
      items: [
        {
          lineNumber: 1,
          description: '<img src=x onerror=alert(1)>',
          quantity: 1,
          unitPrice: 100,
          lineSubtotal: 100,
        },
      ],
    });

    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject).toBe('Cotización Q-2026-000001 - ACME BCC:evil@example.com');
    expect(payload.subject).not.toMatch(/[\r\n]/);
    expect(payload.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br/>Linea 2');
    expect(payload.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(payload.html).toContain('&lt;b&gt;Ventas&lt;/b&gt;');
    expect(payload.html).not.toContain('<script>alert(1)</script>');
  });
});
