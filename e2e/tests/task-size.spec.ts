import {
    test,
    expect,
    Page,
    Locator,
    Browser,
    BrowserContext,
    APIRequestContext,
} from '@playwright/test';

const PLANNED_STATUS = 6;

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

const getAppUrl = (baseURL?: string) =>
    baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';

async function loginViaUI(page: Page, appUrl: string) {
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

async function csrfHeaders(
    request: APIRequestContext,
    appUrl: string
): Promise<Record<string, string>> {
    const response = await request.get(`${appUrl}/api/csrf-token`);
    expect(response.ok()).toBeTruthy();
    const { csrfToken } = await response.json();
    return { 'x-csrf-token': csrfToken };
}

async function createPlannedTask(
    request: APIRequestContext,
    appUrl: string,
    name: string
): Promise<{ uid: string; name: string }> {
    const response = await request.post(`${appUrl}/api/task`, {
        data: { name, status: PLANNED_STATUS, priority: 1 },
        headers: await csrfHeaders(request, appUrl),
    });
    expect(response.ok()).toBeTruthy();
    const task = await response.json();
    expect(task.size).toBeNull();
    return { uid: task.uid, name };
}

async function fetchStoredSize(
    request: APIRequestContext,
    appUrl: string,
    uid: string
) {
    const response = await request.get(`${appUrl}/api/task/${uid}`);
    expect(response.ok()).toBeTruthy();
    return (await response.json()).size;
}

/** The size trigger in the closest container that holds both the task name and a size control. */
const sizeTriggerFor = (scope: Page | Locator, taskName: string): Locator =>
    scope
        .getByText(taskName, { exact: true })
        .filter({ visible: true })
        .first()
        .locator('xpath=ancestor::*[.//*[@data-testid="task-size-trigger"]][1]')
        .locator('[data-testid="task-size-trigger"]:visible')
        .first();

async function chooseSize(page: Page, trigger: Locator, label: string) {
    const patch = page.waitForResponse(
        (res) =>
            res.request().method() === 'PATCH' &&
            /\/api\/task\//.test(res.url())
    );
    await trigger.click();
    await page.getByRole('menuitemradio', { name: label, exact: true }).click();
    return patch;
}

// Serial with a single login: the auth rate limiter blocks repeated logins
test.describe('Task size', () => {
    test.describe.configure({ mode: 'serial' });

    let storageState: StorageState;
    let context: BrowserContext;
    let page: Page;
    let appUrl: string;
    let createdUids: string[] = [];

    test.beforeAll(async ({ browser, baseURL }) => {
        appUrl = getAppUrl(baseURL);
        const loginContext = await browser.newContext();
        await loginViaUI(await loginContext.newPage(), appUrl);
        storageState = await loginContext.storageState();
        await loginContext.close();
    });

    const openSession = async (browser: Browser) => {
        context = await browser.newContext({ storageState });
        page = await context.newPage();
    };

    test.beforeEach(async ({ browser }) => {
        await openSession(browser);
    });

    test.afterEach(async () => {
        const headers = await csrfHeaders(context.request, appUrl);
        for (const uid of createdUids) {
            await context.request.delete(`${appUrl}/api/task/${uid}`, {
                headers,
            });
        }
        createdUids = [];
        await context.close();
    });

    test('size set on Today shows in task details and back on Today', async () => {
        const task = await createPlannedTask(
            context.request,
            appUrl,
            `Size Today ${Date.now()}`
        );
        createdUids.push(task.uid);

        await page.goto(`${appUrl}/today`);
        const rowTrigger = sizeTriggerFor(
            page.getByTestId('planned-section'),
            task.name
        );
        await expect(rowTrigger).toContainText('Unset');

        const response = await chooseSize(page, rowTrigger, 'M');
        expect(response.ok()).toBeTruthy();
        await expect(rowTrigger).toContainText('M');

        await page.goto(`${appUrl}/task/${task.uid}`);
        await expect(sizeTriggerFor(page, task.name)).toContainText('M');

        await page.goBack();
        await expect(
            sizeTriggerFor(page.getByTestId('planned-section'), task.name)
        ).toContainText('M');

        expect(await fetchStoredSize(context.request, appUrl, task.uid)).toBe(
            'M'
        );
    });

    test('size set in task details shows on the Kanban card', async () => {
        const task = await createPlannedTask(
            context.request,
            appUrl,
            `Size Kanban ${Date.now()}`
        );
        createdUids.push(task.uid);

        await page.goto(`${appUrl}/task/${task.uid}`);
        const detailsTrigger = sizeTriggerFor(page, task.name);
        await expect(detailsTrigger).toContainText('Unset');
        const response = await chooseSize(page, detailsTrigger, 'L');
        expect(response.ok()).toBeTruthy();
        await expect(detailsTrigger).toContainText('L');

        await page.goto(`${appUrl}/kanban`);
        await expect(sizeTriggerFor(page, task.name)).toContainText('L');
    });

    test('a failed save reverts the value and shows the task update error', async () => {
        const task = await createPlannedTask(
            context.request,
            appUrl,
            `Size Failure ${Date.now()}`
        );
        createdUids.push(task.uid);

        await page.route(`**/api/task/${task.uid}`, (route) =>
            route.request().method() === 'PATCH'
                ? route.fulfill({
                      status: 403,
                      contentType: 'application/json',
                      body: JSON.stringify({ error: 'Forbidden' }),
                  })
                : route.continue()
        );

        await page.goto(`${appUrl}/today`);
        const rowTrigger = sizeTriggerFor(
            page.getByTestId('planned-section'),
            task.name
        );
        await expect(rowTrigger).toContainText('Unset');

        await chooseSize(page, rowTrigger, 'S');

        await expect(page.getByText('Failed to update task')).toBeVisible();
        await expect(rowTrigger).toContainText('Unset');
        expect(
            await fetchStoredSize(context.request, appUrl, task.uid)
        ).toBeNull();
    });

    test('a second tab keeps the old size until it reloads', async () => {
        const task = await createPlannedTask(
            context.request,
            appUrl,
            `Size Second Tab ${Date.now()}`
        );
        createdUids.push(task.uid);

        const secondTab = await context.newPage();
        await secondTab.goto(`${appUrl}/today`);
        const secondTabTrigger = sizeTriggerFor(
            secondTab.getByTestId('planned-section'),
            task.name
        );
        await expect(secondTabTrigger).toContainText('Unset');

        await page.goto(`${appUrl}/today`);
        const response = await chooseSize(
            page,
            sizeTriggerFor(page.getByTestId('planned-section'), task.name),
            'XL'
        );
        expect(response.ok()).toBeTruthy();

        await expect(secondTabTrigger).toContainText('Unset');

        await secondTab.reload();
        await expect(
            sizeTriggerFor(secondTab.getByTestId('planned-section'), task.name)
        ).toContainText('XL');
    });
});
