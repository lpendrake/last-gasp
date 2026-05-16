import type { ReactNode } from 'react';
import './footer-button.css';

type FooterButtonVariant = 'default' | 'primary' | 'active';

interface FooterButtonProps {
  variant?: FooterButtonVariant;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}

const VARIANT_CLASS: Record<FooterButtonVariant, string> = {
  default: '',
  primary: ' footer-btn--primary',
  active: ' footer-btn--active',
};

export function FooterButton({ variant = 'default', onClick, children, title }: FooterButtonProps) {
  return (
    <button className={`footer-btn${VARIANT_CLASS[variant]}`} onClick={onClick} title={title}>
      {children}
    </button>
  );
}
