'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/projects/convenience-store/dashboard', label: 'Executive Dashboard' },
  { href: '/dbt-docs/index.html', label: 'dbt Docs', external: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
          {navLinks.map((link) =>
            link.external ? (
              // Static asset (dbt docs) — plain <a> so the Next router doesn't intercept it
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="nav-link">
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${mounted && pathname === link.href ? 'nav-link-active' : ''}`}
              >
                {link.label}
              </Link>
            )
          )}
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
