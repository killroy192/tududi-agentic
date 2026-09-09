import { test, expect, Page } from '@playwright/test';

test.describe('Task size (KAN-15)', () => {
    async function loginViaUI(page: Page, baseURL?: string) {
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        await page.goto(`${appUrl}/login`);
        await page
            .getByTestId('login-email')
            .fill(process.env.E2E_EMAIL || 'test@tududi.com');
        await page
            .getByTestId('login-password')
            .fill(process.env.E2E_PASSWORD || 'password123');
        await page.getByTestId('login-submit').click();
        await page.waitForURL(/\/(dashboard|today|tasks)/, { timeout: 10000 });
    }

    test('set size from list and see it on details', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();
        const taskName = `Size sync ${timestamp}`;

        const createResponse = await context.request.post(
            `${appUrl}/api/task`,
            {
                data: {
                    name: taskName,
                    status: 0,
                },
            }
        );
        expect(createResponse.ok()).toBeTruthy();
        const created = await createResponse.json();
        expect(created.size ?? null).toBeNull();

        await page.goto(`${appUrl}/tasks`);
        const row = page.getByText(taskName, { exact: true }).first();
        await expect(row).toBeVisible();

        const taskCard = page
            .locator('[data-testid^="task-item-"]')
            .filter({ hasText: taskName })
            .first();
        const sizeButton = taskCard.getByRole('button', { name: 'Size' });
        await sizeButton.click();
        await page.getByRole('option', { name: /^L$/ }).click();
        await expect(sizeButton).toHaveText('L');
        await expect(page).toHaveURL(/\/tasks/);

        await page.goto(`${appUrl}/task/${created.uid}`);
        await expect(page.getByRole('button', { name: 'Size' })).toContainText(
            'L'
        );
    });
});
