import Link from 'next/link';
import './globals.css';

export const metadata = { title: 'ReturnDesk' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/requests" className="text-lg font-semibold">ReturnDesk</Link>
            <Link href="/requests/new" className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
              New request
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}