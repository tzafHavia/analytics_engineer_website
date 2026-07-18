import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import ThemeProvider from '@/components/ThemeProvider';
import FloatingContactButton from '@/components/FloatingContactButton';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata = {
  title: 'Zafrir Havia — Analytics Engineer | Portfolio',
  description:
    'Analytics Engineer building end-to-end analytics platforms: Python EL → dbt → Supabase → live Next.js dashboards, on real retail data.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <div className="app-wrapper">
            {/* Animated background blobs */}
            <div className="bg-blob bg-blob-1" />
            <div className="bg-blob bg-blob-2" />
            <div className="bg-blob bg-blob-3" />

            <Navbar />
            <main className="main-content">{children}</main>

            <footer className="footer">
              <p>
                Engineered by <strong>Zafrir Havia</strong> · Transforming raw data into decisions —
                built with <span className="footer-heart">♥</span> using{' '}
                <strong>Next.js</strong>, <strong>dbt</strong> &amp; <strong>Supabase</strong>
                {' · '}
                <a href="https://github.com/tzafHavia" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
                {' · '}
                <a
                  href="https://www.linkedin.com/in/zafrir-havia-409b5323a"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              </p>
            </footer>

            <FloatingContactButton />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
