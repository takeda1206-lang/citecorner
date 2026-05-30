export default function Header({ children }) {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">C</div>
        <div className="brand-name">CiteCorner</div>
      </div>
      <div className="header-actions">{children}</div>
    </header>
  );
}
