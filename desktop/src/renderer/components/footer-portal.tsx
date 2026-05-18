import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type FooterSlot = 'left' | 'center' | 'right' | 'far-left';

interface FooterPortalProps {
  children: React.ReactNode;
  slot?: FooterSlot;
}

export function FooterPortal({ children, slot = 'right' }: FooterPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const target = document.getElementById(`footer-slot-${slot}`);
  if (!target) return null;

  return createPortal(children, target);
}
