import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'OnCall Admin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-gray-900 hover:text-blue-600">
            OnCall Admin
          </Link>
          <Link
            href="/submissions/new"
            className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + New Submission
          </Link>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
