import { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Header } from "@/components/Header";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Star, 
  ExternalLink, 
  AlertCircle,
  Eye,
  LayoutDashboard,
  Settings,
  ListFilter,
  Hammer,
  Save,
  Power,
  History,
  User,
  Users,
  Ban,
  ShieldAlert,
  Search,
  Activity,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Link as LinkIcon,
  Palette,
  FileText,
  Menu,
  X,
  ArrowLeft
} from "lucide-react";
import { Server, CATEGORY_LOGOS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = "/api";

export default function AdminDashboard() {
  const { token, user, loading: authLoading } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [serverSearch, setServerSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [serverToReject, setServerToReject] = useState<Server | null>(null);
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  // Settings State
  const [activeTab, setActiveTab] = useState("overview");
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // Stats State
  const [stats, setStats] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState("");

  // Events State
  const [events, setEvents] = useState<any[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    icon: "🎉",
    link: "",
    color: "primary"
  });

  // Users Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserServers, setSelectedUserServers] = useState<any[]>([]);
  const [isUserServersModalOpen, setIsUserServersModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Custom Links State
  const [linkSearch, setLinkSearch] = useState("");
  const [isRemovingLink, setIsRemovingLink] = useState<string | null>(null);

  // Server Description Modal State
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [viewingDescription, setViewingDescription] = useState<string>("");
  const [viewingServerName, setViewingServerName] = useState<string>("");

  useEffect(() => {
    if (!authLoading) {
      if (!token) {
        window.location.href = "/";
        return;
      }
      
      // IDs de admin configurados no ambiente
      const adminIds = (import.meta.env.VITE_ADMIN_IDS || "").split(",").map((id: string) => id.trim());
      const isAdmin = user && adminIds.includes(user.id);
      
      if (!isAdmin) {
        window.location.href = "/";
        return;
      }

      fetchStats();
      fetchServers();
      fetchSettings();
      fetchLogs();
      fetchEvents();
      fetchUsers();
    }
  }, [token, authLoading, user]);

  const fetchUsers = async () => {
    if (!token) return;
    try {
      setIsUsersLoading(true);
      const res = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsersList(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const fetchUserServers = async (user: any) => {
    if (!token) return;
    try {
      setViewingUser(user);
      const res = await axios.get(`${API_URL}/admin/users/${user.id}/servers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedUserServers(res.data);
      setIsUserServersModalOpen(true);
    } catch (err) {
      toast.error("Erro ao carregar servidores do usuário.");
    }
  };

  const handleBanUser = async (userId: string, currentBanStatus: boolean) => {
    const action = currentBanStatus ? "desbanir" : "banir";
    if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) return;

    try {
      await axios.post(`${API_URL}/admin/users/${userId}/ban`, { banned: !currentBanStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Usuário ${currentBanStatus ? "desbanido" : "banido"} com sucesso!`);
      fetchUsers();
    } catch (err) {
      toast.error("Erro ao alterar status de banimento.");
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    setIsStatsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const fetchEvents = async () => {
    if (!token) return;
    try {
      setIsEventsLoading(true);
      const res = await axios.get(`${API_URL}/events`);
      setEvents(res.data);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setIsEventsLoading(false);
    }
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title || !eventForm.description) {
      toast.error("Preencha o título e a descrição.");
      return;
    }

    try {
      if (editingEvent) {
        await axios.put(`${API_URL}/admin/events/${editingEvent.id}`, eventForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Evento atualizado!");
      } else {
        await axios.post(`${API_URL}/admin/events`, eventForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Evento criado!");
      }
      setIsEventModalOpen(false);
      setEditingEvent(null);
      setEventForm({ title: "", description: "", icon: "🎉", link: "", color: "primary" });
      fetchEvents();
    } catch (err) {
      toast.error("Erro ao salvar evento.");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    try {
      await axios.delete(`${API_URL}/admin/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Evento removido!");
      fetchEvents();
    } catch (err) {
      toast.error("Erro ao excluir evento.");
    }
  };

  const fetchLogs = async () => {
    if (!token) return;
    try {
      setIsLogsLoading(true);
      const res = await axios.get(`${API_URL}/admin/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data);
    } catch (err) {
      console.error("Error fetching admin logs:", err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  const fetchSettings = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsMaintenanceMode(res.data.maintenance);
    } catch (err) {
      console.error("Error fetching admin settings:", err);
    }
  };

  const toggleMaintenance = async (enabled: boolean) => {
    if (!token) return;
    try {
      setIsUpdatingSettings(true);
      const res = await axios.post(`${API_URL}/admin/settings/maintenance`, { enabled }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsMaintenanceMode(res.data.maintenance);
      toast.success(`Modo manutenção ${res.data.maintenance ? 'ativado' : 'desativado'}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao atualizar modo manutenção.");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const fetchServers = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}/admin/servers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(res.data);
    } catch (err: any) {
      console.error("Error fetching admin servers:", err);
      setError(err.response?.data?.error || "Erro ao carregar servidores.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      const res = await axios.post(`${API_URL}/admin/servers/${id}/status`, { status, reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(prev => prev.map(s => s.id === id ? res.data : s));
      toast.success(`Servidor ${status === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso!`);
      
      if (status === 'rejected') {
          setIsRejectModalOpen(false);
          setRejectionReason("");
          setServerToReject(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao atualizar status.");
    }
  };

  const handleRejectClick = (server: Server) => {
    setServerToReject(server);
    setIsRejectModalOpen(true);
  };

  const confirmRejection = async () => {
    if (!serverToReject) return;
    if (!rejectionReason.trim()) {
        toast.error("Por favor, informe o motivo da rejeição.");
        return;
    }
    
    setIsSubmittingRejection(true);
    await updateStatus(serverToReject.id, 'rejected', rejectionReason);
    setIsSubmittingRejection(false);
  };

  const handleViewDescription = (server: Server) => {
    setViewingServerName(server.name);
    setViewingDescription(server.description);
    setIsDescriptionModalOpen(true);
  };

  const removeCustomLink = async (serverId: string) => {
    if (!token) return;
    if (!confirm("Tem certeza que deseja remover este link personalizado? O link ficará disponível para outros servidores.")) return;

    try {
      setIsRemovingLink(serverId);
      await axios.delete(`${API_URL}/admin/servers/${serverId}/custom-slug`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(prev => prev.map(s => s.id === serverId ? { ...s, custom_slug: null } : s));
      toast.success("Link personalizado removido com sucesso!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao remover link personalizado.");
    } finally {
      setIsRemovingLink(null);
    }
  };

  const toggleFeature = async (id: string, type: 'featured' | 'sponsored', current: boolean) => {
    try {
      const res = await axios.post(`${API_URL}/admin/servers/${id}/feature`, { [type]: !current }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(prev => prev.map(s => s.id === id ? res.data : s));
      toast.success(`${type === 'featured' ? 'Destaque' : 'Patrocínio'} atualizado!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao atualizar status.");
    }
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-12 text-center">
           <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-destructive inline-block">
             <AlertCircle className="h-10 w-10 mx-auto mb-4" />
             <h2 className="text-xl font-bold mb-2">Acesso Negado ou Erro</h2>
             <p>{error}</p>
             <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/"}>Voltar para Home</Button>
           </div>
        </main>
      </div>
    );
  }

  const filteredServers = servers.filter(s => 
    s.name.toLowerCase().includes(serverSearch.toLowerCase()) || 
    s.description.toLowerCase().includes(serverSearch.toLowerCase()) ||
    s.category.toLowerCase().includes(serverSearch.toLowerCase())
  );

  const pending = filteredServers.filter(s => s.status === 'pending');
  const approved = filteredServers.filter(s => s.status === 'approved');
  const rejected = filteredServers.filter(s => s.status === 'rejected');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] relative">
        {/* Mobile Sidebar Toggle */}
        <div className="md:hidden fixed top-0 left-0 right-0 flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-md z-50 shadow-sm h-16">
            <div className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                <span className="font-bold text-sm uppercase tracking-wider">Painel Admin</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
        </div>

        {/* Sidebar */}
        <aside className={`
            fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pt-20 md:pt-6">
                <div className="space-y-8 pb-6">
                    <div className="space-y-2">
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Menu Principal</h2>
                        <nav className="space-y-1">
                    <button 
                        onClick={() => {
                            setActiveTab("overview");
                            fetchStats();
                            setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'overview' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Overview
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab("servers");
                            setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'servers' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Servidores
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab("users")
                            fetchUsers();
                            setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                    >
                        <Users className="h-4 w-4" />
                        Usuários
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab("links");
                            setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'links' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                    >
                        <LinkIcon className="h-4 w-4" />
                        Links Personalizados
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab("events");
                            fetchEvents();
                            setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'events' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                    >
                        <Calendar className="h-4 w-4" />
                        Eventos
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab("logs");
                            fetchLogs();
                            setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'logs' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                    >
                        <History className="h-4 w-4" />
                        Logs
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab("settings");
                            setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                    >
                        <Settings className="h-4 w-4" />
                        Configurações
                    </button>
                </nav>
            </div>
            </div>
            </div>

            <div className="p-6 border-t border-border bg-card shrink-0 space-y-4">
                <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3 font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => navigate('/')}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Sair da Admin
                </Button>

                <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase font-black mb-2">Administrador</p>
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-foreground truncate">{user?.username}</p>
                            <p className="text-[10px] text-muted-foreground truncate">ID: {user?.id}</p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
            <div 
                className="fixed inset-0 z-30 bg-black/50 md:hidden" 
                onClick={() => setSidebarOpen(false)}
            />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 lg:p-12 max-w-5xl mx-auto w-full overflow-x-hidden">
            {activeTab === 'overview' ? (
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                            <LayoutDashboard className="h-10 w-10 text-primary" />
                            Overview do Sistema
                        </h1>
                        <p className="text-muted-foreground">Estatísticas gerais e métricas de desempenho.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:border-primary/50 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <User className="h-5 w-5" />
                                </div>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Total Usuários</span>
                            </div>
                            <h3 className="text-2xl font-black text-foreground">
                                {isStatsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalUsers || 0}
                            </h3>
                            <p className="text-[9px] text-muted-foreground mt-1 font-medium">Registrados via Discord</p>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:border-primary/50 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                    <ShieldAlert className="h-5 w-5" />
                                </div>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Com Server</span>
                            </div>
                            <h3 className="text-2xl font-black text-foreground">
                                {isStatsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.usersWithServers || 0}
                            </h3>
                            <p className="text-[9px] text-muted-foreground mt-1 font-medium">Enviaram pelo menos 1</p>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:border-primary/50 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Ativos</span>
                            </div>
                            <h3 className="text-2xl font-black text-foreground">
                                {isStatsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.approvedServers || 0}
                            </h3>
                            <p className="text-[9px] text-muted-foreground mt-1 font-medium">Servidores aprovados</p>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:border-primary/50 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Pendentes</span>
                            </div>
                            <h3 className="text-2xl font-black text-foreground">
                                {isStatsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.pendingServers || 0}
                            </h3>
                            <p className="text-[9px] text-muted-foreground mt-1 font-medium">Aguardando análise</p>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm group hover:border-primary/50 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                                    <XCircle className="h-5 w-5" />
                                </div>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Recusados</span>
                            </div>
                            <h3 className="text-2xl font-black text-foreground">
                                {isStatsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.rejectedServers || 0}
                            </h3>
                            <p className="text-[9px] text-muted-foreground mt-1 font-medium">Fora dos padrões</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-card border border-border rounded-2xl p-8">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary" />
                                Engajamento de Usuários
                            </h3>
                            
                            <div className="space-y-6">
                                {/* Barra Comparativa */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                        <span className="text-muted-foreground">Apenas Registro</span>
                                        <span className="text-primary">Com Servidor</span>
                                    </div>
                                    <div className="h-4 w-full bg-secondary/50 rounded-full overflow-hidden flex border border-border">
                                        <div 
                                            className="h-full bg-muted-foreground/20 transition-all duration-1000" 
                                            style={{ 
                                                width: `${stats?.totalUsers ? ((stats.totalUsers - stats.usersWithServers) / stats.totalUsers) * 100 : 0}%` 
                                            }}
                                        />
                                        <div 
                                            className="h-full bg-primary transition-all duration-1000 shadow-[0_0_15px_rgba(var(--primary),0.5)]" 
                                            style={{ 
                                                width: `${stats?.totalUsers ? (stats.usersWithServers / stats.totalUsers) * 100 : 0}%` 
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground italic">
                                        <span>{stats ? (stats.totalUsers - stats.usersWithServers) : 0} usuários</span>
                                        <span>{stats?.usersWithServers || 0} usuários</span>
                                    </div>
                                </div>

                                {/* Métricas Detalhadas */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-secondary/20 rounded-xl border border-border/50">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Taxa de Conversão</p>
                                        <p className="text-2xl font-black text-foreground">
                                            {stats?.totalUsers ? Math.round((stats.usersWithServers / stats.totalUsers) * 100) : 0}%
                                        </p>
                                    </div>
                                    <div className="p-4 bg-secondary/20 rounded-xl border border-border/50">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Média Servers/User</p>
                                        <p className="text-2xl font-black text-foreground">
                                            {stats?.usersWithServers ? (stats.totalServers / stats.usersWithServers).toFixed(1) : 0}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/10">
                                    <AlertCircle className="h-3 w-3 text-primary" />
                                    <span>O gráfico compara usuários que apenas logaram vs. usuários que efetivamente enviaram um servidor.</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-8">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <History className="h-5 w-5 text-primary" />
                                Ações Recentes
                            </h3>
                            <div className="space-y-4">
                                {logs.slice(0, 3).map((log, i) => (
                                    <div key={i} className="flex gap-4 p-3 bg-secondary/10 rounded-xl border border-border/50">
                                        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground leading-tight">{log.details}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {new Date(log.created_at).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {logs.length === 0 && (
                                    <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma ação recente.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'servers' ? (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                                <ShieldCheck className="h-10 w-10 text-primary" />
                                Gerenciar Servidores
                            </h1>
                            <p className="text-muted-foreground">Aprove, destaque ou gerencie a visibilidade dos servidores.</p>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input 
                                type="text"
                                placeholder="Pesquisar servidores..."
                                value={serverSearch}
                                onChange={(e) => setServerSearch(e.target.value)}
                                className="w-full bg-secondary/50 border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>
                    </div>

                    <Tabs defaultValue="approved" className="w-full">
                        <TabsList className="mb-8 w-full justify-start bg-transparent p-0 border-b border-border rounded-none h-auto gap-2">
                            <TabsTrigger 
                                value="approved" 
                                className="px-6 py-3 rounded-t-lg data-[state=active]:bg-card data-[state=active]:text-primary text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary transition-all font-bold"
                            >
                                Aprovados
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary text-[10px]">{approved.length}</span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="pending" 
                                className="px-6 py-3 rounded-t-lg data-[state=active]:bg-card data-[state=active]:text-primary text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary transition-all font-bold"
                            >
                                Pendentes
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary text-[10px]">{pending.length}</span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="rejected" 
                                className="px-6 py-3 rounded-t-lg data-[state=active]:bg-card data-[state=active]:text-primary text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary transition-all font-bold"
                            >
                                Rejeitados
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary text-[10px]">{rejected.length}</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="approved" className="space-y-4 focus-visible:outline-none">
                            {approved.length === 0 ? (
                                <div className="text-center py-20 border border-dashed border-border rounded-3xl bg-secondary/5">
                                    <ListFilter className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                    <p className="text-muted-foreground font-medium">Nenhum servidor aprovado no momento.</p>
                                </div>
                            ) : (
                                approved.map(server => (
                                    <AdminServerCard 
                                        key={server.id} 
                                        server={server} 
                                        onStatusUpdate={updateStatus}
                                        onFeatureToggle={toggleFeature}
                                        onRejectClick={handleRejectClick}
                                        onViewDescription={handleViewDescription}
                                    />
                                ))
                            )}
                        </TabsContent>

                        <TabsContent value="pending" className="space-y-4 focus-visible:outline-none">
                            {pending.length === 0 ? (
                                <div className="text-center py-20 border border-dashed border-border rounded-3xl bg-secondary/5">
                                    <Clock className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                    <p className="text-muted-foreground font-medium">Nenhum servidor aguardando análise.</p>
                                </div>
                            ) : (
                                pending.map(server => (
                                    <AdminServerCard 
                                        key={server.id} 
                                        server={server} 
                                        onStatusUpdate={updateStatus}
                                        onFeatureToggle={toggleFeature}
                                        onRejectClick={handleRejectClick}
                                        onViewDescription={handleViewDescription}
                                    />
                                ))
                            )}
                        </TabsContent>

                        <TabsContent value="rejected" className="space-y-4 focus-visible:outline-none">
                            {rejected.length === 0 ? (
                                <div className="text-center py-20 border border-dashed border-border rounded-3xl bg-secondary/5">
                                    <XCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                    <p className="text-muted-foreground font-medium">Nenhum servidor rejeitado.</p>
                                </div>
                            ) : (
                                rejected.map(server => (
                                    <AdminServerCard 
                                        key={server.id} 
                                        server={server} 
                                        onStatusUpdate={updateStatus}
                                        onFeatureToggle={toggleFeature}
                                        onRejectClick={handleRejectClick}
                                        onViewDescription={handleViewDescription}
                                    />
                                ))
                            )}
                        </TabsContent>
                    </Tabs>
                </>
            ) : activeTab === 'links' ? (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                                <LinkIcon className="h-10 w-10 text-primary" />
                                Links Personalizados
                            </h1>
                            <p className="text-muted-foreground">Gerencie as URLs curtas e personalizadas dos servidores.</p>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input 
                                type="text"
                                placeholder="Pesquisar por slug ou servidor..."
                                value={linkSearch}
                                onChange={(e) => setLinkSearch(e.target.value)}
                                className="w-full bg-secondary/50 border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-secondary/30 border-b border-border">
                                        <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Link</th>
                                        <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Servidor</th>
                                        <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dono</th>
                                        <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {servers
                                        .filter(s => s.custom_slug)
                                        .filter(s => 
                                            s.custom_slug?.toLowerCase().includes(linkSearch.toLowerCase()) || 
                                            s.name.toLowerCase().includes(linkSearch.toLowerCase()) ||
                                            s.owner_name?.toLowerCase().includes(linkSearch.toLowerCase())
                                        )
                                        .map(server => (
                                            <tr key={server.id} className="hover:bg-secondary/10 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-primary bg-primary/10 px-2 py-1 rounded text-xs uppercase">
                                                            /{server.custom_slug}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {server.icon_url ? (
                                                            <img src={server.icon_url} alt="" className="h-8 w-8 rounded-lg" />
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center font-bold text-[10px]">
                                                                {server.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <span className="font-bold text-sm text-foreground">{server.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full overflow-hidden bg-secondary flex items-center justify-center font-bold text-[8px]">
                                                            {server.owner_avatar ? (
                                                                <img src={server.owner_avatar} alt="" className="h-full w-full object-cover" />
                                                            ) : (
                                                                server.owner_name?.charAt(0) || '?'
                                                            )}
                                                        </div>
                                                        <span className="text-sm text-muted-foreground">{server.owner_name || 'Desconhecido'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-8 font-bold text-xs"
                                                            onClick={() => window.open(`/c/${server.custom_slug}`, '_blank')}
                                                        >
                                                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                            Ver Página
                                                        </Button>
                                                        <Button 
                                                            variant="destructive" 
                                                            size="sm" 
                                                            className="h-8 font-bold text-xs"
                                                            onClick={() => removeCustomLink(server.id)}
                                                            disabled={isRemovingLink === server.id}
                                                        >
                                                            {isRemovingLink === server.id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                                            )}
                                                            Remover
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    {servers.filter(s => s.custom_slug).length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-12 text-center">
                                                <div className="flex flex-col items-center">
                                                    <LinkIcon className="h-12 w-12 text-muted-foreground/20 mb-4" />
                                                    <p className="text-muted-foreground font-medium">Nenhum link personalizado configurado.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'events' ? (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                                <Calendar className="h-10 w-10 text-primary" />
                                Gerenciar Eventos
                            </h1>
                            <p className="text-muted-foreground">Crie e gerencie os avisos do carrossel da página principal.</p>
                        </div>
                        <Button 
                            className="h-10 font-bold"
                            onClick={() => {
                                setEditingEvent(null);
                                setEventForm({ title: "", description: "", icon: "🎉", link: "", color: "primary" });
                                setIsEventModalOpen(true);
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Evento
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {isEventsLoading ? (
                            <div className="text-center py-20 border border-dashed border-border rounded-3xl bg-secondary/5">
                                <Loader2 className="h-12 w-12 text-primary/20 mx-auto mb-4 animate-spin" />
                                <p className="text-muted-foreground font-medium">Carregando eventos...</p>
                            </div>
                        ) : events.length === 0 ? (
                            <div className="text-center py-20 border border-dashed border-border rounded-3xl bg-secondary/5">
                                <Calendar className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">Nenhum evento ativo.</p>
                            </div>
                        ) : (
                            events.map(event => (
                                <div key={event.id} className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between group hover:shadow-lg transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center text-3xl">
                                            {event.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-foreground">{event.title}</h3>
                                            <p className="text-sm text-muted-foreground">{event.description}</p>
                                            {event.link && (
                                                <div className="flex items-center gap-1 text-[10px] text-primary font-bold mt-1">
                                                    <LinkIcon className="h-3 w-3" />
                                                    {event.link}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-9 w-9 p-0"
                                            onClick={() => {
                                                setEditingEvent(event);
                                                setEventForm({
                                                    title: event.title,
                                                    description: event.description,
                                                    icon: event.icon,
                                                    link: event.link || "",
                                                    color: event.color || "primary"
                                                });
                                                setIsEventModalOpen(true);
                                            }}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                            variant="destructive" 
                                            size="sm" 
                                            className="h-9 w-9 p-0"
                                            onClick={() => handleDeleteEvent(event.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
                        <DialogContent className="sm:max-w-[500px] rounded-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black">{editingEvent ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
                                <DialogDescription>
                                    Preencha os dados abaixo para exibir no carrossel da Home.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="space-y-2 col-span-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ícone</label>
                                        <input 
                                            className="w-full bg-secondary border border-border rounded-xl py-3 px-4 text-2xl text-center outline-none focus:ring-2 focus:ring-primary/20"
                                            value={eventForm.icon}
                                            onChange={(e) => setEventForm({...eventForm, icon: e.target.value})}
                                            placeholder="🎉"
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título</label>
                                        <input 
                                            className="w-full bg-secondary border border-border rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            value={eventForm.title}
                                            onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                                            placeholder="Ex: Novo Servidor em Destaque!"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descrição</label>
                                    <Textarea 
                                        className="bg-secondary border border-border rounded-xl min-h-[80px] focus-visible:ring-primary/20"
                                        value={eventForm.description}
                                        onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                                        placeholder="Breve descrição do evento..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Link (Opcional)</label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input 
                                            className="w-full bg-secondary border border-border rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            value={eventForm.link}
                                            onChange={(e) => setEventForm({...eventForm, link: e.target.value})}
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsEventModalOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSaveEvent}>Salvar Evento</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            ) : activeTab === 'users' ? (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                                <Users className="h-10 w-10 text-primary" />
                                Gestão de Usuários
                            </h1>
                            <p className="text-muted-foreground">Monitore usuários registrados e gerencie permissões.</p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 font-bold"
                            onClick={fetchUsers}
                            disabled={isUsersLoading}
                        >
                            <Activity className={`mr-2 h-4 w-4 ${isUsersLoading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                    </div>

                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input 
                            type="text"
                            placeholder="Buscar por username, ID ou e-mail..."
                            className="w-full bg-secondary/50 border border-border rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                        />
                    </div>

                    <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-secondary/30 border-b border-border">
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuário</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">E-mail</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registro</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Servidores</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isUsersLoading && usersList.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                                                Carregando usuários...
                                            </td>
                                        </tr>
                                    ) : usersList.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                                                Nenhum usuário encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        usersList
                                            .filter(u => 
                                                u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
                                                u.id.toLowerCase().includes(userSearch.toLowerCase()) ||
                                                (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()))
                                            )
                                            .map((u) => (
                                                <tr key={u.id} className="hover:bg-secondary/10 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                                                {u.avatar_url ? (
                                                                    <img src={u.avatar_url} className="h-full w-full rounded-full" alt="" />
                                                                ) : u.username.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-foreground leading-none mb-1">{u.username}</span>
                                                                <span className="text-[10px] text-muted-foreground font-mono">ID: {u.id}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-muted-foreground">
                                                        {u.email && u.email !== "Não informado" ? u.email : "Não informado"}
                                                    </td>
                                                    <td className="px-6 py-4 text-[11px] text-muted-foreground">
                                                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button 
                                                            onClick={() => fetchUserServers(u)}
                                                            className="flex items-center gap-2 group/btn"
                                                        >
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.serverCount > 0 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                                                                {u.serverCount} servers
                                                            </span>
                                                            {u.serverCount > 0 && <Eye className="h-3 w-3 text-muted-foreground group-hover/btn:text-primary transition-colors" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                            u.is_banned 
                                                                ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                                                                : 'bg-green-500/10 text-green-500 border-green-500/20'
                                                        }`}>
                                                            {u.is_banned ? 'Banido' : 'Ativo'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Button 
                                                            size="sm" 
                                                            variant={u.is_banned ? "outline" : "destructive"} 
                                                            className="h-8 text-[10px] font-bold"
                                                            onClick={() => handleBanUser(u.id, !!u.is_banned)}
                                                        >
                                                            {u.is_banned ? (
                                                                <>Desbanir</>
                                                            ) : (
                                                                <>
                                                                    <Ban className="mr-1 h-3 w-3" />
                                                                    Banir
                                                                </>
                                                            )}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* User Servers Modal */}
                    <Dialog open={isUserServersModalOpen} onOpenChange={setIsUserServersModalOpen}>
                        <DialogContent className="sm:max-w-3xl bg-card border-border max-h-[80vh] flex flex-col p-0">
                            <DialogHeader className="p-6 pb-0">
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    <LayoutDashboard className="h-5 w-5 text-primary" />
                                    Servidores de {viewingUser?.username}
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground">
                                    Lista detalhada de todos os servidores enviados por este usuário.
                                </DialogDescription>
                            </DialogHeader>
                            
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {selectedUserServers.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground italic border border-dashed border-border rounded-2xl">
                                        Nenhum servidor enviado por este usuário.
                                    </div>
                                ) : (
                                    selectedUserServers.map(server => (
                                        <div key={server.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/20">
                                            <div className="h-12 w-12 rounded-lg bg-secondary shrink-0 overflow-hidden">
                                                {server.icon_url ? (
                                                    <img src={server.icon_url} className="h-full w-full object-cover" alt="" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-xl">
                                                        {server.icon_emoji || "🏠"}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-sm text-foreground truncate">{server.name}</h4>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase border ${
                                                        server.status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                        server.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                        'bg-red-500/10 text-red-500 border-red-500/20'
                                                    }`}>
                                                        {server.status}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground line-clamp-2 italic prose prose-invert prose-xs">
                                                    <ReactMarkdown 
                                                        remarkPlugins={[remarkGfm]}
                                                        allowedElements={['p', 'strong', 'em', 'code', 'span', 'ul', 'ol', 'li']}
                                                        unwrapDisallowed={true}
                                                    >
                                                        {server.description}
                                                    </ReactMarkdown>
                                                </p>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-8 w-8 p-0"
                                                onClick={() => {
                                                    setIsUserServersModalOpen(false);
                                                    setActiveTab("servers");
                                                    // This is a simple trick to highlight/filter, in a real app we'd filter the list
                                                }}
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <DialogFooter className="p-6 pt-2 border-t border-border">
                                <Button onClick={() => setIsUserServersModalOpen(false)}>Fechar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            ) : activeTab === 'logs' ? (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                                <History className="h-10 w-10 text-primary" />
                                Logs de Auditoria
                            </h1>
                            <p className="text-muted-foreground">Histórico de ações administrativas e eventos do sistema.</p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 font-bold"
                            onClick={fetchLogs}
                            disabled={isLogsLoading}
                        >
                            <Activity className={`mr-2 h-4 w-4 ${isLogsLoading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                    </div>

                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input 
                            type="text"
                            placeholder="Filtrar por ação, usuário ou detalhe..."
                            className="w-full bg-secondary/50 border border-border rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            value={logSearch}
                            onChange={(e) => setLogSearch(e.target.value)}
                        />
                    </div>

                    <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-secondary/30 border-b border-border">
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data/Hora</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ação</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuário</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Detalhes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isLogsLoading && logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                                                Carregando registros...
                                            </td>
                                        </tr>
                                    ) : logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                                                Nenhum log encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs
                                            .filter(log => 
                                                log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
                                                log.details.toLowerCase().includes(logSearch.toLowerCase()) ||
                                                log.username.toLowerCase().includes(logSearch.toLowerCase())
                                            )
                                            .map((log) => (
                                                <tr key={log.id} className="hover:bg-secondary/10 transition-colors">
                                                    <td className="px-6 py-4 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                                                        {new Date(log.created_at).toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                                            log.type === 'security' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                                            log.type === 'admin' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                                            log.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                                            log.type === 'warning' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                                                            'bg-secondary text-muted-foreground border border-border'
                                                        }`}>
                                                            {log.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-bold text-foreground">
                                                            {log.action.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                                {log.username.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="text-xs font-medium text-foreground">{log.username}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-xs text-muted-foreground max-w-md line-clamp-2" title={log.details}>
                                                            {log.details}
                                                        </p>
                                                    </td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'settings' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                        <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                            <Settings className="h-10 w-10 text-primary" />
                            Configurações Globais
                        </h1>
                        <p className="text-muted-foreground">Controle parâmetros gerais do sistema.</p>
                    </div>

                    <div className="grid gap-6">
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                <Hammer className="h-32 w-32 rotate-12" />
                            </div>
                            
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Power className={`h-5 w-5 ${isMaintenanceMode ? 'text-destructive animate-pulse' : 'text-green-500'}`} />
                                        <h3 className="text-xl font-bold">Modo Manutenção</h3>
                                    </div>
                                    <p className="text-muted-foreground text-sm max-w-md">
                                        Quando ativado, usuários comuns não poderão acessar o site, exibindo uma página de aviso. Administradores continuam com acesso normal.
                                    </p>
                                </div>

                                <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-xl border border-border/50">
                                    <span className={`text-sm font-black uppercase tracking-wider ${isMaintenanceMode ? 'text-destructive' : 'text-green-500'}`}>
                                        {isMaintenanceMode ? 'Ativado' : 'Desativado'}
                                    </span>
                                    <Switch 
                                        checked={isMaintenanceMode}
                                        onCheckedChange={toggleMaintenance}
                                        disabled={isUpdatingSettings}
                                        className="data-[state=checked]:bg-destructive"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Mais opções de configuração podem ser adicionadas aqui */}
                    </div>
                </div>
            ) : (
                <div className="text-center py-20">
                    <p className="text-muted-foreground">Selecione uma opção no menu lateral.</p>
                </div>
            )}
        </main>
      </div>

      {/* Rejection Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Recusar Servidor
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Informe o motivo pelo qual o servidor <strong>{serverToReject?.name}</strong> está sendo recusado. Este motivo será registrado nos logs.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Ex: Descrição inadequada, servidor sem conteúdo, viola as regras..."
              className="min-h-[120px] bg-secondary/20 border-border focus:border-destructive/50 resize-none"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)} disabled={isSubmittingRejection}>
              Cancelar
            </Button>
            <Button 
                variant="destructive" 
                onClick={confirmRejection} 
                disabled={isSubmittingRejection || !rejectionReason.trim()}
                className="font-bold"
            >
              {isSubmittingRejection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
              ) : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Description Modal */}
      <Dialog open={isDescriptionModalOpen} onOpenChange={setIsDescriptionModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] bg-card border-border overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
              <FileText className="h-5 w-5" />
              Descrição: {viewingServerName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            <div className="prose prose-invert prose-sm max-w-none bg-secondary/20 p-6 rounded-2xl border border-border/50">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                allowedElements={['p', 'strong', 'em', 'code', 'span', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'a', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td']}
                transformLinkUri={(href) => href.startsWith('http') ? href : ''}
                transformImageUri={(src) => src.startsWith('http') ? src : ''}
              >
                {viewingDescription}
              </ReactMarkdown>
            </div>
          </div>
          <DialogFooter className="p-6 pt-0">
            <Button variant="outline" onClick={() => setIsDescriptionModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminServerCard({ 
    server, 
    onStatusUpdate,
    onFeatureToggle,
    onRejectClick,
    onViewDescription
}: { 
    server: Server; 
    onStatusUpdate: (id: string, status: 'approved' | 'rejected', reason?: string) => void;
    onFeatureToggle: (id: string, type: 'featured' | 'sponsored', current: boolean) => void;
    onRejectClick: (server: Server) => void;
    onViewDescription: (server: Server) => void;
}) {
  return (
    <div className="group relative flex flex-col md:flex-row items-center gap-6 p-5 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all shadow-sm">
      {/* Icon */}
      <div className="h-20 w-20 rounded-2xl overflow-hidden bg-secondary shrink-0">
        {server.icon_url ? (
          <img src={server.icon_url} alt={server.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl">
            {server.icon_emoji || "🏠"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 text-center md:text-left space-y-1 min-w-0">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <h3 className="text-lg font-bold text-foreground truncate max-w-full">{server.name}</h3>
            <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground font-mono shrink-0">
                {server.guild_id}
            </span>
            <div className="flex flex-wrap gap-1 justify-center md:justify-start">
                {server.sponsored && (
                    <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-yellow-500/20">
                        <Star className="h-2.5 w-2.5 fill-current" /> Patrocinado
                    </span>
                )}
                {server.featured && (
                    <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-primary/20">
                        <Star className="h-2.5 w-2.5 fill-current" /> Destaque
                    </span>
                )}
            </div>
        </div>
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="flex h-5 min-w-5 items-center justify-center px-1">
              <img
                src={CATEGORY_LOGOS[server.category]}
                className="h-3 w-auto max-w-[28px] object-contain"
                alt={`${server.category} logo`}
                loading="lazy"
              />
            </span>
            {server.category}
          </span>
          <span className="hidden xs:inline">•</span>
          <span className="shrink-0">{server.members.toLocaleString("pt-BR")} membros</span>
        </div>
        
        {server.custom_slug && (
            <div className="flex items-center justify-center md:justify-start gap-1.5 mt-1">
                <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 truncate">
                    URL: /c/{server.custom_slug}
                </span>
            </div>
        )}
        {server.status === 'rejected' && server.rejection_reason && (
            <p className="text-[11px] text-muted-foreground mt-1 border-l border-destructive/30 pl-2 text-left">
                <span className="font-bold text-destructive/80">Motivo:</span> {server.rejection_reason}
            </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0">
        <Button 
            size="sm" 
            variant="outline" 
            className="h-9 px-3 text-xs font-bold flex-1 md:flex-none"
            onClick={() => onViewDescription(server)}
        >
            <FileText className="mr-2 h-4 w-4" />
            Ver Descrição
        </Button>
        <div className="flex gap-1 border-border md:border-r md:pr-2 md:mr-2 w-full md:w-auto justify-center">
             <Button 
                size="sm" 
                variant={server.featured ? "default" : "outline"} 
                className={`h-8 px-2 text-[10px] flex-1 md:flex-none ${server.featured ? 'bg-primary/20 text-primary hover:bg-primary/30' : ''}`}
                onClick={() => onFeatureToggle(server.id, 'featured', !!server.featured)}
                title="Marcar como Destaque"
            >
                Destaque
            </Button>
            <Button 
                size="sm" 
                variant={server.sponsored ? "default" : "outline"} 
                className={`h-8 px-2 text-[10px] flex-1 md:flex-none ${server.sponsored ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' : ''}`}
                onClick={() => onFeatureToggle(server.id, 'sponsored', !!server.sponsored)}
                title="Marcar como Patrocinado"
            >
                Patrocínio
            </Button>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
            <Button size="sm" variant="outline" className="h-9 w-9 p-0 shrink-0" asChild title="Ver Página">
                <a href={server.custom_slug ? `/c/${server.custom_slug}` : `/server/${server.guild_id}`} target="_blank">
                    <Eye className="h-4 w-4" />
                </a>
            </Button>

            {server.status !== 'approved' && (
                <Button 
                    size="sm" 
                    className="h-9 bg-green-500 hover:bg-green-600 text-white font-bold flex-1 md:flex-none"
                    onClick={() => onStatusUpdate(server.id, 'approved')}
                >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aprovar
                </Button>
            )}
            
            {server.status !== 'rejected' && (
                <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-9 font-bold flex-1 md:flex-none"
                    onClick={() => onRejectClick(server)}
                >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeitar
                </Button>
            )}
        </div>
      </div>
    </div>
  );
}
