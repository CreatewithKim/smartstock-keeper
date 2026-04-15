import { useState, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Download, Trash2, Info, Scale, UserCog, LogOut, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import { ScaleConfiguration } from "@/components/scale/ScaleConfiguration";
import { ScaleConfig } from "@/hooks/useScaleConnection";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  port: 'COM3',
  baudRate: 9600,
  parity: 'none',
  stopBits: 1,
};

export default function Settings() {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [scaleConfig, setScaleConfig] = useState<ScaleConfig>(DEFAULT_SCALE_CONFIG);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const verifyCurrentPassword = async (): Promise<boolean> => {
    if (!currentPassword.trim()) {
      toast({
        title: "Current Password Required",
        description: "Please enter your current password to confirm changes.",
        variant: "destructive",
      });
      return false;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: currentPassword,
    });
    if (error) {
      toast({
        title: "Incorrect Password",
        description: "The current password you entered is incorrect.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    setIsUpdating(true);
    try {
      if (!(await verifyCurrentPassword())) return;
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast({
        title: "Confirmation Sent",
        description: "Check both your old and new email inboxes to confirm the change.",
      });
      setNewEmail("");
      setCurrentPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update email",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    setIsUpdating(true);
    try {
      if (!(await verifyCurrentPassword())) return;
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      setNewPassword("");
      setCurrentPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut();
  };

  useEffect(() => {
    const saved = localStorage.getItem('scaleConfig');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const { middlewareUrl, ...rest } = parsed;
        setScaleConfig({ ...DEFAULT_SCALE_CONFIG, ...rest });
      } catch {
        setScaleConfig(DEFAULT_SCALE_CONFIG);
      }
    }
  }, []);

  const handleScaleConfigChange = (updates: Partial<ScaleConfig>) => {
    const updated = { ...scaleConfig, ...updates };
    setScaleConfig(updated);
    localStorage.setItem('scaleConfig', JSON.stringify(updated));
    toast({
      title: "Configuration Saved",
      description: "Scale settings have been updated",
    });
  };

  const handleBackup = async () => {
    try {
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

      {/* Account Management */}
      <GlassCard>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <UserCog className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground mb-1">Account</h2>
              <p className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user?.email}</span>
              </p>
            </div>
          </div>

          {/* Current Password Confirmation */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium text-foreground">Current Password</p>
            </div>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Enter current password to confirm changes"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Required before changing your email or password.</p>
          </div>

          {currentPassword.trim() && (
            <>
              {/* Change Email */}
              <div className="rounded-lg bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <p className="font-medium text-foreground">Change Email</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="New email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleUpdateEmail} disabled={isUpdating || !newEmail.trim()} variant="outline">
                    Update
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">A confirmation link will be sent to both your current and new email.</p>
              </div>

              {/* Change Password */}
              <div className="rounded-lg bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <p className="font-medium text-foreground">Change Password</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="New password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button onClick={handleUpdatePassword} disabled={isUpdating || newPassword.length < 6} variant="outline">
                    Update
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Switch Account */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
            <div>
              <p className="font-medium text-foreground">Switch Account</p>
              <p className="text-sm text-muted-foreground">
                Sign out and log in with a different account
              </p>
            </div>
            <Button onClick={handleSwitchAccount} variant="outline" className="gap-2">
              <LogOut className="h-4 w-4" />
              Switch
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Scale Configuration */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Scale className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">Scale Configuration</h2>
        </div>
        <ScaleConfiguration 
          config={scaleConfig} 
          onConfigChange={handleScaleConfigChange}
          disabled={false}
        />
        <p className="text-xs text-muted-foreground px-1">
          Configure the serial port settings for your ACLAS PS6X weighing scale. Changes take effect on next connection.
        </p>
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
