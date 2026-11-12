import { useEffect, useState } from 'react';

interface UseDateDraftOptions {
    /** Re-seed the draft whenever `source` changes. */
    syncWithSource: boolean;
}

/** Edit-mode flag and draft value for a date card, seeded from the task's value. */
export const useDateDraft = (
    source: string | undefined,
    { syncWithSource }: UseDateDraftOptions
) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState<string>(source || '');

    useEffect(() => {
        if (syncWithSource) {
            setDraft(source || '');
        }
    }, [source, syncWithSource]);

    return { isEditing, setIsEditing, draft, setDraft };
};
