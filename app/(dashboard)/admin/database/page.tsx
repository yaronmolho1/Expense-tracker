"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface TableInfo {
  name: string;
  description: string;
  warning?: string;
}

const TABLES: TableInfo[] = [
  {
    name: "transactions",
    description: "All transaction records",
    warning: "This will delete all your transaction data!",
  },
  {
    name: "businesses",
    description: "Business records",
    warning: "This will cascade delete all related transactions!",
  },
  {
    name: "cards",
    description: "Payment card records",
    warning: "This will cascade delete all related transactions!",
  },
  {
    name: "upload_batches",
    description: "Upload batch history",
  },
  {
    name: "uploaded_files",
    description: "File upload records",
  },
  {
    name: "subscriptions",
    description: "Subscription records",
  },
  {
    name: "business_merge_suggestions",
    description: "Business merge suggestions",
  },
  {
    name: "subscription_suggestions",
    description: "Subscription suggestions",
  },
  {
    name: "processing_logs",
    description: "Processing logs",
  },
];

export default function DatabaseAdminPage() {
  const [clearing, setClearing] = useState<string | null>(null);

  const handleClearTable = async (tableName: string) => {
    setClearing(tableName);
    try {
      const response = await fetch("/api/admin/clear-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName }),
      });

      if (!response.ok) {
        throw new Error("Failed to clear table");
      }

      toast.success(`Table "${tableName}" has been cleared.`);
    } catch (error) {
      toast.error("Failed to clear table. Please try again.");
    } finally {
      setClearing(null);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Database Management</h1>
        <p className="text-muted-foreground">
          Clear database tables individually. Use with caution!
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div>
          <h3 className="font-semibold text-yellow-900 mb-1">Warning</h3>
          <p className="text-sm text-yellow-800">
            Clearing tables permanently deletes data. This action cannot be
            undone. Some tables cascade delete related data.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TABLES.map((table) => (
          <Card key={table.name}>
            <CardHeader>
              <CardTitle className="text-lg">{table.name}</CardTitle>
              <CardDescription>{table.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={clearing === table.name}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {clearing === table.name ? "Clearing..." : "Clear Table"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      Confirm Clear Table
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to clear the{" "}
                      <strong>{table.name}</strong> table?
                      {table.warning && (
                        <span className="block mt-2 text-red-600 font-semibold">
                          ⚠️ {table.warning}
                        </span>
                      )}
                      <span className="block mt-2">
                        This action cannot be undone.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleClearTable(table.name)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Yes, Clear Table
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
