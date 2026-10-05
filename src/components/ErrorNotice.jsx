export default function ErrorNotice({ children, onClose, variant = 'error' }) {
  if (!children) return null;
  const success = variant === 'success';
  return (
    <div className={`notice ${success ? 'notice-success' : 'notice-error'}`} role={success ? 'status' : 'alert'}>
      <span>{children}</span>
      {onClose && <button className="notice-close" aria-label={success ? 'Dismiss message' : 'Dismiss error'} onClick={onClose}>×</button>}
    </div>
  );
}
