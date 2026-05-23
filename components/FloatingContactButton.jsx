'use client';
import { useState } from 'react';
import ContactModal from '@/components/ContactModal';

export default function FloatingContactButton() {
  const [isOpen, setIsOpen] = useState(false);

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
