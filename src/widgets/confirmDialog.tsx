// components/common/ConfirmDialog.tsx
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

type ConfirmDialogProps = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'error' | 'success' | 'warning' | 'info';
  onConfirm?: () => void;
  onCancel?: () => void;
};

const headerColorMap = {
  error: 'bg-red-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-500',
  info: 'bg-blue-600',
};

const buttonColorMap = {
  error: 'bg-red-400 hover:bg-red-600',
  success: 'bg-green-400 hover:bg-green-600',
  warning: 'bg-yellow-400 hover:bg-yellow-600',
  info: 'bg-blue-400 hover:bg-blue-600',
};

export const showConfirmDialog = ({
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  type = 'info',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const isInfoOnly = !onConfirm;
  const headerClass = headerColorMap[type] || headerColorMap.info;
  const buttonClass = buttonColorMap[type] || buttonColorMap.info;

  const headerText = title || type.charAt(0).toUpperCase() + type.slice(1);

  confirmAlert({
    overlayClassName:
      'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50',
    customUI: ({ onClose }) => {
      return (
        <div className="bg-white rounded-md shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden">
          {/* Header Band */}
          <div className={`${headerClass} text-white px-4 py-2 font-semibold text-center`}>
            {headerText}
          </div>

          {/* Body */}
          <div className="p-6 text-center">
            {message && <p className="text-gray-700 mb-5">{message}</p>}
            {!message && <p className="text-gray-700 mb-5">An error has occured</p>}
            <div className="flex justify-center gap-4">
              {isInfoOnly ? (
                <button
                  onClick={() => {
                    onClose();
                    onCancel?.();
                  }}
                  className={`px-4 py-2 rounded text-white transition ${buttonClass}`}
                >
                  {confirmText}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onClose();
                      onCancel?.();
                    }}
                    className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      onConfirm?.();
                    }}
                    className={`px-4 py-2 rounded text-white transition ${buttonClass}`}
                  >
                    {confirmText}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      );
    },
  });
};
