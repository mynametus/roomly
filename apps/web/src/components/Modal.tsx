import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { T, translate } from "../i18n";

export function Modal({ title, subtitle, onClose, children, className = "" }: {
  title: string; subtitle: ReactNode; onClose: () => void; children: ReactNode; className?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal-card ${className}`}>
      <div className="modal-heading"><div><h2 id={titleId}><T>{title}</T></h2><p>{typeof subtitle === "string" ? <T>{subtitle}</T> : subtitle}</p></div><button className="icon-button" aria-label={translate("Đóng")} onClick={onClose}><X size={19} /></button></div>{children}
    </section>
  </div>;
}
