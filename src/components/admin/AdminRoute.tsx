import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('unauthenticated');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setStatus(roleData ? 'authenticated' : 'unauthenticated');
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setStatus('unauthenticated');
      if (event === 'SIGNED_IN') checkAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Verifying access...</p></div>;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};
