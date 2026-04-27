import React from 'react';

const LoadingSpinner: React.FC<{ size?: number; label?: string }> = ({ size = 48, label }) => {
    const s = size;
    return (
        <div className="w-full min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div
                    className="animate-spin rounded-full border-4 border-t-transparent"
                    style={{ width: s, height: s, borderTopColor: 'var(--tw-color-primary, #6366f1)', borderColor: 'rgba(99,102,241,0.15)' }}
                />
                {label && <div className="text-sm text-muted-foreground">{label}</div>}
            </div>
        </div>
    );
};

export default LoadingSpinner;
