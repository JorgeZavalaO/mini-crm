import 'dotenv/config';
import { expect, test, type Page } from '@playwright/test';
import { db } from '../../lib/db';

const TENANT_SLUG = 'acme-logistics';
const ADMIN = {
  email: 'admin@acme.com',
  password: 'admin123',
};
const SELLER = {
  email: 'vendedor@acme.com',
  password: 'vendedor123',
  name: 'Carlos Vendedor',
};

test.describe.serial('Módulo de notificaciones', () => {
  test('valida los triggers activos y las acciones visibles del módulo', async ({ browser }) => {
    await ensureQuotingFeatureEnabled();

    const suffix = `${Date.now()}`;
    const leadName = `[E2E] Lead ${suffix}`;
    const taskTitle = `[E2E] Tarea ${suffix}`;

    const adminContext = await browser.newContext();
    const sellerContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const sellerPage = await sellerContext.newPage();

    await login(adminPage, ADMIN.email, ADMIN.password);
    await login(sellerPage, SELLER.email, SELLER.password);

    await createLead(adminPage, leadName);
    await expectNotificationInBell(sellerPage, 'Nuevo lead registrado', leadName);
    await expectNotificationInHistory(sellerPage, 'Nuevo lead registrado', leadName);

    const quoteNumberAccepted = await createQuote(sellerPage, leadName);
    await expectNotificationInBell(adminPage, 'Cotización generada', quoteNumberAccepted);

    await createTask(adminPage, taskTitle);
    await expectNotificationInBell(sellerPage, 'Nueva tarea asignada', taskTitle);

    await completeTask(sellerPage, taskTitle);
    await waitForNotificationRecord(
      'TASK_COMPLETED',
      `${taskTitle} · completada por ${SELLER.name}`,
    );
    await expectNotificationInBell(
      adminPage,
      'Tarea completada',
      `${taskTitle} · completada por ${SELLER.name}`,
    );
    await expectNotificationInHistory(
      adminPage,
      'Tarea completada',
      `${taskTitle} · completada por ${SELLER.name}`,
    );

    await changeQuoteStatus(adminPage, quoteNumberAccepted, 'ENVIADA');
    await changeQuoteStatus(adminPage, quoteNumberAccepted, 'ACEPTADA');
    await waitForNotificationRecord('QUOTE_ACCEPTED', `${quoteNumberAccepted} fue aceptada`);
    await expectNotificationInBell(
      sellerPage,
      'Cotización aceptada',
      `${quoteNumberAccepted} fue aceptada`,
    );

    const quoteNumberRejected = await createQuote(sellerPage, leadName);
    await changeQuoteStatus(adminPage, quoteNumberRejected, 'ENVIADA');
    await changeQuoteStatus(adminPage, quoteNumberRejected, 'RECHAZADA');
    await waitForNotificationRecord('QUOTE_REJECTED', `${quoteNumberRejected} fue rechazada`);
    await expectNotificationInBell(
      sellerPage,
      'Cotización rechazada',
      `${quoteNumberRejected} fue rechazada`,
    );

    await validateNotificationActionsOnHistoryPage(sellerPage, {
      taskTitle,
      quoteNumberRejected,
    });

    await adminContext.close();
    await sellerContext.close();
  });
});

async function ensureQuotingFeatureEnabled() {
  const tenant = await db.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${TENANT_SLUG} no encontrado para pruebas E2E`);
  }

  await db.tenantFeature.upsert({
    where: {
      tenantId_featureKey: {
        tenantId: tenant.id,
        featureKey: 'QUOTING_BASIC',
      },
    },
    update: { enabled: true },
    create: {
      tenantId: tenant.id,
      featureKey: 'QUOTING_BASIC',
      enabled: true,
    },
  });

  const activeProduct = await db.product.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, isActive: true },
    select: { id: true },
  });

  if (!activeProduct) {
    const adminUser = await db.user.findUnique({
      where: { email: ADMIN.email },
      select: { id: true },
    });

    await db.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Producto base E2E',
        description: 'Producto semilla para validación Playwright',
        unitPrice: 1500,
        currency: 'PEN',
        isActive: true,
        taxExempt: false,
        createdById: adminUser?.id ?? null,
      },
    });
  }
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Código de empresa').fill(TENANT_SLUG);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(new RegExp(`/${TENANT_SLUG}/dashboard`));
}

async function createLead(page: Page, leadName: string) {
  await page.goto(`/${TENANT_SLUG}/leads`);
  await page.getByRole('button', { name: /Nuevo lead/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[id$="-businessName"]').fill(leadName);
  await dialog.locator('input[id$="-ruc"]').fill(uniqueRucFromText(leadName));
  await dialog.locator('input[id$="-source"]').fill('Playwright E2E');
  await dialog.getByRole('button', { name: 'Crear lead' }).click();
  await expect(page.getByRole('link', { name: leadName })).toBeVisible();
}

async function createQuote(page: Page, leadName: string) {
  const product = await db.product.findFirst({
    where: { deletedAt: null, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { name: true },
  });

  if (!product) {
    throw new Error('No hay productos activos para crear la cotización E2E');
  }

  await page.goto(`/${TENANT_SLUG}/quotes`);
  await page.getByRole('button', { name: 'Nueva cotización' }).click();

  await page.getByRole('combobox', { name: /Cliente \/ Lead/i }).click();
  await page.getByPlaceholder('Buscar por nombre o RUC…').fill(leadName);
  await page.getByRole('option', { name: new RegExp(escapeForRegex(leadName)) }).click();

  const itemDescription = page.getByPlaceholder(/Ítem 1/);
  await itemDescription.click();
  await expect(page.locator('[cmdk-list]')).toBeVisible();
  await page.getByRole('option', { name: new RegExp(escapeForRegex(product.name)) }).click({
    force: true,
  });
  await page.getByRole('button', { name: 'Crear cotización' }).click();

  await expect(page.getByRole('button', { name: 'Nueva cotización' })).toBeVisible();
  await page.reload();

  const row = page.locator('tbody tr').filter({ hasText: leadName }).first();
  await expect(row).toBeVisible();
  const quoteNumber = (await row.getByRole('link').first().textContent())?.trim();

  if (!quoteNumber) {
    throw new Error(`No se pudo resolver el número de cotización para ${leadName}`);
  }

  return quoteNumber;
}

async function createTask(page: Page, taskTitle: string) {
  await page.goto(`/${TENANT_SLUG}/tasks`);
  await page.getByRole('button', { name: 'Nueva tarea' }).click();
  await page.getByLabel(/^Título/i).fill(taskTitle);
  await page.locator('#task-assignee').click();
  await page.getByRole('option', { name: /Carlos Vendedor/ }).click();
  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible();
  await page.reload();
  await expect(page.getByText(taskTitle)).toBeVisible();
}

async function completeTask(page: Page, taskTitle: string) {
  await page.goto(`/${TENANT_SLUG}/tasks?view=mine`);
  const row = page.locator('div.group').filter({ hasText: taskTitle }).first();
  await expect(row).toBeVisible();
  await row.getByLabel('Marcar completada').click();
}

async function changeQuoteStatus(
  page: Page,
  quoteNumber: string,
  nextStatus: 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA',
) {
  await page.goto(`/${TENANT_SLUG}/quotes`);
  const row = page.locator('tbody tr').filter({ hasText: quoteNumber }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Acciones de cotización' }).click();
  const actionText =
    nextStatus === 'ENVIADA'
      ? 'Marcar Enviada'
      : nextStatus === 'ACEPTADA'
        ? 'Marcar Aceptada'
        : 'Marcar Rechazada';
  const resultingLabel =
    nextStatus === 'ENVIADA' ? 'Enviada' : nextStatus === 'ACEPTADA' ? 'Aceptada' : 'Rechazada';
  await page.getByRole('menuitem', { name: actionText }).click();
  await expect(row).toContainText(resultingLabel);
}

async function openNotificationsBell(page: Page) {
  await page.getByRole('button', { name: /Notificaciones/ }).click();
  await expect(page.getByRole('button', { name: 'Actualizar notificaciones' })).toBeVisible();
}

async function expectNotificationInBell(page: Page, title: string, description: string) {
  await openNotificationsBell(page);
  const item = page
    .locator('li')
    .filter({ hasText: title })
    .filter({ hasText: description })
    .first();
  await expect(item).toBeVisible();
  await page.keyboard.press('Escape');
}

async function expectNotificationInHistory(page: Page, title: string, description: string) {
  await page.goto(`/${TENANT_SLUG}/notifications`);
  await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible();
  const item = page
    .locator('li')
    .filter({ hasText: title })
    .filter({ hasText: description })
    .first();
  await expect(item).toBeVisible();
}

async function validateNotificationActionsOnHistoryPage(
  page: Page,
  params: {
    taskTitle: string;
    quoteNumberRejected: string;
  },
) {
  await page.goto(`/${TENANT_SLUG}/notifications`);

  const taskAssignedItem = page
    .locator('li')
    .filter({ hasText: 'Nueva tarea asignada' })
    .filter({ hasText: params.taskTitle })
    .first();

  await expect(taskAssignedItem).toBeVisible();
  await taskAssignedItem.locator('button[title="Marcar como leída"]').click();

  await page.getByRole('tab', { name: 'Leídas', exact: true }).click();
  await expect(taskAssignedItem).toBeVisible();

  await page.getByRole('tab', { name: 'Todas', exact: true }).click();
  const markAllButton = page.getByRole('button', { name: 'Marcar todas como leídas' });
  await expect(markAllButton).toBeVisible();
  await markAllButton.click();

  await page.getByRole('tab', { name: 'No leídas', exact: true }).click();
  await expect(page.getByText('No hay notificaciones sin leer')).toBeVisible();

  await page.getByRole('tab', { name: 'Leídas', exact: true }).click();
  const rejectedQuoteItem = page
    .locator('li')
    .filter({ hasText: 'Cotización rechazada' })
    .filter({ hasText: params.quoteNumberRejected })
    .first();

  await expect(rejectedQuoteItem).toBeVisible();
  await rejectedQuoteItem.locator('button[title="Eliminar"]').click();
  await expect(rejectedQuoteItem).toHaveCount(0);

  await openNotificationsBell(page);
  await expect(page.getByText('Sin notificaciones pendientes')).not.toBeVisible();
  await page.keyboard.press('Escape');
}

async function waitForNotificationRecord(type: string, description: string) {
  await expect
    .poll(async () => {
      return db.notification.count({
        where: {
          type: type as never,
          description,
          deletedAt: null,
        },
      });
    })
    .toBeGreaterThan(0);
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueRucFromText(value: string) {
  const digits = value.replace(/\D/g, '').slice(-11);
  return digits.padStart(11, '0');
}
