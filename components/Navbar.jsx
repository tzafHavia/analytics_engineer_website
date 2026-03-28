'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/payments', label: 'Payments' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo — icon doubles as theme toggle on mobile */}
        <div className="navbar-logo-group">
          <button onClick={toggle} className="logo-icon-btn" aria-label="Toggle theme">
            <span className="logo-icon">📊</span>
          </button>
          <Link href="/" className="navbar-logo-text">
            <span className="logo-text">DataPortfolio</span>
          </Link>
        </div>

        {/* Links */}
        <div className="navbar-links">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname === link.href ? 'nav-link-active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Theme toggle — desktop only */}
        <button onClick={toggle} className="theme-toggle" aria-label="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Badge */}
        <div className="navbar-badge">
          <span className="badge-dot" />
          <span>Live Data</span>
        </div>
      </div>
    </nav>
  );
}
