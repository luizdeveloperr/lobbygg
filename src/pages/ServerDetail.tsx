import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Header } from "@/components/Header";
import { useServer } from "@/hooks/queries/useServers";
import { CATEGORY_LOGOS } from "@/lib/types";
import { ArrowLeft, Users, ExternalLink, Calendar, Tag, Star, Clock, Loader2, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewSection } from "@/components/ReviewSection";

const ServerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: server, isLoading, error } = useServer(id || "");
  const [bannerError, setBannerError] = useState(false);
  const [iconError, setIconError] = useState(false);

  const handleImageError = async (field: 'banner_url' | 'icon_url') => {
    if (field === 'banner_url') setBannerError(true);
    if (field === 'icon_url') setIconError(true);

    if (!server) return;

    try {
      await fetch(`/api/servers/${server.guild_id}/validate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field })
      });
    } catch (err) {
      console.error(`Failed to report broken ${field}:`, err);
    }
  };

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // SEO & Consistency: If loaded with UUID, redirect to Guild ID URL
  useEffect(() => {
    if (server && id && !/^\d{17,20}$/.test(id)) {
      navigate(`/server/${server.guild_id}`, { replace: true });
    }
  }, [server, id, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground">Servidor não encontrado</h1>
          <p className="mt-2 text-muted-foreground">Este servidor não existe ou foi removido.</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Voltar ao início
          </Link>
        </main>
      </div>
    );
  }

  const isPending = server.status === "pending";

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>{server.name} | LobbyGG</title>
        <meta name="description" content={server.description} />
        
        {/* OpenGraph / Discord / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${server.name} - LobbyGG`} />
        <meta property="og:description" content={`${server.memberCount || 0} membros • ${server.description}`} />
        <meta property="og:image" content={server.iconUrl || server.banner_url || "https://lobbygg.com.br/og-image.png"} />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${server.name} - LobbyGG`} />
        <meta name="twitter:description" content={server.description} />
        <meta name="twitter:image" content={server.iconUrl || server.banner_url || "https://lobbygg.com.br/og-image.png"} />
      </Helmet>

      <Header />
      
      {/* Banner Section */}
      <div className="relative h-[250px] md:h-[350px] w-full bg-secondary/30 overflow-hidden group">
        {server.banner_url && !bannerError ? (
           <img 
             src={server.banner_url} 
             alt={`${server.name} banner`} 
             className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" 
             onError={() => handleImageError('banner_url')}
           />
        ) : (
           <div className="h-full w-full bg-gradient-to-br from-primary/20 via-background to-secondary flex items-center justify-center">
             <div className="opacity-10 text-9xl">🎮</div>
           </div>
        )}
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        {/* Back Button (Floating) */}
        <div className="absolute top-6 left-4 md:left-8 z-20">
             <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-full bg-background/50 backdrop-blur-md px-4 py-2 text-sm font-medium text-foreground hover:bg-background/80 transition-all border border-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
        </div>
      </div>

      <main className="container mx-auto px-4 -mt-32 relative z-10 max-w-6xl">
         {/* Pending Warning */}
         {isPending && (
          <div className="mb-6 mx-auto max-w-2xl flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 backdrop-blur-md shadow-lg">
            <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-500">Em análise</p>
              <p className="text-xs text-muted-foreground">
                Este servidor está aguardando aprovação e ainda não está visível publicamente.
              </p>
            </div>
          </div>
        )}

         <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
            {/* Avatar */}
            <div className="h-32 w-32 md:h-48 md:w-48 rounded-[2rem] border-[6px] border-background bg-card shadow-2xl overflow-hidden shrink-0 relative group">
               {server.icon_url && !iconError ? (
                  <img 
                    src={server.icon_url} 
                    alt={server.name} 
                    className="h-full w-full object-cover"
                    onError={() => handleImageError('icon_url')}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary text-6xl">
                    {server.iconEmoji || server.icon_emoji}
                  </div>
                )}
            </div>

            {/* Header Info */}
            <div className="flex-1 pt-2 md:pt-32 space-y-3">
               <div className="flex flex-wrap items-center gap-3">
                 <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">{server.name}</h1>
                 {server.sponsored && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-500 uppercase tracking-wider">
                    <Star className="h-3 w-3 fill-yellow-500" /> Patrocinado
                  </span>
                )}
                {server.featured && !server.sponsored && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                    <Star className="h-3 w-3 fill-primary" /> Destaque
                  </span>
                )}
               </div>
               
               <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
                  <span className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full text-green-500">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-bold">{(server.members_online || 0).toLocaleString("pt-BR")}</span> online
                  </span>
                  <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1 rounded-full">
                    <Users className="h-4 w-4" /> 
                    <span className="font-semibold text-foreground">{server.members.toLocaleString("pt-BR")}</span> membros
                  </span>
                  <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1 rounded-full">
                    <span className="flex h-6 min-w-6 items-center justify-center px-1">
                      <img
                        src={CATEGORY_LOGOS[server.category]}
                        alt={`${server.category} logo`}
                        className="h-4 w-auto max-w-[40px] object-contain"
                        loading="lazy"
                      />
                    </span>
                    <span className="font-medium text-foreground">{server.category}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> 
                    Criado em {new Date(server.created_at || server.createdAt || Date.now()).toLocaleDateString("pt-BR")}
                  </span>
               </div>
            </div>

            {/* Action Buttons (Desktop) */}
            <div className="hidden md:flex flex-col gap-3 pt-32">
                 <Button className="h-12 px-8 text-base font-bold shadow-lg shadow-primary/20" asChild>
                    <a href={server.inviteLink || server.invite_link} target="_blank" rel="noopener noreferrer">
                        Entrar no Servidor
                        <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                 </Button>
            </div>
         </div>

         {/* Mobile Action Button */}
         <div className="md:hidden mb-6">
            <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" asChild>
                <a href={server.inviteLink || server.invite_link} target="_blank" rel="noopener noreferrer">
                    Entrar no Servidor
                    <ExternalLink className="ml-2 h-4 w-4" />
                </a>
            </Button>
         </div>

         {/* Content Grid */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Main Content */}
            <div className="lg:col-span-2 space-y-8">
               <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Sobre o Servidor
                  </h2>
                  <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      allowedElements={['p', 'strong', 'em', 'code', 'span', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'a', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td']}
                      transformLinkUri={(href) => href.startsWith('http') ? href : ''}
                      transformImageUri={(src) => src.startsWith('http') ? src : ''}
                    >
                      {server.description}
                    </ReactMarkdown>
                  </div>
               </div>

               {/* Reviews Section */}
               <ReviewSection 
                 serverId={server.id} 
                 serverName={server.name} 
                 isPending={server.status === 'pending'} 
               />
            </div>

            {/* Right: Sidebar */}
            <div className="space-y-6">
                {/* Entry and Room Info Card */}
                {(server.min_bet_value || server.custom_room_value) && (
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Informações de Entrada e Salas</h3>
                        {server.min_bet_value && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-foreground">Valor Mínimo de Entrada:</span>
                                <span className="font-bold text-primary">
                                    {server.min_bet_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                        )}
                        {server.custom_room_value && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-foreground">Valor Sala Personalizada:</span>
                                <span className="font-bold text-primary">
                                    {server.custom_room_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Info Card */}
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {server.tags && server.tags.length > 0 ? (
                                server.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-default"
                                >
                                    <Tag className="mr-1.5 h-3 w-3 opacity-50" />
                                    #{tag}
                                </span>
                                ))
                            ) : (
                                <span className="text-sm text-muted-foreground italic">Sem tags</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="pt-6 border-t border-border">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Compartilhar</h3>
                        <Button variant="outline" className="w-full gap-2" onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            // Simple toast or feedback could be added here
                        }}>
                            <Share2 className="h-4 w-4" />
                            Copiar Link
                        </Button>
                    </div>
                </div>
            </div>
         </div>
      </main>
    </div>
  );
};

export default ServerDetail;
