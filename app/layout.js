import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import ThemeProvider from '@/components/ThemeProvider';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata = {
  title: 'DataPortfolio | Analytics Projects',
  description: 'Fullstack data analytics portfolio built with Next.js and Supabase',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
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
              </p>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
