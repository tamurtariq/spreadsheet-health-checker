import '../styles/components.css';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  message?: string;
}

export default function UpgradeModal({ open, onClose, message }: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title">
        <svg className="modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h3 id="upgrade-modal-title">Upgrade to Pro</h3>
        <p>{message ?? "We're finishing up billing so you can upgrade in-app. In the meantime, reach out and we'll get you set up directly."}</p>
        <div className="modal-actions">
          <button className="modal-close-btn" onClick={onClose}>Maybe Later</button>
        </div>
      </div>
    </div>
  );
}
