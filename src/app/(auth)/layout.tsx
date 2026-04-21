/**
 * Auth layout — used by /login and any other auth-related pages.
 * Centered content, no sidebar/topbar.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-white dark:from-gray-900 dark:to-gray-800">
      {children}
    </div>
  );
}
