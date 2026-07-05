import { Link, useLocation, useNavigate } from "react-router-dom";
import { Flame, Plus, LogOut, User, Server as ServerIcon, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signInWithDiscord, signOut, apiUrl } = useAuth();
  const isAdmin = user && (import.meta.env.VITE_ADMIN_IDS || "").split(",").includes(user.id);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
          <img src="/lobbygg.png" alt="LobbyGG" className="h-10 w-auto sm:h-14 object-contain" />
          <span className="text-lg sm:text-2xl font-bold tracking-tight font-['Poppins'] text-foreground leading-tight">
            LobbyGG
          </span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-4">
          <Link
            to="/"
            className={`hidden md:block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              location.pathname === "/"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Explorar
          </Link>
          
          <Link
            to="/add"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 text-sm font-semibold text-primary transition-all hover:bg-primary/20 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adicionar</span>
          </Link>

          {user ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full shrink-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar_url} alt={user.username} />
                    <AvatarFallback>{user.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
                      <span className="font-bold text-primary">Painel Admin</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate("/my-servers")}>
                  <ServerIcon className="mr-2 h-4 w-4" />
                  <span>Meus Servidores</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-red-500 focus:text-red-500 focus:bg-red-500/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <a 
              href={`${apiUrl}/auth/discord`}
              className="inline-flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white h-9 sm:h-10 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors shrink-0"
            >
              <User className="h-4 w-4" />
              <span className="hidden xs:inline">Entrar com Discord</span>
              <span className="xs:hidden">Entrar</span>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
