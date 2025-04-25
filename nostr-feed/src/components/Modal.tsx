import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Modal({ isOpen, onClose, children, title }: ModalProps) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    // Cleanup when component unmounts
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Add escape key listener
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Memoize handlers with useCallback to avoid recreating functions on each render
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the clicked element is exactly the backdrop
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // This handler is no longer needed since we're not stopping propagation
  // Clicks on the modal content will naturally not reach the backdrop
  
  const handleCloseButtonClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // Use React Portal to render modal directly to document.body
  // This ensures it's outside the DOM hierarchy of the blog card
  return createPortal(
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        <div className="modal-header">
          {title && <h2>{title}</h2>}
          <button className="modal-close-btn" onClick={handleCloseButtonClick}>×</button>
        </div>
        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
} 