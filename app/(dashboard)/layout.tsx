"use client";

import { MainNav } from "@/components/layout/main-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <SidebarNav />
            <h1 className="text-xl font-bold">Expense Tracker</h1>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Desktop Sidebar (toggleable) */}
      <MainNav />

      {/* Main Content - no left padding since sidebar is overlay */}
      <main className="pt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
