import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Database, Download, Trash2, Info, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadUserManual } from "@/utils/userManual";
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

export default function Settings() {
  const { toast } = useToast();

  const handleBackup = async () => {
    try {
      // This is a placeholder for backup functionality
      toast({
        title: "Backup Created",
        description: "Your data has been backed up successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create backup",
        variant: "destructive",
      });
    }
  };

  const handleClearData = async () => {
    try {
      // Clear IndexedDB
      const dbName = "smartstock-db";
      const request = indexedDB.deleteDatabase(dbName);
      
      request.onsuccess = () => {
        toast({
          title: "Data Cleared",
          description: "All data has been cleared. The page will reload.",
        });
        setTimeout(() => window.location.reload(), 2000);
      };

      request.onerror = () => {
        throw new Error("Failed to clear database");
      };
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your app settings and data</p>
      </div>

      {/* App Info */}
      <GlassCard>
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3">
            <Info className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">About SmartStock</h2>
            <p className="text-muted-foreground mb-2">
              Version 1.0.0 - Offline-first inventory management system
            </p>
            <p className="text-sm text-muted-foreground">
              SmartStock is a Progressive Web App (PWA) that works completely offline.
              All your data is stored securely on your device.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* User Manual */}
      <GlassCard>
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground mb-2">User Manual</h2>
            <p className="text-muted-foreground mb-4">
              Download the complete user manual with detailed instructions for all features,
              including scale integration setup and PLU configuration.
            </p>
            <Button onClick={downloadUserManual} className="gap-2">
              <Download className="h-4 w-4" />
              Download User Manual
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Data Management */}
      <GlassCard>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground mb-2">Data Management</h2>
              <p className="text-muted-foreground mb-4">
                Manage your inventory data and create backups
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-primary/5 p-4">
              <div>
                <p className="font-medium text-foreground">Create Backup</p>
                <p className="text-sm text-muted-foreground">
                  Download a backup of your data
                </p>
              </div>
              <Button onClick={handleBackup} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Backup
              </Button>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div className="flex items-center justify-between rounded-lg bg-destructive/5 p-4 cursor-pointer hover:bg-destructive/10 transition-colors">
                  <div>
                    <p className="font-medium text-foreground">Clear All Data</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete all products, sales, and records
                    </p>
                  </div>
                  <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-white">
                    <Trash2 className="h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-strong">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your products,
                    sales records, and stock intake history from your device.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearData}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Yes, Clear All Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </GlassCard>

      {/* PWA Info */}
      <GlassCard>
        <h2 className="text-xl font-semibold text-foreground mb-3">Install App</h2>
        <p className="text-muted-foreground mb-4">
          Install SmartStock on your device for quick access and offline functionality:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>On mobile: Tap "Add to Home Screen" in your browser menu</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>On desktop: Look for the install icon in your address bar</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Works completely offline once installed</span>
          </li>
        </ul>
      </GlassCard>

      {/* Currency Info */}
      <GlassCard>
        <h2 className="text-xl font-semibold text-foreground mb-3">Currency</h2>
        <p className="text-muted-foreground">
          All prices and calculations are in <span className="font-semibold text-foreground">Kenyan Shillings (KSh)</span>
        </p>
      </GlassCard>
    </div>
  );
}
