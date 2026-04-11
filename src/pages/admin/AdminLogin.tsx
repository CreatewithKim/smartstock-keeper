import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle, Clock } from "lucide-react";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [_emailConfirmed, setEmailConfirmed] = useState(false);
  const [awaitingRole, setAwaitingRole] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Handle email confirmation redirect (user clicks link in email)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Check if this is from an email confirmation redirect
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');
        
        if (type === 'signup' || type === 'email') {
          setEmailConfirmed(true);
          setConfirmedEmail(session.user.email || "");
          
          // Check if user already has admin role
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'admin')
            .maybeSingle();

          if (roleData) {
            toast({ title: "Welcome, Admin", description: "Successfully logged in." });
            navigate("/admin");
          } else {
            setAwaitingRole(true);
          }
        }
      }
    });

    // Also check if user is already signed in on mount
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleData) {
          navigate("/admin");
        } else {
          setEmailConfirmed(true);
          setConfirmedEmail(session.user.email || "");
          setAwaitingRole(true);
        }
      }
    };
    checkSession();

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        setEmailConfirmed(true);
        setConfirmedEmail(data.user.email || "");
        setAwaitingRole(true);
        return;
      }

      toast({ title: "Welcome, Admin", description: "Successfully logged in." });
      navigate("/admin");
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + '/admin/login' }
      });
      if (error) throw error;

      setSignUpSuccess(true);
    } catch (error: any) {
      toast({ title: "Sign Up Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAwaitingRole(false);
    setEmailConfirmed(false);
    setSignUpSuccess(false);
    setConfirmedEmail("");
  };

  // Show email sent confirmation
  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription>SmartStock Inventory Monitor</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              A confirmation email has been sent to <strong>{email}</strong>. 
              Click the link in the email to verify your account.
            </p>
            <p className="text-sm text-muted-foreground">
              After verifying, you'll be redirected back here to access the admin panel.
            </p>
            <Button variant="outline" className="w-full" onClick={() => { setSignUpSuccess(false); setIsSignUp(false); }}>
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show awaiting admin role assignment
  if (awaitingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl">Email Verified!</CardTitle>
            <CardDescription>SmartStock Inventory Monitor</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your account <strong>{confirmedEmail}</strong> has been verified successfully.
            </p>
            <p className="text-sm text-muted-foreground">
              Admin role assignment is pending. Please share your email with the system administrator to get admin access granted.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
              <Button 
                className="flex-1" 
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session) {
                    const { data: roleData } = await supabase
                      .from('user_roles')
                      .select('role')
                      .eq('user_id', session.user.id)
                      .eq('role', 'admin')
                      .maybeSingle();
                    if (roleData) {
                      navigate("/admin");
                    } else {
                      toast({ title: "Still Pending", description: "Admin role has not been assigned yet.", variant: "destructive" });
                    }
                  }
                }}
              >
                Check Access
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{isSignUp ? "Admin Sign Up" : "Admin Login"}</CardTitle>
          <CardDescription>SmartStock Inventory Monitor</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Create Account" : "Sign In")}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-primary underline"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
