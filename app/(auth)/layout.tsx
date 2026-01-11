/**
 * Auth Layout - Public pages (login)
 * No sidebar or header, just the content
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
