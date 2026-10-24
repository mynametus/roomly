import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, subtitle, onClose, children, className = "" }: {
  title: string; subtitle: string; onClose: () => void; children: ReactNode; className?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal-card ${className}`}>
      <div className="modal-heading"><div><h2 id={titleId}>{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Đóng" onClick={onClose}><X size={19} /></button></div>{children}
    </section>
  </div>;
}
