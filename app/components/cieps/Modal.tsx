'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button, cx } from './ui';

type ModalBaseProps = {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  closeLabel?: string;
};

type ModalProps = ModalBaseProps & (
  | {
      dismissible?: true;
      onClose: () => void;
    }
  | {
      dismissible: false;
      onClose?: never;
    }
);

const subscribeToClientReady = () => () => undefined;
const getClientReadySnapshot = () => true;
const getServerReadySnapshot = () => false;

export default function Modal({
  open,
  title,
  description,
  children,
  onClose,
  footer,
  className,
  closeLabel = 'Fechar janela',
  dismissible = true,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const mounted = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !mounted) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';

    const getFocusableElements = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dismissible) onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || activeElement === dialog)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => dialog.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [dismissible, mounted, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="cieps-modal-layer">
      {dismissible ? (
        <button className="cieps-modal-backdrop" type="button" onClick={onClose} aria-label={closeLabel} />
      ) : (
        <div className="cieps-modal-backdrop" aria-hidden="true" />
      )}
      <div
        ref={dialogRef}
        className={cx('cieps-modal-card', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        {dismissible && (
          <Button variant="ghost" className="cieps-modal-close" onClick={onClose} aria-label={closeLabel}>
            <X size={20} aria-hidden="true" />
          </Button>
        )}
        <header>
          <h2 id={titleId} className="cieps-display text-3xl font-semibold leading-tight text-tinta">{title}</h2>
          {description && <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted">{description}</p>}
        </header>
        {children && <div className="cieps-modal-content">{children}</div>}
        {footer && <footer className="cieps-modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
