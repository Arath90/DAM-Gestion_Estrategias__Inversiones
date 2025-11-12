import React from 'react';
import { TRADE_MODES, priceFormatter } from '../../constants/marketConstants';
import { formatConfidence } from '../../utils/marketUtils';
import '../../assets/css/components/NotificationTray.css';
import '../../assets/css/components/SharedMarketComponents.css';

/**
 * Bandeja de notificaciones con el historial de señales recientes
 */
const NotificationTray = ({ notifications, tradeMode }) => {
  return (
    <section className="notification-tray">
      <header>
        <h3>Señales recientes</h3>
        <span>{tradeMode === TRADE_MODES.auto ? 'Modo automático' : 'Modo aviso'}</span>
      </header>
      {!notifications.length ? (
        <p className="empty-state">Aún no se detectan señales para este set de filtros.</p>
      ) : (
        <ul className="notification-list">
          {notifications.map((item) => (
            <li key={item.id} className={`notification-item ${item.action.toLowerCase()}`}>
              <div className="notification-item-head">
                <span className="badge">{item.action}</span>
                <span className="timestamp">
                  {new Date(item.ts * 1000).toLocaleString()}
                </span>
              </div>
              <div className="notification-item-body">
                <strong>{item.symbol}</strong>
                <span>
                  @ {priceFormatter.format(item.price ?? 0)} | {item.interval}
                </span>
              </div>
              <div className="notification-item-reasons">{item.reasons.join(' | ')}</div>
              <div className="notification-item-meta">
                <span>Confianza {formatConfidence(item.confidence)}</span>
                <span>{item.mode === TRADE_MODES.auto ? 'Auto' : 'Aviso'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default NotificationTray;