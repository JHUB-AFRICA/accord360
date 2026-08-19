import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="public-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="public-header">
        <Link className="public-brand" to="/">
          <span className="brand-mark">A</span>
          <span><strong>Accord360</strong><small>Directorate of Linkages (RPE)</small></span>
        </Link>
        <button className="icon-button public-menu-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Open navigation">{open ? <X /> : <Menu />}</button>
        <nav className={`public-nav ${open ? "public-nav-open" : ""}`}>
          <NavLink to="/#about">About Linkages</NavLink>
          <NavLink to="/#agreement-types">Agreement Types</NavLink>
          <NavLink to="/#process">Process</NavLink>
          <NavLink to="/#eligibility">Eligibility</NavLink>
          <NavLink to="/#faq">FAQs</NavLink>
          <Link className="secondary-button compact-button" to="/login">Sign in</Link>
          <Link className="primary-button compact-button" to="/partner/register">Start partnership <ArrowRight size={16} /></Link>
        </nav>
      </header>
      <main id="main-content"><Outlet /></main>
      <footer className="public-footer">
        <div className="public-footer-grid">
          <div><div className="public-brand footer-brand"><span className="brand-mark">A</span><span><strong>Accord360</strong><small>Directorate of Linkages (RPE)</small></span></div><p>Supporting transparent, accountable and measurable institutional partnerships at Jomo Kenyatta University of Agriculture and Technology.</p></div>
          <div><h3>Resources</h3><a href="#agreement-types">Agreement types</a><a href="#process">Partnership process</a><a href="#eligibility">Eligibility guidance</a></div>
          <div><h3>Policies</h3><span>Intellectual Property Policy</span><span>Data Protection Policy</span><span>Governing Statutes</span></div>
          <div><h3>Contact</h3><span>Official contact to be confirmed</span><span>Official location to be confirmed</span><Link to="/login">System help</Link></div>
        </div>
        <div className="footer-bottom"><span>© 2026 Jomo Kenyatta University of Agriculture and Technology</span><span>Demonstration data for prototype purposes</span></div>
      </footer>
    </div>
  );
}
