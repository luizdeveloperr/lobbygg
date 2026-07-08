import { useState, useMemo } from "react";
import { ServerCard } from "@/components/ServerCard";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Header } from "@/components/Header";
import { EventCarousel } from "@/components/EventCarousel";
import { EmptyCategoryHighlight } from "@/components/EmptyCategoryHighlight";
import { useServers } from "@/hooks/queries/useServers";
import { ServerCategory } from "@/lib/types";
import { Loader2 } from "lucide-react";

const Index = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ServerCategory | null>(null);

  const { data: servers = [], isLoading, error } = useServers();

  const sponsored = servers.filter((s) => s.sponsored);
  const featured = servers.filter((s) => s.featured && !s.sponsored);
  const rest = servers.filter((s) => !s.featured && !s.sponsored);

  const filtered = useMemo(() => {
    let list = rest;
    if (category) list = list.filter((s) => s.category === category);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [rest, category, search]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
            Servidores de{" "}
            <span className="text-primary">Jogos</span> 
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Encontre os melhores servidores de Free Fire, Fortnite, Minecraft e muito mais.
          </p>
          <div className="mt-8 mx-auto max-w-xl">
            <SearchBar value={search} onChange={setSearch} />
          </div>
        </div>
      </section>

      <main className="w-full px-4 sm:px-8 pb-20">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">
            Erro ao carregar servidores. Tente novamente mais tarde.
          </div>
        ) : (
          <>
            {/* Sponsored */}
            {sponsored.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-5 text-xl font-bold text-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Patrocinados
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {sponsored.map((s) => (
                    <ServerCard key={s.id} server={s} variant="sponsored" />
                  ))}
                </div>
              </section>
            )}

            {/* Featured */}
            {featured.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-5 text-xl font-bold text-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Em Destaque
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map((s) => (
                    <ServerCard key={s.id} server={s} variant="featured" />
                  ))}
                </div>
              </section>
            )}

            {/* All servers */}
            <section className="mt-12">
              <EventCarousel />
              <h2 className="mb-5 text-xl font-bold text-foreground">
                Todos os Servidores
              </h2>
              <CategoryFilter selected={category} onSelect={setCategory} />
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.length > 0 ? (
                  filtered.map((s) => <ServerCard key={s.id} server={s} />)
                ) : (
                  <EmptyCategoryHighlight category={category} />
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <p className="text-center text-sm text-muted-foreground">
          © 2026 LobbyGG — Servidores Competitivos
        </p>
      </footer>
    </div>
  );
};

export default Index;
