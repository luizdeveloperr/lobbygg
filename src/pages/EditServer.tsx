import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useServer, useUpdateServer } from "@/hooks/queries/useServers";
import { ServerCategory, CATEGORIES, CATEGORY_ICONS } from "@/lib/types";
import { toast } from "sonner";
import { Loader2, ArrowLeft, AlertTriangle, Check, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const EditServer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, token, getHeaders } = useAuth();
  
  const { data: server, isLoading: isServerLoading } = useServer(id || "");
  const updateServerMutation = useUpdateServer();

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ServerCategory>("Competitivo");
  const [tagsInput, setTagsInput] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [minBetValue, setMinBetValue] = useState<string>("");
  const [customRoomValue, setCustomRoomValue] = useState<string>("");
  const [boostReminder, setBoostReminder] = useState(false);
  const [autoBoost, setAutoBoost] = useState(false);
  const [hasSiteInBio, setHasSiteInBio] = useState(false);
  const [checkingBio, setCheckingBio] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{
    available: boolean;
    loading: boolean;
    error?: string;
    reserved?: boolean;
  }>({ available: true, loading: false });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Initialize form when server data is loaded
  useEffect(() => {
    if (server) {
      setDescription(server.description);
      setCategory(server.category);
      setTagsInput(server.tags.join(", "));
      setBannerUrl(server.banner_url || "");
      setCustomSlug(server.custom_slug || "");
      setMinBetValue(server.min_bet_value?.toString() || "");
      setCustomRoomValue(server.custom_room_value?.toString() || "");
      setBoostReminder(!!server.boost_reminder);
      setAutoBoost(!!server.auto_boost);
    }
  }, [server]);

  // Check Bio
  useEffect(() => {
    const checkBio = async () => {
      if (!user) return;
      const authToken = token || localStorage.getItem("auth_token");
      if (!authToken) return;
      setCheckingBio(true);
      try {
        const res = await fetch(`/api/user/check-bio`, {
          headers: getHeaders(authToken),
        });
        if (!res.ok) {
          setHasSiteInBio(false);
          return;
        }
        const data = await res.json();
        setHasSiteInBio(data.hasSiteInBio);
      } catch (err) {
        console.error("Error checking bio:", err);
      } finally {
        setCheckingBio(false);
      }
    };

    if (server?.status === 'approved') {
      checkBio();
    }
  }, [user, server?.status]);

  // Check slug availability
  useEffect(() => {
    const checkSlug = async () => {
      // If empty, it's valid (optional field)
      if (!customSlug) {
        setSlugStatus({ available: true, loading: false });
        return;
      }

      // If it's the current slug, it's valid
      if (customSlug === server?.custom_slug) {
        setSlugStatus({ available: true, loading: false });
        return;
      }

      if (!/^[a-z0-9-]+$/.test(customSlug)) {
        setSlugStatus({ available: false, loading: false, error: "Use apenas letras minúsculas, números e hifens." });
        return;
      }

      if (customSlug.length < 3 || customSlug.length > 20) {
        setSlugStatus({ available: false, loading: false, error: "O convite deve ter entre 3 e 20 caracteres." });
        return;
      }

      setSlugStatus(prev => ({ ...prev, loading: true }));
      try {
        const response = await fetch(`/api/slugs/check/${customSlug}?currentServerId=${id}`);
        const data = await response.json();
        
        setSlugStatus({ 
          available: data.available, 
          loading: false, 
          error: data.reason,
          reserved: data.reserved
        });
      } catch (err) {
        console.error("Check slug error:", err);
        setSlugStatus({ available: false, loading: false, error: "Erro ao conectar com o servidor." });
      }
    };

    const timeoutId = setTimeout(checkSlug, 500);
    return () => clearTimeout(timeoutId);
  }, [customSlug, server?.custom_slug, id]);

  const handleSubmit = () => {
    if (!description.trim()) {
      toast.error("Preencha a descrição!");
      return;
    }

    if (customSlug && !slugStatus.available) {
      toast.error(slugStatus.error || "Este convite não está disponível.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    updateServerMutation.mutate(
      {
        id: id!,
        updates: {
          description: description.trim(),
          category,
          tags,
          bannerUrl: bannerUrl.trim() || null,
          customSlug: customSlug.trim() || null,
          min_bet_value: minBetValue ? parseFloat(minBetValue) : null,
          custom_room_value: customRoomValue ? parseFloat(customRoomValue) : null,
          boost_reminder: boostReminder && !autoBoost,
          auto_boost: autoBoost && hasSiteInBio && !boostReminder,
        },
      },
      {
        onSuccess: (updated) => {
          const onlySettingsChange =
            server.status === "approved" &&
            updated?.status === "approved" &&
            (boostReminder !== !!server.boost_reminder || autoBoost !== !!server.auto_boost);

          toast.success(onlySettingsChange ? "Configurações salvas!" : "Servidor atualizado e enviado para revisão!");
          navigate("/my-servers");
        },
        onError: (error) => {
          console.error(error);
          toast.error("Erro ao atualizar servidor.");
        },
      }
    );
  };

  const inputClass =
    "w-full rounded-xl border border-border bg-card py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all";

  if (isServerLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold">Servidor não encontrado</h1>
          <Button onClick={() => navigate("/my-servers")} className="mt-4">
            Voltar
          </Button>
        </main>
      </div>
    );
  }

  // Basic security check on frontend (backend also checks)
  if (user && server.user_id !== user.id) {
     return (
        <div className="min-h-screen bg-background">
          <Header />
          <main className="mx-auto max-w-2xl px-4 py-12 text-center">
            <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
            <p className="mt-2 text-muted-foreground">Você não tem permissão para editar este servidor.</p>
            <Button onClick={() => navigate("/my-servers")} className="mt-4">
              Voltar
            </Button>
          </main>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Editar Servidor</h1>
          <p className="mt-2 text-muted-foreground">
            Atualize as informações do seu servidor.
          </p>
        </div>

        <Alert variant="destructive" className="mb-8 border-yellow-500/50 bg-yellow-500/10 text-yellow-500">
          <AlertTriangle className="h-4 w-4 stroke-yellow-500" />
          <AlertTitle className="text-yellow-500 font-bold">Atenção!</AlertTitle>
          <AlertDescription className="text-yellow-500/90">
            Ao salvar qualquer alteração, seu servidor voltará para o status <strong>Em Análise</strong> e precisará ser aprovado novamente pela nossa equipe.
          </AlertDescription>
        </Alert>

        <div className="rounded-2xl border border-border bg-card/50 p-6 md:p-8 backdrop-blur-sm">
          {/* Read Only Info */}
          <div className="mb-6 space-y-4 border-b border-border pb-6">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nome do Servidor (Não editável)
              </label>
              <div className="w-full rounded-xl border border-border bg-secondary/50 py-3 px-4 text-sm text-muted-foreground">
                {server.name}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Convite (Gerado pelo Bot)
              </label>
              <div className="w-full rounded-xl border border-border bg-secondary/50 py-3 px-4 text-sm text-muted-foreground truncate">
                {server.inviteLink || server.invite_link || "Link não disponível"}
              </div>
            </div>
          </div>

          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setIsConfirmOpen(true); }}>
            {/* Banner URL */}
            <div>
              <label htmlFor="bannerUrl" className="mb-2 block text-sm font-medium text-foreground">
                Banner URL (Opcional)
              </label>
              <input
                id="bannerUrl"
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://imgur.com/..."
                className={inputClass}
              />
            </div>

            {/* Convite Personalizado */}
            <div>
              <label htmlFor="customSlug" className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                Convite Personalizado (Opcional)
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg bg-popover p-2 text-[10px] text-popover-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-border">
                    Crie um link fácil como: lobbygg.com.br/c/meu-servidor
                  </div>
                </div>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-xs font-medium pointer-events-none">
                  lobbygg.com.br/c/
                </div>
                <input
                  id="customSlug"
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="meu-servidor"
                  className={`${inputClass} pl-[155px] ${
                    !slugStatus.available ? 'border-destructive/50 focus:border-destructive' : 
                    (customSlug && customSlug !== server?.custom_slug ? 'border-green-500/50 focus:border-green-500' : '')
                  }`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {slugStatus.loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!slugStatus.loading && customSlug && customSlug !== server?.custom_slug && (
                    slugStatus.available ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )
                  )}
                </div>
              </div>
              
              {/* Status Message */}
              {customSlug && customSlug !== server?.custom_slug && (
                <p className={`mt-2 text-xs font-medium ${slugStatus.available ? 'text-green-500' : 'text-destructive'}`}>
                  {slugStatus.error || (slugStatus.available && "Disponível!")}
                </p>
              )}
              {customSlug && customSlug === server?.custom_slug && (
                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="h-3 w-3" /> Este é o seu convite atual.
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-foreground">
                Descrição
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputClass} min-h-[120px] resize-y`}
                placeholder="Descreva seu servidor..."
                required
              />
              <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold">M</span>
                Você pode usar <strong>Markdown</strong> para formatar sua descrição.
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Categoria</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                      category === cat
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:border-primary/50 hover:bg-secondary/50 text-muted-foreground"
                    }`}
                  >
                    <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label htmlFor="tags" className="mb-2 block text-sm font-medium text-foreground">
                Tags (separadas por vírgula)
              </label>
              <input
                id="tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className={inputClass}
                placeholder="ex: campeonato, x1, treino, ff"
              />
            </div>

            {/* Minimum Entry Value */}
            <div>
              <label htmlFor="minBetValue" className="mb-2 block text-sm font-medium text-foreground">
                Valor Mínimo de Entrada (Opcional)
              </label>
              <input
                id="minBetValue"
                type="number"
                value={minBetValue}
                onChange={(e) => setMinBetValue(e.target.value)}
                placeholder="Ex: 5.00 (para R$ 5,00)"
                className={inputClass}
                step="0.01"
                min="0"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Se o servidor tem requisitos de entrada, qual o valor mínimo? (Ex: 5.00)
              </p>
            </div>

            {/* Custom Room Value */}
            <div>
              <label htmlFor="customRoomValue" className="mb-2 block text-sm font-medium text-foreground">
                Valor das Salas Personalizadas (Opcional)
              </label>
              <input
                id="customRoomValue"
                type="number"
                value={customRoomValue}
                onChange={(e) => setCustomRoomValue(e.target.value)}
                placeholder="Ex: 10.00 (para R$ 10,00)"
                className={inputClass}
                step="0.01"
                min="0"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Se o servidor oferece salas personalizadas, qual o valor para criar uma? (Ex: 10.00)
              </p>
            </div>

            {/* Boost Reminder */}
            {server.status === 'approved' && (
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      Lembrete de Boost
                      <Badge className="bg-primary/20 text-primary border-none text-[10px]">NOVO</Badge>
                    </label>
                    <p className="text-xs text-muted-foreground max-w-[250px] sm:max-w-md">
                      Quando você estiver liberado para dar outro boost o bot enviará um lembrete na sua DM
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={autoBoost}
                    onClick={() => setBoostReminder(!boostReminder)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      boostReminder ? "bg-primary" : "bg-secondary"
                    } ${autoBoost && "opacity-50 cursor-not-allowed"}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        boostReminder ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Auto Boost */}
            {server.status === 'approved' && (
              <div className="pt-4">
                <div className={`flex flex-col gap-4 p-5 rounded-2xl border transition-all ${
                  hasSiteInBio ? "bg-purple-500/5 border-purple-500/20" : "bg-secondary/10 border-border"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="text-sm font-bold text-foreground flex items-center gap-2">
                        Auto Boost
                        <Badge className="bg-purple-500/20 text-purple-500 border-none text-[10px]">PREMIUM</Badge>
                      </label>
                      <p className="text-xs text-muted-foreground max-w-[250px] sm:max-w-md">
                        Dê boost automático a cada 2 horas sem precisar digitar nada!
                      </p>
                    </div>
                    {checkingBio ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <button
                        type="button"
                        disabled={!hasSiteInBio || boostReminder}
                        onClick={() => setAutoBoost(!autoBoost)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          autoBoost && hasSiteInBio ? "bg-purple-500" : "bg-secondary"
                        } ${(!hasSiteInBio || boostReminder) && "opacity-50 cursor-not-allowed"}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            autoBoost && hasSiteInBio ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {!hasSiteInBio && !checkingBio && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-destructive uppercase">Requisito não atendido</p>
                        <p className="text-xs text-muted-foreground">
                          Para liberar o Auto Boost, adicione o link <span className="text-foreground font-mono font-bold">lobbygg.com.br</span> no seu status do Discord e recarregue esta página.
                        </p>
                      </div>
                    </div>
                  )}

                  {hasSiteInBio && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                      <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-green-500 uppercase">Acesso Liberado!</p>
                        <p className="text-xs text-muted-foreground">
                          Identificamos o link na sua bio! Agora você pode ativar o Auto Boost para este servidor.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4">
              <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogTrigger asChild>
                  <Button type="button" className="w-full" size="lg">
                    Salvar Alterações
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar Alterações</DialogTitle>
                    <DialogDescription>
                      Tem certeza que deseja salvar? Seu servidor entrará em análise novamente e ficará oculto até ser aprovado.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>Cancelar</Button>
                    <Button onClick={() => { setIsConfirmOpen(false); handleSubmit(); }} disabled={updateServerMutation.isPending}>
                      {updateServerMutation.isPending ? "Salvando..." : "Confirmar e Enviar para Análise"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default EditServer;
