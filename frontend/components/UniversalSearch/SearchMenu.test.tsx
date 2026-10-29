import React from 'react';
import {
    render,
    screen,
    fireEvent,
    within,
    waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import SearchMenu from './SearchMenu';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../utils/csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('test-token'),
}));

interface CapturedResultsProps {
    selectedDue: string | null;
    selectedDefer: string | null;
    selectedTags: string[];
    selectedExtras: string[];
}

let lastResultsProps: CapturedResultsProps | null = null;
jest.mock('./SearchResults', () => {
    return function MockSearchResults(props: CapturedResultsProps) {
        lastResultsProps = props;
        return null;
    };
});

const fetchMock = jest.fn();

const mockFetch = (tags: Array<{ id: number; name: string }>) => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ uid: 'view-uid' }),
            });
        }
        if (String(url).includes('tags')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(tags),
            });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
};

const renderMenu = async (
    tags: Array<{ id: number; name: string }> = [{ id: 1, name: 'work' }]
) => {
    mockFetch(tags);
    render(
        <MemoryRouter>
            <SearchMenu
                searchQuery=""
                selectedFilters={[]}
                onFilterToggle={jest.fn()}
                onClose={jest.fn()}
            />
        </MemoryRouter>
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText('search.criteria'));
    if (tags.length > 0) {
        await screen.findByText('search.tagsFilter');
    }
};

const group = (labelKey: string) =>
    within(screen.getByText(labelKey).parentElement as HTMLElement);

const extrasBadge = (labelKey: string) =>
    group('search.extras').getByRole('button', { name: labelKey });

const dueBadge = (labelKey: string) =>
    group('search.dueFilter').getByRole('button', { name: labelKey });

const tagBadge = (name: string) =>
    group('search.tagsFilter').getByRole('button', { name });

const isSelected = (badge: HTMLElement) =>
    !badge.className.includes('opacity-50');

describe('SearchMenu - has no Tags and has no Due Date extras', () => {
    beforeEach(() => {
        lastResultsProps = null;
        fetchMock.mockReset();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    it('lists the new options only as Extras badges', async () => {
        await renderMenu();

        expect(
            extrasBadge('search.extrasFilter.hasNoTags')
        ).toBeInTheDocument();
        expect(
            extrasBadge('search.extrasFilter.hasNoDueDate')
        ).toBeInTheDocument();

        const tagNames = group('search.tagsFilter')
            .getAllByRole('button')
            .map((button) => button.textContent);
        expect(tagNames).toEqual(['work']);

        const dueNames = group('search.dueFilter')
            .getAllByRole('button')
            .map((button) => button.textContent);
        expect(dueNames).toEqual([
            'dateIndicators.today',
            'dateIndicators.tomorrow',
            'dateIndicators.nextWeek',
            'dateIndicators.nextMonth',
        ]);
    });

    it('keeps "has no Tags" in Extras when the user has no tags', async () => {
        await renderMenu([]);

        expect(screen.queryByText('search.tagsFilter')).not.toBeInTheDocument();
        expect(
            extrasBadge('search.extrasFilter.hasNoTags')
        ).toBeInTheDocument();
    });

    it('clears selected tags and "has Tags" when "has no Tags" is selected', async () => {
        await renderMenu();

        fireEvent.click(tagBadge('work'));
        fireEvent.click(extrasBadge('search.extrasFilter.hasTags'));
        fireEvent.click(extrasBadge('search.extrasFilter.hasNoTags'));

        expect(isSelected(tagBadge('work'))).toBe(false);
        expect(isSelected(extrasBadge('search.extrasFilter.hasTags'))).toBe(
            false
        );
        expect(isSelected(extrasBadge('search.extrasFilter.hasNoTags'))).toBe(
            true
        );
        expect(lastResultsProps?.selectedTags).toEqual([]);
        expect(lastResultsProps?.selectedExtras).toEqual(['no_tags']);
    });

    it('clears "has no Tags" when a tag or "has Tags" is selected', async () => {
        await renderMenu();

        fireEvent.click(extrasBadge('search.extrasFilter.hasNoTags'));
        fireEvent.click(tagBadge('work'));
        expect(isSelected(extrasBadge('search.extrasFilter.hasNoTags'))).toBe(
            false
        );
        expect(lastResultsProps?.selectedTags).toEqual(['work']);

        fireEvent.click(extrasBadge('search.extrasFilter.hasNoTags'));
        fireEvent.click(extrasBadge('search.extrasFilter.hasTags'));
        expect(lastResultsProps?.selectedExtras).toEqual(['has_tags']);
    });

    it('clears the due window and "is Overdue" when "has no Due Date" is selected', async () => {
        await renderMenu();

        fireEvent.click(dueBadge('dateIndicators.today'));
        fireEvent.click(extrasBadge('search.extrasFilter.isOverdue'));
        fireEvent.click(extrasBadge('search.extrasFilter.hasNoDueDate'));

        expect(isSelected(dueBadge('dateIndicators.today'))).toBe(false);
        expect(lastResultsProps?.selectedDue).toBeNull();
        expect(lastResultsProps?.selectedExtras).toEqual(['no_due_date']);
    });

    it('clears "has no Due Date" when a due window or "is Overdue" is selected', async () => {
        await renderMenu();

        fireEvent.click(extrasBadge('search.extrasFilter.hasNoDueDate'));
        fireEvent.click(dueBadge('dateIndicators.tomorrow'));
        expect(lastResultsProps?.selectedDue).toBe('tomorrow');
        expect(lastResultsProps?.selectedExtras).toEqual([]);

        fireEvent.click(extrasBadge('search.extrasFilter.hasNoDueDate'));
        fireEvent.click(extrasBadge('search.extrasFilter.isOverdue'));
        expect(lastResultsProps?.selectedExtras).toEqual(['overdue']);
    });

    it('keeps a due window and "is Overdue" selected together', async () => {
        await renderMenu();

        fireEvent.click(dueBadge('dateIndicators.today'));
        fireEvent.click(extrasBadge('search.extrasFilter.isOverdue'));

        expect(lastResultsProps?.selectedDue).toBe('today');
        expect(lastResultsProps?.selectedExtras).toEqual(['overdue']);
    });

    it('allows both new extras together', async () => {
        await renderMenu();

        fireEvent.click(extrasBadge('search.extrasFilter.hasNoTags'));
        fireEvent.click(extrasBadge('search.extrasFilter.hasNoDueDate'));

        expect(lastResultsProps?.selectedExtras).toEqual([
            'no_tags',
            'no_due_date',
        ]);
    });

    it('turning a new badge off removes only that extra and restores nothing', async () => {
        await renderMenu();

        fireEvent.click(tagBadge('work'));
        fireEvent.click(extrasBadge('search.extrasFilter.isRecurring'));
        fireEvent.click(extrasBadge('search.extrasFilter.hasNoTags'));
        fireEvent.click(extrasBadge('search.extrasFilter.hasNoTags'));

        expect(lastResultsProps?.selectedTags).toEqual([]);
        expect(lastResultsProps?.selectedExtras).toEqual(['recurring']);
    });

    it('names the selected label in the summary extras clause', async () => {
        await renderMenu();

        fireEvent.click(extrasBadge('search.extrasFilter.hasNoDueDate'));

        const summaryLabel = screen.getByText('search.thatAre', {
            exact: false,
        });
        expect(summaryLabel.parentElement).toHaveTextContent(
            'search.extrasFilter.hasNoDueDate'
        );
    });

    it('saves an extras-only search with no_tags and no_due_date', async () => {
        await renderMenu();

        fireEvent.click(extrasBadge('search.extrasFilter.hasNoTags'));
        fireEvent.click(extrasBadge('search.extrasFilter.hasNoDueDate'));
        fireEvent.click(screen.getByText('search.saveAsSmartView'));
        fireEvent.change(screen.getByLabelText(/search.viewName/), {
            target: { value: 'Untagged Undated' },
        });
        fireEvent.click(screen.getByText('search.saveView'));

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ method: 'POST' })
            )
        );
        const postCall = fetchMock.mock.calls.find(
            ([, init]) => init?.method === 'POST'
        );
        const body = JSON.parse(postCall?.[1].body as string);
        expect(body.name).toBe('Untagged Undated');
        expect(body.extras).toEqual(['no_tags', 'no_due_date']);
        expect(body.tags).toBeNull();
        expect(body.due).toBeNull();
    });
});
