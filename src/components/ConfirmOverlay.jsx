import { FiAlertTriangle, FiHelpCircle, FiX } from "react-icons/fi";

const ConfirmOverlay = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure?",
  confirmText = "Yes",
  cancelText = "Cancel",
  danger = false,
  confirmButtonClassName,
  icon,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Animated Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-[360px] p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ease-out">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors"
        >
          <FiX size={20} />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Icon Header */}
          <div
            className={`mb-6 p-4 rounded-3xl ${
              danger
                ? "bg-red-50 dark:bg-red-900/20 text-red-500"
                : "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
            }`}
          >
            {icon ??
              (danger ? (
                <FiAlertTriangle size={32} />
              ) : (
                <FiHelpCircle size={32} />
              ))}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
            {title}
          </h2>

          {/* Message */}
          <div className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 px-2">
            {message}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col w-full gap-3">
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className={
                confirmButtonClassName ??
                `w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 ${
                  danger
                    ? "bg-red-500 hover:bg-red-600 shadow-red-200 dark:shadow-none"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none"
                }`
              }
            >
              {confirmText}
            </button>

            {cancelText && (
              <button
                onClick={onClose}
                className="w-full py-4 rounded-2xl font-bold text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                {cancelText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmOverlay;
