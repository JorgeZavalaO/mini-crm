import { Resend } from 'resend';
import { getEnv } from '@/lib/env';
import { formatDate, DEFAULT_TIMEZONE } from '@/lib/date-utils';

let resendClient: Resend | null = null;

function getResend(): Resend {
  const { RESEND_API_KEY } = getEnv();

  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está configurada. Configura la variable de entorno.');
  }

  resendClient ??= new Resend(RESEND_API_KEY);
  return resendClient;
}

function formatMoney(value: number, currency: 'PEN' | 'USD'): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeHtmlWithLineBreaks(value: string): string {
  return escapeHtml(value).replaceAll(/\r?\n/g, '<br/>');
}

function sanitizeEmailSubject(value: string): string {
  return value.replaceAll(/[\r\n]+/g, ' ').trim();
}

export type SendQuoteEmailOptions = {
  to: string;
  quoteNumber: string;
  clientName: string;
  currency: 'PEN' | 'USD';
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  validUntil: Date | null;
  notes: string | null;
  items: {
    lineNumber: number;
    description: string;
    quantity: number;
    unitPrice: number;
    lineSubtotal: number;
  }[];
  senderName: string;
  tenantTimezone?: string;
};

export async function sendQuoteEmail(opts: SendQuoteEmailOptions): Promise<void> {
  const resend = getResend();
  const clientName = escapeHtml(opts.clientName);
  const senderName = escapeHtml(opts.senderName);
  const notes = opts.notes ? escapeHtmlWithLineBreaks(opts.notes) : null;

  const itemsRows = opts.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.lineNumber}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${escapeHtml(item.description)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${formatMoney(item.unitPrice, opts.currency)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${formatMoney(item.lineSubtotal, opts.currency)}</td>
        </tr>`,
    )
    .join('');

  const validUntilText = opts.validUntil
    ? formatDate(opts.validUntil, opts.tenantTimezone ?? DEFAULT_TIMEZONE, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:32px 32px 24px;border-bottom:2px solid #111827;">
        <h1 style="margin:0;font-size:22px;color:#111827;">Cotización ${opts.quoteNumber}</h1>
        <p style="margin:6px 0 0;color:#6b7280;font-size:14px;">Para: <strong>${clientName}</strong></p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#374151;">#</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#374151;">Descripción</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#374151;">Cant.</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#374151;">P. Unit.</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#374151;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;font-size:14px;">
          <tr>
            <td style="padding:4px 0;color:#6b7280;">Subtotal</td>
            <td style="padding:4px 0;text-align:right;">${formatMoney(opts.subtotal, opts.currency)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#6b7280;">Impuesto (${(opts.taxRate * 100).toFixed(0)}%)</td>
            <td style="padding:4px 0;text-align:right;">${formatMoney(opts.taxAmount, opts.currency)}</td>
          </tr>
          <tr style="border-top:2px solid #111827;">
            <td style="padding:8px 0 0;font-weight:700;font-size:16px;">Total</td>
            <td style="padding:8px 0 0;text-align:right;font-weight:700;font-size:16px;">${formatMoney(opts.totalAmount, opts.currency)}</td>
          </tr>
        </table>

        ${
          validUntilText
            ? `<p style="margin-top:20px;font-size:13px;color:#6b7280;">Válida hasta: <strong>${validUntilText}</strong></p>`
            : ''
        }
        ${
          notes
            ? `<p style="margin-top:12px;font-size:13px;color:#374151;background:#f9fafb;padding:12px;border-radius:6px;border-left:3px solid #d1d5db;">${notes}</p>`
            : ''
        }
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:13px;color:#9ca3af;">
          Enviado por <strong>${senderName}</strong> a través de Mini CRM.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { EMAIL_FROM } = getEnv();
  const result = await resend.emails.send({
    from: EMAIL_FROM ?? 'cotizaciones@resend.dev',
    to: opts.to,
    subject: sanitizeEmailSubject(`Cotización ${opts.quoteNumber} - ${opts.clientName}`),
    html,
  });

  if (result.error) {
    throw new Error(result.error.message ?? 'Error al enviar el email');
  }
}
