import type { ReactNode } from 'react';
import './footer-button.css';

interface FooterButtonProps {
  variant?: 'primary' | 'default';
  onClick: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  children: ReactNode;
  title?: string;
}

export function FooterButton({
  variant = 'default',
  onClick,
  onMouseDown,
  children,
  title,
}: FooterButtonProps) {
  return (
    <button
      className={`footer-btn${variant === 'primary' ? ' footer-btn--primary' : ''}`}
      onClick={onClick}
      onMouseDown={onMouseDown}
      title={title}
    >
      {children}
    </button>
  );
}
