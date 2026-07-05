import { useState, useEffect } from "react";
import { Star, MessageSquare, Loader2, ThumbsUp, Trash2, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Review } from "@/lib/types";

interface ReviewSectionProps {
  serverId: string;
  serverName: string;
  isPending?: boolean;
}

export function ReviewSection({ serverId, serverName, isPending }: ReviewSectionProps) {
  const { user, getHeaders, signInWithDiscord, apiUrl } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  // Check if user already reviewed
  const userReview = user ? reviews.find(r => r.user_id === user.id) : null;

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${apiUrl}/servers/${serverId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (error) {
      console.error("Failed to fetch reviews", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [serverId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (rating === 0) {
      toast.error("Por favor, selecione uma nota de 1 a 5 estrelas.");
      return;
    }
    if (comment.trim().length < 3) {
      toast.error("O comentário deve ter pelo menos 3 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/servers/${serverId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getHeaders(localStorage.getItem("auth_token")),
        },
        body: JSON.stringify({ rating, comment }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao enviar avaliação");
      }

      const newReview = await res.json();
      setReviews([newReview, ...reviews]);
      setComment("");
      setRating(0);
      toast.success("Avaliação enviada com sucesso!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm("Tem certeza que deseja excluir sua avaliação?")) return;
    
    try {
      const res = await fetch(`${apiUrl}/reviews/${reviewId}`, {
        method: "DELETE",
        headers: getHeaders(localStorage.getItem("auth_token")),
      });

      if (res.ok) {
        setReviews(reviews.filter(r => r.id !== reviewId));
        toast.success("Avaliação removida.");
      } else {
        toast.error("Erro ao remover avaliação.");
      }
    } catch (error) {
      toast.error("Erro ao remover avaliação.");
    }
  };

  const averageRating = reviews.length 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6 mt-12 border-t pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
            Avaliações
            <span className="text-muted-foreground text-lg font-normal ml-2">
              ({reviews.length})
            </span>
          </h2>
          {reviews.length > 0 && (
             <p className="text-sm text-muted-foreground mt-1">
               Média de <span className="font-bold text-foreground">{averageRating}</span> estrelas
             </p>
          )}
        </div>
      </div>

      {/* Review Form */}
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        {isPending ? (
          <div className="text-center py-8">
            <Clock className="h-10 w-10 mx-auto text-yellow-500 mb-3 opacity-50" />
            <h3 className="font-semibold mb-2">Avaliações Bloqueadas</h3>
            <p className="text-sm text-muted-foreground">O servidor está em análise e não pode receber avaliações.</p>
          </div>
        ) : !user ? (
          <div className="text-center py-6">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
            <h3 className="font-semibold mb-2">Deixe sua opinião</h3>
            <p className="text-sm text-muted-foreground mb-4">Você precisa estar logado para avaliar este servidor.</p>
            <Button onClick={signInWithDiscord} className="bg-[#5865F2] hover:bg-[#4752C4] text-white">
              Entrar com Discord para Avaliar
            </Button>
          </div>
        ) : userReview ? (
          <div className="bg-secondary/20 rounded-lg p-4 border border-secondary">
             <div className="flex items-start justify-between">
                <div>
                   <h3 className="font-semibold text-primary mb-1">Você já avaliou este servidor</h3>
                   <p className="text-sm text-muted-foreground">Obrigado por contribuir com a comunidade!</p>
                </div>
                {/* Optional: Edit button could go here */}
             </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Sua nota</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="focus:outline-none transition-transform hover:scale-110"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star
                      className={`h-8 w-8 ${
                        (hoverRating || rating) >= star
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30"
                      } transition-colors`}
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Seu comentário</label>
              <Textarea
                placeholder={`O que você acha do servidor ${serverName}?`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                minLength={3}
                className="min-h-[100px] resize-none"
              />
            </div>

            <Button type="submit" disabled={submitting || rating === 0} className="w-full sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Publicar Avaliação"
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 bg-secondary/10 rounded-xl border border-dashed">
            <Star className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhuma avaliação ainda. Seja o primeiro a avaliar!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="bg-card border rounded-xl p-4 transition-all hover:shadow-md">
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={review.user?.avatar_url} />
                  <AvatarFallback>{review.user?.username?.substring(0, 2).toUpperCase() || "??"}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-sm">{review.user?.username || "Usuário Anônimo"}</h4>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  
                  <div className="flex mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          review.rating >= star
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  
                  <p className="text-sm text-foreground/90 leading-relaxed break-words">
                    {review.comment}
                  </p>
                </div>

                {user && (user.id === review.user_id || user.id === "ADMIN_ID_HERE") && (
                   <Button 
                     variant="ghost" 
                     size="icon" 
                     className="h-8 w-8 text-muted-foreground hover:text-destructive"
                     onClick={() => handleDelete(review.id)}
                   >
                     <Trash2 className="h-4 w-4" />
                   </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
