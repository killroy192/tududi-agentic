import { useEffect } from 'react';
import { useStore } from '../../../../store/useStore';

export const useTaskDetailsStoresBootstrap = () => {
    const tagsStore = useStore((state) => state.tagsStore);
    const areasStore = useStore((state) => state.areasStore);
    const projectsStore = useStore((state) => state.projectsStore);

    useEffect(() => {
        if (!tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }
    }, [tagsStore.hasLoaded, tagsStore.isLoading, tagsStore]);

    useEffect(() => {
        if (!areasStore.hasLoaded && !areasStore.isLoading) {
            areasStore.loadAreas();
        }
    }, [areasStore.hasLoaded, areasStore.isLoading, areasStore]);

    return { tagsStore, areasStore, projectsStore };
};
