import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Area } from '../../../entities/Area';
import { useStore } from '../../../store/useStore';
import { fetchAreas } from '../../../utils/areasService';
import AreaDetails from '../AreaDetails';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
}));

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: {
        language: 'en',
        t: (key: string) => key,
        on: jest.fn(),
        off: jest.fn(),
    },
}));

jest.mock('../../../utils/areasService', () => ({
    fetchAreas: jest.fn(),
    updateArea: jest.fn(),
}));

jest.mock('../../../utils/projectsService', () => ({
    fetchProjects: jest.fn().mockResolvedValue([]),
    updateProject: jest.fn(),
}));

jest.mock('../../../utils/tasksService', () => ({
    fetchTasks: jest.fn().mockResolvedValue({ tasks: [] }),
}));

jest.mock('../../../utils/goalsService', () => ({
    fetchGoals: jest.fn().mockResolvedValue([]),
    createGoal: jest.fn(),
    updateGoal: jest.fn(),
    deleteGoal: jest.fn(),
}));

const fetchAreasMock = fetchAreas as jest.MockedFunction<typeof fetchAreas>;

type AreasRequest = {
    resolve: (areas: Area[]) => void;
    reject: (error: Error) => void;
};

const homeArea: Area = {
    id: 1,
    uid: 'area_home',
    name: 'Home',
};

const resetAreas = () => {
    const state = useStore.getState();
    useStore.setState({
        areasStore: {
            ...state.areasStore,
            areas: [],
            isLoading: false,
            isError: false,
            hasLoaded: false,
        },
        projectsStore: {
            ...state.projectsStore,
            projects: [],
            currentProject: null,
            isLoading: false,
            isError: false,
            hasLoaded: false,
        },
        tasksStore: {
            ...state.tasksStore,
            tasks: [],
            isLoading: false,
            isError: false,
        },
    });
};

const renderAreaPage = (uidSlug: string) =>
    render(
        <MemoryRouter initialEntries={[`/area/${uidSlug}`]}>
            <Routes>
                <Route path="/area/:uidSlug" element={<AreaDetails />} />
            </Routes>
        </MemoryRouter>
    );

const settle = async () => {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
    });
};

describe('AreaDetails areas loading', () => {
    let areasRequests: AreasRequest[];

    beforeEach(() => {
        areasRequests = [];
        fetchAreasMock.mockImplementation(
            () =>
                new Promise((resolve, reject) => {
                    areasRequests.push({ resolve, reject });
                })
        );
        resetAreas();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const finishAreasRequest = async (areas: Area[]) => {
        await act(async () => {
            areasRequests[0].resolve(areas);
        });
    };

    it('shows Area not found for an unknown uid when there are no areas, and requests areas once', async () => {
        renderAreaPage('missing');

        await waitFor(() => expect(fetchAreasMock).toHaveBeenCalledTimes(1));
        await finishAreasRequest([]);

        expect(await screen.findByText('Area not found')).toBeInTheDocument();
        await settle();
        expect(fetchAreasMock).toHaveBeenCalledTimes(1);
    });

    it('shows an area that exists', async () => {
        renderAreaPage('area_home');

        await waitFor(() => expect(fetchAreasMock).toHaveBeenCalledTimes(1));
        await finishAreasRequest([homeArea]);

        expect(
            await screen.findByRole('heading', { name: 'Home' })
        ).toBeInTheDocument();
        await settle();
        expect(fetchAreasMock).toHaveBeenCalledTimes(1);
    });
});
