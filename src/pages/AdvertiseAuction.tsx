import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Trophy, 
  TrendingUp, 
  ShieldCheck,
  Zap,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

export default function Advertise() {
  const [plan, setPlan] = useState<"semanal" | "mensal" | "permanente">("semanal");

  const plans = {
    semanal: { price: 50, days: 7 },
    mensal: { price: 150, days: 30 },
    permanente: { price: 500, days: 365 }
  };

  const handlePurchase = () => {
    toast.success(`Destaque ${plan} adquirido com sucesso!`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold mb-4">
            <Zap className="w-4 h-4 fill-primary" />
            DESTAQUE SEU SERVIDOR
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">
            DESTAQUE SEU <span className="text-primary">SERVIDOR</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Dê destaque ao seu servidor e atraia mais membros com tags exclusivas e posição prioritária na página principal.
          </p>
        </div>

        {/* Plans Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Weekly Plan */}
          <Card className={`p-8 rounded-3xl border-2 transition-all cursor-pointer ${plan === "semanal" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`} onClick={() => setPlan("semanal")}>
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Semanal</h3>
              <div className="text-4xl font-black text-primary mb-4">R$ 50</div>
              <p className="text-muted-foreground mb-6">7 dias de destaque</p>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Tag "Patrocinado"
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Posição prioritária
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Suporte 24h
                </li>
              </ul>
            </div>
          </Card>

          {/* Monthly Plan */}
          <Card className={`p-8 rounded-3xl border-2 transition-all cursor-pointer relative ${plan === "mensal" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`} onClick={() => setPlan("mensal")}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
              Mais Popular
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Mensal</h3>
              <div className="text-4xl font-black text-primary mb-4">R$ 150</div>
              <p className="text-muted-foreground mb-6">30 dias de destaque</p>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Tag "Patrocinado"
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Posição prioritária
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Suporte 24h
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Destaque no carrossel
                </li>
              </ul>
            </div>
          </Card>

          {/* Permanent Plan */}
          <Card className={`p-8 rounded-3xl border-2 transition-all cursor-pointer ${plan === "permanente" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`} onClick={() => setPlan("permanente")}>
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Anual</h3>
              <div className="text-4xl font-black text-primary mb-4">R$ 500</div>
              <p className="text-muted-foreground mb-6">365 dias de destaque</p>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Tag "Patrocinado" permanente
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Posição prioritária sempre
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Suporte dedicado
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Destaque no carrossel
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Página de servidor personalizada
                </li>
              </ul>
            </div>
          </Card>
        </div>

        {/* Purchase Button */}
        <div className="text-center">
          <Button 
            onClick={handlePurchase}
            className="h-16 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            COMPRAR DESTAQUE {plan.toUpperCase()}
            <Trophy className="ml-2 w-5 h-5" />
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-4">
            Pagamento seguro via Mercado Pago / Pix
          </p>
        </div>

        {/* Benefits Section */}
        <section className="mt-20 grid md:grid-cols-3 gap-8 text-center border-t border-border pt-12">
          <div>
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold">1</span>
            </div>
            <h3 className="font-bold mb-2">Escolha seu plano</h3>
            <p className="text-sm text-muted-foreground">Selecione o plano que melhor se adapta às necessidades do seu servidor.</p>
          </div>
          <div>
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold">2</span>
            </div>
            <h3 className="font-bold mb-2">Realize o pagamento</h3>
            <p className="text-sm text-muted-foreground">Pagamento rápido e seguro via Mercado Pago ou Pix.</p>
          </div>
          <div>
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold">3</span>
            </div>
            <h3 className="font-bold mb-2">Destaque imediato</h3>
            <p className="text-sm text-muted-foreground">Após o pagamento, seu servidor recebe os benefícios em até 1 hora.</p>
          </div>
        </section>

        {/* Footer CTA */}
        <div className="mt-24 text-center p-12 rounded-[3rem] bg-gradient-to-r from-primary/20 via-background to-primary/10 border border-primary/10">
          <h2 className="text-3xl font-bold mb-6">Ficou com alguma dúvida?</h2>
          <Button variant="outline" size="lg" className="rounded-full px-8 hover:bg-primary hover:text-white transition-all">
            Falar com Suporte no Discord
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </main>

      {/* Footer Copy */}
      <footer className="py-12 border-t border-border mt-12">
        <p className="text-center text-sm text-muted-foreground">
          © 2026 LobbyGG — Sistema de Destaque de Servidores. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
