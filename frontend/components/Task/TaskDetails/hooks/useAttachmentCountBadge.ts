import { useEffect, useState } from 'react';
import { fetchAttachments } from '../../../../utils/attachmentsService';

/**
 * Tracks the attachment count shown as a badge on the header's Attachments
 * pill. Loaded independently of the Attachments tab itself so the badge is
 * visible before the user ever opens that tab.
 */
export function useAttachmentCountBadge(taskUid: string | undefined) {
    const [attachmentCount, setAttachmentCount] = useState(0);

    useEffect(() => {
        const loadAttachmentCount = async () => {
            if (taskUid) {
                try {
                    const attachments = await fetchAttachments(taskUid);
                    setAttachmentCount(attachments.length);
                } catch (error) {
                    console.error('Error loading attachment count:', error);
                }
            }
        };

        loadAttachmentCount();
    }, [taskUid]);

    return [attachmentCount, setAttachmentCount] as const;
}
