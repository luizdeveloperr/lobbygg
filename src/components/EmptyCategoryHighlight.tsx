import { Plus, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ServerCategory } from "@/lib/types";

interface EmptyCategoryHighlightProps {
  category: ServerCategory | null;
}

export const EmptyCategoryHighlight = ({ category }: EmptyCategoryHighlightProps) => {
  return (
    <div className="col-span-full py-16 px-6 flex flex-col items-center text-center bg-gradient-to-b from-card/50 to-background rounded-3xl border border-dashed border-primary/20 animate-in fade-in zoom-in duration-500">
      <div className="relative mb-6">
        <div className="absolute -inset-4 bg-primary/10 rounded-full blur-xl animate-pulse" />
        <div className="relative bg-card p-5 rounded-2xl border border-primary/10 shadow-xl">
          <Rocket className="w-12 h-12 text-primary" />
        </div>
        <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-500 animate-bounce" />
      </div>

      <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
        Seja o pioneiro! 🏆
      </h3>
      
      <p className="text-muted-foreground max-w-md mb-8 text-lg">
        Ainda não temos servidores na categoria <span className="text-primary font-semibold">{category || "esta categoria"}</span>. 
        Que tal ser o primeiro a destacar sua comunidade aqui?
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <Button asChild size="lg" className="rounded-full px-8 gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105">
          <Link to="/add">
            <Plus className="w-5 h-5" />
            Adicionar meu Servidor
          </Link>
        </Button>
        
        <p className="text-sm text-muted-foreground italic">
          Ganhe visibilidade imediata
        </p>
      </div>
    </div>
  );
};
