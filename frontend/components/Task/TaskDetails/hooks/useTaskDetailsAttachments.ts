import { useEffect, useState } from 'react';
import { fetchAttachments } from '../../../../utils/attachmentsService';

/** Attachment count for the header badge, shown on every tab. */
export const useTaskDetailsAttachments = (taskUid: string | undefined) => {
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

    return { attachmentCount, setAttachmentCount };
};
