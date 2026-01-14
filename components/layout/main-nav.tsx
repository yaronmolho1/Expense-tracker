"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Menu, X, LogOut } from "lucide-react";
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
import { navSections } from "./nav-items";
import { cn } from "@/lib/utils";

export function MainNav() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "Main",
    "Manage",
    "Reports",
  ]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title)
        ? prev.filter((s) => s !== title)
        : [...prev, title]
    );
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <>
      {/* Desktop Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hidden md:flex fixed top-4 left-4 z-50"
      >
        {sidebarOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:w-64 md:flex-col md:border-r md:bg-white md:fixed md:inset-y-0 md:pt-16 transition-transform duration-300 ease-in-out z-40",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="flex flex-col p-4 h-full">
          <div className="flex-1 overflow-y-auto">
            {navSections.map((section) => {
              const isExpanded = expandedSections.includes(section.title);

              return (
                <div key={section.title} className="mb-2">
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
                  >
                    {section.title}
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {/* Section Items */}
                  {isExpanded && (
                    <div className="ml-3 mt-1 flex flex-col gap-1 border-l pl-3">
                      {section.items.map((item) => {
                        const isActive = pathname === item.href;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "rounded-md px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Logout at bottom */}
          <div className="pt-4 border-t mt-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors text-left flex items-center gap-2 w-full",
                    "text-muted-foreground hover:bg-accent hover:text-accent-foreground font-medium"
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
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
          </div>
        </nav>
      </aside>

      {/* Overlay when sidebar open */}
      {sidebarOpen && (
        <div
          className="hidden md:block fixed inset-0 bg-black/20 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
