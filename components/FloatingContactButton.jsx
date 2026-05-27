'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import ContactModal from '@/components/ContactModal';

// Pages that have their own lead modal — hide the generic floating button there.
const HIDDEN_ON = ['/crm'];

export default function FloatingContactButton() {
  const [isOpen, setIsOpen] = useState(false);
  // `mounted` prevents SSR/CSR hydration mismatch:
  // server always renders null; after mount the button appears (or not) based on pathname.
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || HIDDEN_ON.includes(pathname)) return null;

  return (
    <>
      <button
        className="floating-contact-btn"
        onClick={() => setIsOpen(true)}
        aria-label="Leave your details"
        title="Leave your details"
      >
        <span className="floating-contact-icon">💬</span>
        <span className="floating-contact-label">Contact</span>
      </button>

      <ContactModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
