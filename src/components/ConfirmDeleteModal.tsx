import React from 'react';

export interface DeleteConfirmationRequest {
  type: 'service' | 'widget' | 'reset_all';
  targetId?: string;
  question: string;
}

interface ConfirmDeleteModalProps {
  request: DeleteConfirmationRequest | null;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  request,
  isDark,
  onCancel,
  onConfirm,
}) => {
  if (!request) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
    >
      <div
        className={`w-full max-w-sm rounded-xl border p-6 shadow-xl text-center ${
          isDark
            ? 'bg-[#0F172A] border-slate-700 text-slate-100'
            : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        <h2
          id="confirm-delete-title"
          className="text-base font-bold leading-snug"
        >
          {request.question}
        </h2>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onConfirm}
            data-testid="confirm-delete-submit"
            className="min-w-24 px-5 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors cursor-pointer"
          >
            Так
          </button>
          <button
            type="button"
            onClick={onCancel}
            data-testid="confirm-delete-cancel"
            className={`min-w-24 px-5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-800'
                : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200'
            }`}
          >
            Ні
          </button>
        </div>
      </div>
    </div>
  );
};
