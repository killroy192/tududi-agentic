import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskDetailsAttachments from '../TaskDetailsAttachments';
import { fetchAttachments } from '../../../../utils/attachmentsService';
import { Attachment } from '../../../../entities/Attachment';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback: string) => fallback }),
}));

jest.mock('../../../../utils/attachmentsService', () => ({
    fetchAttachments: jest.fn(),
    uploadAttachment: jest.fn(),
    deleteAttachment: jest.fn(),
    downloadAttachment: jest.fn(),
    validateFile: jest.fn(),
    getAttachmentType: jest.fn(),
}));

jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

const buildAttachment = (uid: string): Attachment =>
    ({
        uid,
        original_filename: `${uid}.png`,
        mime_type: 'image/png',
    }) as Attachment;

describe('TaskDetailsAttachments', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('loads attachments for the given task and reports the count via callback', async () => {
        const attachments = [buildAttachment('a-1'), buildAttachment('a-2')];
        (fetchAttachments as jest.Mock).mockResolvedValue(attachments);
        const onAttachmentsCountChange = jest.fn();

        render(
            <TaskDetailsAttachments
                taskUid="task-1"
                onAttachmentsCountChange={onAttachmentsCountChange}
            />
        );

        await waitFor(() =>
            expect(fetchAttachments).toHaveBeenCalledWith('task-1')
        );
        await waitFor(() =>
            expect(onAttachmentsCountChange).toHaveBeenCalledWith(2)
        );
        expect(screen.getByText('Attachments (2)')).toBeInTheDocument();
    });

    it('reports zero attachments when the task has none', async () => {
        (fetchAttachments as jest.Mock).mockResolvedValue([]);
        const onAttachmentsCountChange = jest.fn();

        render(
            <TaskDetailsAttachments
                taskUid="task-1"
                onAttachmentsCountChange={onAttachmentsCountChange}
            />
        );

        await waitFor(() =>
            expect(onAttachmentsCountChange).toHaveBeenCalledWith(0)
        );
    });
});
