import { test, expect, Page } from '@playwright/test';

test.describe('Task size', () => {
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

        await page.waitForURL(/\/(dashboard|today)/, { timeout: 10000 });
    }

    test('set size from list and see it on details (AC-5, AC-9)', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);

        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();
        const taskName = `Size E2E Task ${timestamp}`;

        const createResponse = await context.request.post(
            `${appUrl}/api/task`,
            {
                data: {
                    name: taskName,
                    status: 0,
                    priority: 1,
                },
            }
        );
        expect(createResponse.ok()).toBeTruthy();
        const task = await createResponse.json();

        await page.goto(`${appUrl}/tasks`);
        const row = page.getByTestId(`task-item-${task.id}`);
        await expect(row).toBeVisible({ timeout: 10000 });

        const sizeControl = row.getByTestId('task-size-control');
        await sizeControl.click();
        await page.getByRole('option', { name: 'L' }).click();
        await expect(sizeControl).toHaveText('L');

        await row.click();
        await page.waitForURL(new RegExp(`/task/${task.uid}`), {
            timeout: 10000,
        });

        const detailsSize = page.getByTestId('task-size-control');
        await expect(detailsSize).toContainText('L');

        await context.request.delete(`${appUrl}/api/task/${task.uid}`);
    });
});
