import { useUserServers, useDeleteServer } from "@/hooks/queries/useServers";
import { Header } from "@/components/Header";
import { 
  Loader2, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2, 
  LayoutDashboard, 
  Users, 
  Plus, 
  ArrowRight,
  ShieldCheck,
  Star,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { Server, CATEGORY_ICONS } from "@/lib/types";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";

export default function MyServers() {
  const { data: servers, isLoading, error } = useUserServers();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse font-medium">Carregando seus servidores...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-12">
           <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
             <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
             <h2 className="text-xl font-bold text-foreground mb-2">Ops! Algo deu errado</h2>
             <p className="text-muted-foreground mb-6">Não conseguimos carregar seus servidores. Por favor, tente novamente.</p>
             <Button onClick={() => window.location.reload()}>Tentar Novamente</Button>
           </div>
        </main>
      </div>
    );
  }

  const approved = servers?.filter(s => s.status === 'approved') || [];
  const pending = servers?.filter(s => s.status === 'pending') || [];
  const rejected = servers?.filter(s => s.status === 'rejected') || [];
  const totalMembers = servers?.reduce((acc, s) => acc + (s.members || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-2">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard do Proprietário
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">Meus Servidores</h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Gerencie seus servidores postados, acompanhe estatísticas e o status de aprovação em tempo real.
            </p>
          </div>
          
          <Button onClick={() => navigate("/add")} size="lg" className="h-14 px-8 rounded-2xl font-bold shadow-lg shadow-primary/20 gap-2 group">
            <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
            Adicionar Novo
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
             <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ShieldCheck className="h-24 w-24" />
             </div>
             <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Total de Servidores</p>
             <h3 className="text-3xl font-black text-foreground">{servers?.length || 0}</h3>
          </div>
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
             <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Users className="h-24 w-24" />
             </div>
             <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Alcance Total</p>
             <h3 className="text-3xl font-black text-foreground">{totalMembers.toLocaleString("pt-BR")} <span className="text-sm font-medium text-muted-foreground">membros</span></h3>
          </div>
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
             <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CheckCircle2 className="h-24 w-24" />
             </div>
             <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Aprovados</p>
             <h3 className="text-3xl font-black text-green-500">{approved.length}</h3>
          </div>
        </div>

        <Tabs defaultValue="posted" className="w-full">
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            <TabsList className="mb-8 w-full min-w-max justify-start bg-secondary/30 p-1 rounded-2xl h-auto backdrop-blur-sm border border-border/50">
              <TabsTrigger 
                value="posted" 
                className="px-6 py-3 rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold transition-all gap-2"
              >
                Postados
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none">{approved.length}</Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="pending" 
                className="px-6 py-3 rounded-xl data-[state=active]:bg-card data-[state=active]:text-yellow-500 data-[state=active]:shadow-sm font-bold transition-all gap-2"
              >
                Em Análise
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-none">{pending.length}</Badge>
              </TabsTrigger>
              {rejected.length > 0 && (
                <TabsTrigger 
                  value="rejected" 
                  className="px-6 py-3 rounded-xl data-[state=active]:bg-card data-[state=active]:text-destructive data-[state=active]:shadow-sm font-bold transition-all gap-2"
                >
                  Recusados
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive border-none">{rejected.length}</Badge>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="posted" className="space-y-4 outline-none">
            {approved.length === 0 ? (
              <div className="text-center py-20 bg-secondary/10 border-2 border-dashed border-border rounded-3xl">
                <div className="h-20 w-20 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LayoutDashboard className="h-10 w-10 text-muted-foreground opacity-20" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Nenhum servidor aprovado</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-8">Comece agora mesmo postando seu servidor na nossa plataforma.</p>
                <Button onClick={() => navigate("/add")} className="rounded-xl px-8">Adicionar Servidor</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {approved.map(server => (
                  <ServerListItem key={server.id} server={server} type="approved" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4 outline-none">
            {pending.length === 0 ? (
              <div className="text-center py-20 bg-secondary/10 border-2 border-dashed border-border rounded-3xl">
                <div className="h-20 w-20 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-10 w-10 text-muted-foreground opacity-20" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Tudo em dia!</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">Você não tem nenhum servidor aguardando análise no momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pending.map(server => (
                  <ServerListItem key={server.id} server={server} type="pending" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4 outline-none">
            <div className="grid grid-cols-1 gap-4">
              {rejected.map(server => (
                <ServerListItem key={server.id} server={server} type="rejected" />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ServerListItem({ server, type }: { server: Server, type: 'approved' | 'pending' | 'rejected' }) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteServer();

  const handleDelete = () => {
    const identifier = server.guild_id || server.id;
    deleteMutation.mutate(identifier, {
      onSuccess: () => {
        toast.success("Servidor removido com sucesso.");
      },
      onError: () => {
        toast.error("Erro ao remover servidor.");
      }
    });
  };

  return (
    <div className="group flex flex-col gap-4 p-5 md:p-6 rounded-[2rem] border border-border bg-card hover:border-primary/30 hover:bg-secondary/10 transition-all duration-300 shadow-sm hover:shadow-md">
      <div className="flex flex-col sm:flex-row items-center sm:items-center gap-6">
        {/* Icon & Banner Combined Look */}
        <div className="relative shrink-0">
          <div className="h-20 w-20 md:h-24 md:w-24 rounded-3xl overflow-hidden bg-secondary border-2 border-border shadow-inner group-hover:scale-105 transition-transform duration-500">
            {server.icon_url ? (
              <img 
                src={server.icon_url} 
                alt={server.name} 
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl">
                {server.iconEmoji || server.icon_emoji || "🏠"}
              </div>
            )}
          </div>
          {/* Status Indicator Dot */}
          <div className={`absolute -right-1 -bottom-1 h-6 w-6 rounded-full border-4 border-card flex items-center justify-center shadow-sm ${
            type === 'approved' ? 'bg-green-500' : 
            type === 'pending' ? 'bg-yellow-500' : 'bg-destructive'
          }`}>
            {type === 'approved' ? <CheckCircle2 className="h-3 w-3 text-white" /> : 
             type === 'pending' ? <Clock className="h-3 w-3 text-white" /> : 
             <XCircle className="h-3 w-3 text-white" />}
          </div>
        </div>

        {/* Info Content */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
            <h3 className="text-xl font-black text-foreground truncate group-hover:text-primary transition-colors">{server.name}</h3>
            {server.sponsored && (
              <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20 w-fit mx-auto sm:mx-0">
                <Star className="h-3 w-3 mr-1 fill-current" /> Patrocinado
              </Badge>
            )}
          </div>
          
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 font-bold text-foreground">
              <Users className="h-4 w-4 text-primary" />
              {server.members.toLocaleString("pt-BR")} <span className="font-medium text-muted-foreground">membros</span>
            </span>
            <span className="hidden xs:inline text-border">•</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-secondary/50 border border-border/50">
              <img src={CATEGORY_ICONS[server.category]} alt={server.category} className="h-4 w-auto max-w-[20px] object-contain" />
              {server.category}
            </span>
          </div>

          {type === 'approved' && (
             <div className="mt-3 flex items-center justify-center sm:justify-start gap-3">
                <Link 
                  to={server.custom_slug ? `/c/${server.custom_slug}` : `/server/${server.guild_id}`}
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                   Ver página pública <ExternalLink className="h-3 w-3" />
                </Link>
             </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 border-border/50 mt-2 sm:mt-0">
          {type !== 'rejected' && (
            <>
              <Button 
                variant="outline" 
                size="lg" 
                className="h-12 px-6 rounded-2xl font-bold bg-card border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all flex-1 sm:flex-none gap-2" 
                onClick={() => navigate(`/my-servers/edit/${server.guild_id}`)}
              >
                <Settings className="h-4 w-4" />
                <span>Configurar</span>
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem] border-border bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-black">Tem certeza absoluta?</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      Esta ação não pode ser desfeita. Isso excluirá permanentemente o servidor <span className="font-bold text-foreground">"{server.name}"</span> da nossa lista pública e de todos os nossos registros.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete} 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : "Sim, Excluir Servidor"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {type === 'rejected' && (
             <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  className="flex-1 sm:flex-none h-12 rounded-2xl font-bold border-destructive/20 hover:bg-destructive/5 text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir Registro
                </Button>
                {server.allow_resubmission && (
                   <Button 
                    className="flex-1 sm:flex-none h-12 rounded-2xl font-bold gap-2" 
                    onClick={() => navigate(`/my-servers/edit/${server.guild_id}`)}
                  >
                    <Settings className="h-4 w-4" />
                    Corrigir e Reenviar
                  </Button>
                )}
             </div>
          )}
        </div>
      </div>

      {/* Rejected Status Block Expansion */}
      {type === 'rejected' && (
        <div className="rounded-2xl bg-destructive/5 border border-destructive/10 p-4 md:p-6 mt-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
             <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <div className="space-y-3 relative z-10">
            <div className="flex items-center gap-2 text-destructive font-black uppercase text-xs tracking-widest">
              <XCircle className="h-4 w-4" />
              Relatório de Rejeição
            </div>
            <div className="p-4 rounded-xl bg-card border border-destructive/10 text-sm text-muted-foreground leading-relaxed">
              {server.rejection_reason ? (
                <>
                  <span className="font-black text-destructive/80 block mb-1">Motivo do Administrador:</span> 
                  {server.rejection_reason}
                </>
              ) : (
                <p className="italic opacity-70 flex items-center gap-2">
                   <MessageSquare className="h-4 w-4" />
                   Nenhum motivo específico foi detalhado pela equipe de moderação.
                </p>
              )}
            </div>
            {!server.allow_resubmission && (
               <p className="text-[10px] font-bold text-destructive/50 uppercase tracking-tighter">
                 * Este servidor não permite reenvio imediato. Entre em contato com o suporte se achar que houve um erro.
               </p>
            )}
          </div>
        </div>
      )}

      {/* Pending Status Block Expansion */}
      {type === 'pending' && (
        <div className="rounded-2xl bg-yellow-500/5 border border-yellow-500/10 p-4 mt-2">
           <div className="flex items-center gap-3 text-yellow-500/80 text-xs font-bold">
              <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
              Sua solicitação está sendo processada pela nossa equipe de moderação. 
              <span className="hidden md:inline text-muted-foreground font-normal">• Tempo estimado: 24h-48h</span>
           </div>
        </div>
      )}
    </div>
  );
}
