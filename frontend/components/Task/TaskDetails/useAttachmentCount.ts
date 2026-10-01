import { useEffect, useState } from 'react';
import { fetchAttachments } from '../../../utils/attachmentsService';

export const useAttachmentCount = (taskUid: string | undefined): number => {
    const [attachmentCount, setAttachmentCount] = useState(0);

    useEffect(() => {
        const loadAttachmentCount = async () => {
            if (!taskUid) {
                setAttachmentCount(0);
                return;
            }

            try {
                const attachments = await fetchAttachments(taskUid);
                setAttachmentCount(attachments.length);
            } catch (error) {
                console.error('Error loading attachment count:', error);
            }
        };

        loadAttachmentCount();
    }, [taskUid]);

    return attachmentCount;
};
