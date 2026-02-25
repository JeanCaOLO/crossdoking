
import { useState, useEffect, useCallback, createContext, useContext } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let globalToastId = 0;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const iconMap: Record<ToastType, { icon: string; bg: string; border: string; iconColor: string; titleColor: string }> = {
  success: {
    icon: 'ri-checkbox-circle-fill',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-500',
    titleColor: 'text-emerald-900',
  },
  error: {
    icon: 'ri-error-warning-fill',
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
    titleColor: 'text-red-900',
  },
  warning: {
    icon: 'ri-alert-fill',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-900',
  },
  info: {
    icon: 'ri-information-fill',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    iconColor: 'text-sky-500',
    titleColor: 'text-sky-900',
  },
};

function ToastItemComponent({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const style = iconMap[toast.type];

  const handleRemove = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  }, [toast.id, onRemove]);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    const timer = setTimeout(handleRemove, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [handleRemove, toast.duration]);

  return (
    <div
      className={`
        flex items-start gap-3 w-[380px] px-4 py-3.5 rounded-xl border shadow-lg backdrop-blur-sm
        transition-all duration-300 ease-out cursor-pointer
        ${style.bg} ${style.border}
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
      `}
      onClick={handleRemove}
    >
      <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <i className={`${style.icon} text-lg ${style.iconColor}`}></i>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${style.titleColor}`}>{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); handleRemove(); }}
        className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        <i className="ri-close-line text-sm"></i>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = ++globalToastId;
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5">
        {toasts.map((toast) => (
          <ToastItemComponent key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
