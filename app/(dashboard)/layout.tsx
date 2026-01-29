"use client";

import { useState, useEffect } from "react";
import { MainNav } from "@/components/layout/main-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b">
        <div className="flex items-center px-4 py-4 relative">
          <div className="absolute left-4">
            <SidebarNav />
          </div>
          <h1 className="text-xl font-bold flex-1 text-center">Expense Tracker</h1>
          <div className="absolute right-4 hidden md:block">
            {mounted ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    Logout
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to logout? You'll need to sign in again to access your account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout}>
                      Logout
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button variant="ghost" size="sm">
                Logout
              </Button>
            )}
          </div>
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
