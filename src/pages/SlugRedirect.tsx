import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SlugRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const resolveSlug = async () => {
      try {
        const res = await fetch(`/api/slugs/resolve/${slug}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        if (data.guild_id) {
          navigate(`/server/${data.guild_id}`, { replace: true });
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Error resolving slug:", err);
        setError(true);
      }
    };

    if (slug) {
      resolveSlug();
    }
  }, [slug, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-muted-foreground">Convite não encontrado ou link expirado.</p>
        <button 
          onClick={() => navigate('/')}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground animate-pulse">Redirecionando para o servidor...</p>
    </div>
  );
}
