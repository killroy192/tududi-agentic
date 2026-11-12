import { useEffect } from 'react';
import { useStore } from '../../../../store/useStore';

/** Loads tags and areas once, if they haven't loaded and aren't loading. */
export const useLazyTaskMetadata = () => {
    const tagsStore = useStore((state) => state.tagsStore);
    const areasStore = useStore((state) => state.areasStore);

    useEffect(() => {
        if (!tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }
    }, [tagsStore.hasLoaded, tagsStore.isLoading]);

    useEffect(() => {
        if (!areasStore.hasLoaded && !areasStore.isLoading) {
            areasStore.loadAreas();
        }
    }, [areasStore.hasLoaded, areasStore.isLoading]);
};
