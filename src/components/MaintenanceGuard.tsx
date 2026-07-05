import { useEffect, useState } from "react";
import { Hammer, Loader2 } from "lucide-react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = "/api";

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  // VITE_ADMIN_IDS usually comes from env
  const adminIds = (import.meta.env.VITE_ADMIN_IDS || "").split(",");
  const isAdmin = user && adminIds.includes(user.id);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await axios.get(`${API_URL}/maintenance-status`);
        setIsMaintenance(res.data.maintenance);
      } catch (err) {
        console.error("Error checking maintenance status:", err);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenance();
    // Poll every 30 seconds
    const interval = setInterval(checkMaintenance, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se estiver em manutenção e NÃO for admin, mostra a tela de manutenção
  if (isMaintenance && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-card border border-border rounded-3xl p-8 md:p-12 max-w-lg shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 opacity-5">
            <Hammer className="h-40 w-40 rotate-12" />
          </div>
          
          <div className="bg-primary/10 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Hammer className="h-10 w-10 text-primary" />
          </div>
          
          <h1 className="text-3xl font-black mb-4 tracking-tight">Site em Manutenção</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Estamos realizando algumas melhorias para tornar sua experiência ainda melhor. 
            Voltaremos em breve!
          </p>
          
          <div className="flex flex-col gap-3">
             <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-progress-loading" />
             </div>
             <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                Sincronizando atualizações...
             </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
