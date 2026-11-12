import React, { forwardRef, useImperativeHandle } from 'react';

type Props = Record<string, any>;

/** Latest props each stubbed child received, keyed by component name. */
export const cardProps: Record<string, Props> = {};

/** Every render's props for the header, oldest first. */
export const headerPropsHistory: Props[] = [];

export const toast = {
    showSuccessToast: jest.fn(),
    showErrorToast: jest.fn(),
};

export const aiActivate = jest.fn();

export const resetCardProps = () => {
    Object.keys(cardProps).forEach((key) => delete cardProps[key]);
    headerPropsHistory.length = 0;
};

export const stubModule = (name: string) => ({
    __esModule: true,
    default: (props: Props) => {
        cardProps[name] = props;
        return <div data-testid={name} />;
    },
});

export const headerModule = () => ({
    __esModule: true,
    default: (props: Props) => {
        cardProps.TaskDetailsHeader = props;
        headerPropsHistory.push(props);
        return (
            <div data-testid="TaskDetailsHeader">
                <button data-overdue-toggle="true">overdue-toggle</button>
                {props.isOverdueAlertVisible && <span>overdue-bubble</span>}
            </div>
        );
    },
});

export const aiInsightsModule = () => {
    const TaskAIInsightsStub = forwardRef<{ activate: () => void }, Props>(
        (props, ref) => {
            cardProps.TaskAIInsights = props;
            useImperativeHandle(ref, () => ({ activate: aiActivate }));
            return <div data-testid="TaskAIInsights" />;
        }
    );
    TaskAIInsightsStub.displayName = 'TaskAIInsightsStub';
    return { __esModule: true, default: TaskAIInsightsStub };
};

export const confirmDialogModule = () => ({
    __esModule: true,
    default: ({ onConfirm, onCancel }: Props) => (
        <div>
            <button onClick={onConfirm}>confirm-delete</button>
            <button onClick={onCancel}>cancel-delete</button>
        </div>
    ),
});
