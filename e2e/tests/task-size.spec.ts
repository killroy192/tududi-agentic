import { test, expect, Page } from '@playwright/test';

test.describe('Task Size', () => {
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

    test('size chip shows dash when unset, can be set from list row, persists after reload', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();

        const response = await context.request.post(`${appUrl}/api/task`, {
            data: {
                name: `Size Test ${timestamp}`,
                status: 1,
                priority: 0,
            },
        });
        const task = await response.json();

        try {
            await page.goto(`${appUrl}/today`);

            const badge = page.getByTestId(
                `task-size-badge-${task.id}-desktop`
            );
            await expect(badge).toBeVisible({ timeout: 10000 });
            await expect(badge).toHaveText('—');

            await badge.click();

            const optionM = page.getByTestId('task-size-option-M');
            await expect(optionM).toBeVisible();

            const patchResponse = page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/api/task/${task.uid}`) &&
                    resp.request().method() === 'PATCH'
            );
            await optionM.click();
            const patch = await patchResponse;
            expect(patch.ok()).toBeTruthy();
            const patchedBody = await patch.json();
            expect(patchedBody.size).toBe('M');

            await expect(badge).toHaveText('M');

            await page.reload();
            await page.waitForLoadState('networkidle');

            const badgeAfterReload = page.getByTestId(
                `task-size-badge-${task.id}-desktop`
            );
            await expect(badgeAfterReload).toHaveText('M', { timeout: 10000 });
        } finally {
            await context.request.delete(`${appUrl}/api/task/${task.uid}`);
        }
    });

    test('size can be changed in details view and clears back to unset', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();

        const response = await context.request.post(`${appUrl}/api/task`, {
            data: {
                name: `Size Details ${timestamp}`,
                status: 1,
                priority: 0,
                size: 'S',
            },
        });
        const task = await response.json();

        try {
            await page.goto(`${appUrl}/task/${task.uid}`);

            const detailsBadge = page.getByTestId('task-size-dropdown');
            await expect(detailsBadge).toBeVisible({ timeout: 10000 });
            await expect(detailsBadge).toHaveText('S');

            await detailsBadge.click();
            const optionXL = page.getByTestId('task-size-option-XL');
            await expect(optionXL).toBeVisible();
            const patchXl = page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/api/task/${task.uid}`) &&
                    resp.request().method() === 'PATCH'
            );
            await optionXL.click();
            expect((await patchXl).ok()).toBeTruthy();

            await expect(detailsBadge).toHaveText('XL');

            await detailsBadge.click();
            const optionNone = page.getByTestId('task-size-option-none');
            await expect(optionNone).toBeVisible();
            const patchClear = page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/api/task/${task.uid}`) &&
                    resp.request().method() === 'PATCH'
            );
            await optionNone.click();
            expect((await patchClear).ok()).toBeTruthy();

            await expect(detailsBadge).toHaveText('—');
        } finally {
            await context.request.delete(`${appUrl}/api/task/${task.uid}`);
        }
    });

    test('recurring task does not show size chip or dropdown', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();

        const response = await context.request.post(`${appUrl}/api/task`, {
            data: {
                name: `Recurring Size ${timestamp}`,
                status: 1,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: new Date(Date.now() + 86400000)
                    .toISOString()
                    .split('T')[0],
            },
        });
        const task = await response.json();

        try {
            await page.goto(`${appUrl}/today`);
            await page.waitForLoadState('networkidle');

            await expect(
                page.getByTestId(`task-size-badge-${task.id}-desktop`)
            ).not.toBeVisible({ timeout: 5000 });
            await expect(
                page.getByTestId(`task-size-badge-${task.id}-mobile`)
            ).not.toBeVisible({ timeout: 5000 });

            await page.goto(`${appUrl}/task/${task.uid}`);
            await page.waitForLoadState('networkidle');

            const detailsBadge = page.getByTestId('task-size-dropdown');
            await expect(detailsBadge).not.toBeVisible({ timeout: 5000 });
        } finally {
            await context.request.delete(`${appUrl}/api/task/${task.uid}`);
        }
    });
});
