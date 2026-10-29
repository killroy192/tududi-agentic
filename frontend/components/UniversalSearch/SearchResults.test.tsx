import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import SearchResults from './SearchResults';
import { searchUniversal } from '../../utils/searchService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../utils/searchService', () => ({
    searchUniversal: jest.fn(),
}));

const searchUniversalMock = searchUniversal as jest.MockedFunction<
    typeof searchUniversal
>;

const renderResults = (
    overrides: Partial<React.ComponentProps<typeof SearchResults>> = {}
) =>
    render(
        <MemoryRouter>
            <SearchResults
                searchQuery=""
                selectedFilters={[]}
                selectedPriority={null}
                selectedDue={null}
                selectedDefer={null}
                selectedTags={[]}
                selectedExtras={[]}
                onClose={jest.fn()}
                {...overrides}
            />
        </MemoryRouter>
    );

describe('SearchResults - start-typing prompt and new extras', () => {
    beforeEach(() => {
        searchUniversalMock.mockReset();
    });

    it.each([['no_tags'], ['no_due_date']])(
        'shows "No results found" for %s alone when nothing matches',
        async (extra) => {
            searchUniversalMock.mockResolvedValue({ results: [] });
            renderResults({ selectedExtras: [extra] });

            await waitFor(() =>
                expect(searchUniversalMock).toHaveBeenCalledWith(
                    expect.objectContaining({ extras: [extra] })
                )
            );
            expect(
                await screen.findByTestId('search-no-results')
            ).toBeInTheDocument();
            expect(
                screen.queryByTestId('search-empty')
            ).not.toBeInTheDocument();
        }
    );

    it('lists matching results for both new extras together', async () => {
        searchUniversalMock.mockResolvedValue({
            results: [{ type: 'Task', id: 7, uid: 't7', name: 'Loose task' }],
        });
        renderResults({ selectedExtras: ['no_tags', 'no_due_date'] });

        expect(await screen.findByText('Loose task')).toBeInTheDocument();
        expect(searchUniversalMock).toHaveBeenCalledWith(
            expect.objectContaining({ extras: ['no_tags', 'no_due_date'] })
        );
    });

    it('keeps the start-typing prompt for another extra alone', async () => {
        searchUniversalMock.mockResolvedValue({ results: [] });
        renderResults({ selectedExtras: ['recurring'] });

        await waitFor(() => expect(searchUniversalMock).toHaveBeenCalled());
        expect(await screen.findByTestId('search-empty')).toBeInTheDocument();
    });

    it('keeps the start-typing prompt for defer-until alone', async () => {
        searchUniversalMock.mockResolvedValue({ results: [] });
        renderResults({ selectedDefer: 'today' });

        await waitFor(() => expect(searchUniversalMock).toHaveBeenCalled());
        expect(await screen.findByTestId('search-empty')).toBeInTheDocument();
    });

    it('shows "No results found" without an error when the request fails', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        searchUniversalMock.mockRejectedValue(new Error('network'));
        renderResults({ selectedExtras: ['no_tags'] });

        await waitFor(() => expect(console.error).toHaveBeenCalled());
        expect(
            await screen.findByTestId('search-no-results')
        ).toBeInTheDocument();
        (console.error as jest.Mock).mockRestore();
    });
});
