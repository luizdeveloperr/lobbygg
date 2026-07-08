import { Link } from "react-router-dom";
import { Users, ExternalLink, Star, Tag, Flag, Calendar, Sparkles } from "lucide-react";
import { Server, CATEGORY_LOGOS } from "@/lib/types";
import { Button } from "./ui/button";
import { useState } from "react";
import { ReportServerDialog } from "./ReportServerDialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ServerCardProps {
  server: Server;
  variant?: "default" | "featured" | "sponsored";
}

export function ServerCard({ server, variant = "default" }: ServerCardProps) {
  const isFeatured = variant === "featured" || server.featured;
  const isSponsored = variant === "sponsored" || server.sponsored;
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const [iconError, setIconError] = useState(false);

  const handleImageError = async (field: 'banner_url' | 'icon_url') => {
    if (field === 'banner_url') setBannerError(true);
    if (field === 'icon_url') setIconError(true);

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

  // Check if server is "New" (less than 7 days old)
  const isNew = () => {
    const createdDate = server.created_at || server.createdAt;
    if (!createdDate) return false;
    
    const date = new Date(createdDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= 7;
  };

  const isNewServer = isNew();

  return (
    <>
      <Link
        to={`/server/${server.guild_id}`}
        className={`group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
          isSponsored
            ? "border-yellow-500/30 shadow-yellow-500/5"
            : isFeatured
            ? "border-primary/30 shadow-primary/5"
            : "border-border hover:border-primary/20"
        }`}
      >
        {/* Banner Section */}
        <div className="relative h-32 w-full bg-secondary/30 overflow-hidden">
          {server.banner_url && !bannerError ? (
            <img
              src={server.banner_url}
              alt={`${server.name} banner`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => handleImageError('banner_url')}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-secondary/50 to-background" />
          )}
          
          {/* Report Button */}
          <div className="absolute top-2 left-2 z-20">
             <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-black/40 hover:bg-destructive hover:text-white text-white/70 backdrop-blur-sm transition-colors shadow-sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsReportOpen(true);
                }}
                title="Reportar Servidor"
              >
                <Flag className="h-3.5 w-3.5" />
              </Button>
          </div>

          {/* Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-20">
            {isSponsored && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500 text-yellow-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                <Star className="h-3 w-3 fill-current" />
                Patrocinado
              </span>
            )}
            {isFeatured && !isSponsored && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                <Star className="h-3 w-3 fill-current" />
                Destaque
              </span>
            )}
            {/* New Badge - Only shows if not sponsored/featured to avoid clutter, or shows below them */}
            {isNewServer && !isSponsored && !isFeatured && (
               <span className="inline-flex items-center gap-1 rounded-full bg-blue-500 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                 <Sparkles className="h-3 w-3 fill-current" />
                 Novo
               </span>
            )}
            {server.min_bet_value && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                💰 {server.min_bet_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-1 flex-col p-4 pt-0">
          <div className="flex items-start justify-between">
              {/* Avatar (Overlapping Banner) */}
              <div className="-mt-10 mb-3 relative z-10">
                  {server.icon_url && !iconError ? (
                  <img
                      src={server.icon_url}
                      alt={server.name}
                      className="h-20 w-20 rounded-2xl border-[4px] border-card bg-card object-cover shadow-sm"
                      onError={() => handleImageError('icon_url')}
                  />
                  ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-[4px] border-card bg-secondary text-3xl shadow-sm">
                      {server.iconEmoji || server.icon_emoji}
                  </div>
                  )}
              </div>

              {/* Quick Stats (Top Right aligned with avatar) */}
              <div className="pt-2 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    {/* Online Stats */}
                    <div className="flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20" title="Online">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-semibold text-green-500 text-[11px] leading-none">
                          {(server.members_online || 0).toLocaleString("pt-BR")}
                        </span>
                    </div>
                    {/* Total Members */}
                    <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md" title="Total de Membros">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold text-foreground text-[11px] leading-none">
                          {server.members.toLocaleString("pt-BR")}
                        </span>
                    </div>
                  </div>
              </div>
          </div>

          {/* Server Info */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="truncate text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {server.name}
              </h3>
              <div
                className="flex h-7 min-w-7 items-center justify-center rounded-md bg-white px-1 shadow-sm ring-1 ring-black/5"
                title={server.category}
              >
                 <img
                   src={CATEGORY_LOGOS[server.category]}
                   alt={`${server.category} logo`}
                   className="h-4 w-auto max-w-[48px] object-contain"
                   loading="lazy"
                 />
              </div>
            </div>
            
            <div className="line-clamp-2 text-sm text-muted-foreground leading-relaxed h-10 mb-2 overflow-hidden prose prose-invert prose-xs max-w-none prose-p:leading-relaxed prose-strong:text-primary/90">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                allowedElements={['p', 'strong', 'em', 'code', 'span', 'ul', 'ol', 'li']}
                unwrapDisallowed={true}
              >
                {server.description}
              </ReactMarkdown>
            </div>

            {/* Creation Date */}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3 opacity-70" />
                <span>Criado em {new Date(server.created_at || server.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          {/* Footer: Tags & Action */}
          <div className="mt-auto flex items-center justify-between gap-4 border-t border-border pt-3">
            <div className="flex gap-1 overflow-hidden items-center">
              {/* Rating Stars - Only show if has reviews */}
              {server.reviews_count && server.reviews_count > 0 ? (
                <div className="flex items-center gap-1 mr-2" title={`${server.rating_average?.toFixed(1)} estrelas (${server.reviews_count} avaliações)`}>
                   <div className="flex">
                     {[1, 2, 3, 4, 5].map((star) => (
                       <Star 
                         key={star} 
                         className={`h-3 w-3 ${
                           (server.rating_average || 0) >= star 
                             ? "fill-yellow-400 text-yellow-400" 
                             : (server.rating_average || 0) >= star - 0.5
                               ? "fill-yellow-400/50 text-yellow-400" // Half star logic could be better but simplified
                               : "text-muted-foreground/30"
                         }`} 
                       />
                     ))}
                   </div>
                   <span className="text-[10px] font-bold text-muted-foreground">
                     {server.rating_average?.toFixed(1)}
                   </span>
                </div>
              ) : (
                /* Tags fallback if no reviews taking space, or show alongside tags if space permits */
                <>
                  {server.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md bg-secondary/50 px-2 py-1 text-[10px] font-medium text-secondary-foreground"
                    >
                      <Tag className="mr-1 h-2.5 w-2.5 opacity-50" />
                      {tag}
                    </span>
                  ))}
                  {server.tags.length > 2 && (
                      <span className="inline-flex items-center rounded-md bg-secondary/30 px-2 py-1 text-[10px] text-muted-foreground">
                          +{server.tags.length - 2}
                      </span>
                  )}
                </>
              )}
            </div>

            <Button 
              size="sm" 
              className="h-8 px-4 text-xs font-semibold shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
              onClick={(e) => {
                  e.preventDefault();
                  window.open(server.inviteLink || server.invite_link, "_blank");
              }}
            >
              Entrar
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        </div>
      </Link>
      
      <ReportServerDialog 
        open={isReportOpen} 
        onOpenChange={setIsReportOpen} 
        serverId={server.id} 
        serverName={server.name} 
      />
    </>
  );
}
