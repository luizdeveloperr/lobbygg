import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api"; // Assuming there is an api helper or I'll use fetch
import { useAuth } from "@/contexts/AuthContext";

interface ReportServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  serverName: string;
}

export function ReportServerDialog({
  open,
  onOpenChange,
  serverId,
  serverName,
}: ReportServerDialogProps) {
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, getHeaders, apiUrl } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Por favor, informe o motivo do report.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("auth_token");
      const headers = {
        ...getHeaders(token),
        "Content-Type": "application/json",
      };

      const response = await fetch(`${apiUrl}/reports`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          serverId,
          reason,
          contact: user ? user.username : contact,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao enviar report");
      }

      toast.success("Report enviado com sucesso. Obrigado por ajudar a comunidade!");
      onOpenChange(false);
      setReason("");
      setContact("");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar report. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reportar {serverName}</DialogTitle>
          <DialogDescription>
            Encontrou algo errado com este servidor? Conte-nos o motivo para analisarmos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo do Report <span className="text-destructive">*</span></Label>
            <Textarea
              id="reason"
              placeholder="Descreva o problema (ex: link inválido, conteúdo impróprio, golpe...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="min-h-[100px]"
            />
          </div>
          
          {!user && (
            <div className="space-y-2">
              <Label htmlFor="contact">Seu Contato (Opcional)</Label>
              <Input
                id="contact"
                placeholder="Discord ou Email para retorno"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Report"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
