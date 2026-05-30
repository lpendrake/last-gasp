import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from './confirm-dialog';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface AlertOptions {
  title?: string;
  message: string;
  okLabel?: string;
}

interface DialogState {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  okLabel?: string;
  danger?: boolean;
  mode: 'confirm' | 'alert';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  }
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (resolverRef.current) {
        const prev = resolverRef.current;
        resolverRef.current = null;
        prev(false);
      }
      resolverRef.current = resolve;
      setDialog({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'OK',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        danger: options.danger,
        mode: 'confirm',
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (resolverRef.current) {
        const prev = resolverRef.current;
        resolverRef.current = null;
        prev(false);
      }
      resolverRef.current = (value: boolean) => {
        void value;
        resolve();
      };
      setDialog({
        title: options.title,
        message: options.message,
        okLabel: options.okLabel ?? 'OK',
        mode: 'alert',
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolve?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolve?.(false);
  }, []);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        const r = resolverRef.current;
        resolverRef.current = null;
        r(false);
      }
    };
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          okLabel={dialog.okLabel}
          danger={dialog.danger}
          mode={dialog.mode}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}
