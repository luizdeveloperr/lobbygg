import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, token } = useAuth();
  
  // IDs de admin configurados no ambiente
  const adminIds = (import.meta.env.VITE_ADMIN_IDS || "").split(",").map((id: string) => id.trim());

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = user && adminIds.includes(user.id);

  if (!token || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
