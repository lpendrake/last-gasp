import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function FooterPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const target = document.getElementById('footer-portal-target');
  if (!target) return null;

  return createPortal(children, target);
}
