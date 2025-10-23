import React, { useEffect } from 'react';
import { Toast } from '@ui5/webcomponents-react';

const Notification = ({ message, open, duration = 3000, onClose }) => {
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [open, duration, onClose]);

  if (!open || !message) return null;
  return (
    <div className="notification-toast">
      <ui5-icon name="message-error" style={{ marginRight: '8px' }}></ui5-icon>
      {message}
    </div>
  );
};

export default Notification;
