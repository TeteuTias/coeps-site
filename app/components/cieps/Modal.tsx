'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button, cx } from './ui';

export default function Modal({
  open,
  title,
  description,
  children,
  onClose,
  footer,
  className,
  closeLabel = 'Fechar janela',
}: {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  className?: string;
  closeLabel?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="cieps-modal-layer">
      <button className="cieps-modal-backdrop" type="button" onClick={onClose} aria-label={closeLabel} />
      <div
        ref={dialogRef}
        className={cx('cieps-modal-card', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <Button variant="ghost" className="cieps-modal-close" onClick={onClose} aria-label={closeLabel}>
          <X size={20} aria-hidden="true" />
        </Button>
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
