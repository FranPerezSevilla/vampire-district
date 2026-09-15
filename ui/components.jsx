import * as Dialog from "@radix-ui/react-dialog";

export function Icon({ name = "arrow", ...props }) {
  const paths = { moon: "M19 15a8 8 0 0 1-10-10A8 8 0 1 0 19 15ZM17 3v4m-2-2h4", arrow: "M12 3 4 20l8-4 8 4-8-17Z", city: "M3 20V8h5V3h8v8h5v9M8 20V8m8 12v-9M5 12h1m4-5h1m2 0h1m-4 4h1m2 0h1m-4 4h1m2 0h1m5 0h1", blood: "M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z", close: "m6 6 12 12M6 18 18 6", eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z", check: "m4 12 5 5L20 6", people: "M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9v-3c0-3 12-3 12 0v3m2-16a4 4 0 0 1 0 8m2 3c4 0 4 2 4 5", brief: "M3 8h18v12H3V8Zm5 0V4h8v4M3 13h18m-11 0v3h4v-3", menu: "M4 6h16M4 12h16M4 18h16", crown: "m3 7 5 5 4-8 4 8 5-5-2 13H5L3 7Z" };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.arrow}/></svg>;
}
export function Button({ children, primary, danger, icon, className = "", ...props }) {
  return <button type="button" className={`vb-button ${primary ? "primary" : ""} ${danger ? "danger" : ""} ${className}`} {...props}>{icon && <Icon name={icon}/>}<span>{children}</span></button>;
}
export function Badge({ children, tone = "neutral" }) { return <span className={`vb-badge ${tone}`}>{children}</span>; }
export function Metric({ label, value, detail }) { return <div className="vb-metric"><small>{label}</small><strong>{value}</strong>{detail && <span>{detail}</span>}</div>; }
export function Meter({ value = 0, label, max = 100, danger = false }) {
  const percent = Math.max(0, Math.min(100, value / max * 100));
  return <div className={`vb-meter ${danger ? "danger" : ""}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${percent}%` }}/></div>;
}
export function Empty({ title, children, action }) { return <div className="vb-empty"><Icon name="brief"/><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>; }
export function Locations({ target, command, disabled }) {
  return <div className="vb-actions"><Button primary icon="arrow" disabled={disabled} onClick={() => command("go", { target })}>Go here</Button><Button icon="eye" disabled={disabled} onClick={() => command("locate", { target })}>Locate</Button></div>;
}
export function Requirements({ items = [] }) {
  return <ul className="vb-requirements">{items.map((item, i) => <li key={i} data-complete={item.met}><span aria-hidden="true">{item.met ? "✓" : "○"}</span><span>{item.text}</span></li>)}</ul>;
}
export function Window({ title, description, children, overlay, close, wide, initialFocus }) {
  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}>
    <Dialog.Portal container={overlay}>
      <Dialog.Overlay className="vb-scrim"/>
      <Dialog.Content className={`vb-window ${wide ? "wide" : ""}`} data-viceblood-ui="dialog"
        {...(description ? {} : { "aria-describedby": undefined })}
        onEscapeKeyDown={event => { event.preventDefault(); close(); }}
        onPointerDownOutside={event => event.preventDefault()}
        onCloseAutoFocus={event => { event.preventDefault(); document.querySelector("#game-root canvas")?.focus({ preventScroll: true }); }}
        onOpenAutoFocus={initialFocus ? event => { event.preventDefault(); initialFocus.current?.focus(); } : undefined}>
        <header className="vb-window-head"><div><span className="vb-wordmark">VICE<span>BLOOD</span></span><Dialog.Title>{title}</Dialog.Title>{description && <Dialog.Description>{description}</Dialog.Description>}</div><Button icon="close" aria-label="Close window" onClick={close}><kbd>Esc</kbd></Button></header>
        <div className="vb-window-body">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
