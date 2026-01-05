import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import styles from './Toast.module.css';

interface ToastMessage {
    id: number;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
}

interface ToastContextType {
    showToast: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
    showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        // Fallback to native if not in provider
        return {
            showToast: (message: string) => console.log(message),
            showConfirm: async (options: ConfirmOptions) => confirm(options.message)
        };
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [confirmState, setConfirmState] = useState<{
        visible: boolean;
        options: ConfirmOptions;
        resolve: ((value: boolean) => void) | null;
    }>({
        visible: false,
        options: { title: '', message: '' },
        resolve: null
    });

    const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmState({
                visible: true,
                options,
                resolve
            });
        });
    }, []);

    const handleConfirm = (result: boolean) => {
        if (confirmState.resolve) {
            confirmState.resolve(result);
        }
        setConfirmState({
            visible: false,
            options: { title: '', message: '' },
            resolve: null
        });
    };

    return (
        <ToastContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* Toast Container */}
            <div className={styles.toastContainer}>
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`${styles.toast} ${styles[toast.type]}`}
                        onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    >
                        <span className={styles.icon}>
                            {toast.type === 'success' && '✓'}
                            {toast.type === 'error' && '✕'}
                            {toast.type === 'warning' && '⚠'}
                            {toast.type === 'info' && 'ℹ'}
                        </span>
                        <span className={styles.message}>{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Confirm Modal */}
            {confirmState.visible && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>{confirmState.options.title}</h3>
                        <p className={styles.modalMessage}>{confirmState.options.message}</p>
                        <div className={styles.modalButtons}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => handleConfirm(false)}
                            >
                                {confirmState.options.cancelText || 'Cancel'}
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={() => handleConfirm(true)}
                            >
                                {confirmState.options.confirmText || 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    );
}
