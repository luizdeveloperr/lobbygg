import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signInWithDiscord: () => void;
  signOut: () => Promise<void>;
  apiUrl: string;
  getHeaders: (token?: string | null) => Record<string, string>;
}

const INTERNAL_SECRET = import.meta.env.VITE_INTERNAL_API_SECRET || "";

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  signInWithDiscord: () => {},
  signOut: async () => {},
  apiUrl: "/api",
  getHeaders: () => ({}),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const API_URL = "/api";

  const getHeaders = (token?: string | null) => {
    const headers: Record<string, string> = {
      "X-Internal-Secret": INTERNAL_SECRET,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const checkSession = async (token: string) => {
    try {
      // Timeout de 5 segundos para não ficar carregando infinitamente
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${API_URL}/auth/me`, {
        headers: getHeaders(token),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(token);
      } else {
        console.warn("Sessão inválida, deslogando...");
        localStorage.removeItem("auth_token");
        setUser(null);
        setToken(null);
      }
    } catch (error) {
      console.error("Erro ao verificar sessão:", error);
      // Não removemos o token imediatamente em caso de erro de rede, 
      // mas paramos o loading para o site não travar
      if (error instanceof Error && error.name !== 'AbortError') {
         toast.error("Erro de conexão com o servidor de autenticação.");
      }
      // Se for timeout, talvez o servidor esteja offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      // 1. Check for token in URL hash (Callback from backend)
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace("#", "?"));
      const tokenFromUrl = params.get("token");

      if (tokenFromUrl) {
        localStorage.setItem("auth_token", tokenFromUrl);
        // Clear hash
        window.history.replaceState(null, "", window.location.pathname);
        await checkSession(tokenFromUrl);
      } else {
        // 2. Check local storage
        const storedToken = localStorage.getItem("auth_token");
        if (storedToken) {
          await checkSession(storedToken);
        } else {
          setLoading(false);
        }
      }
    };

    initAuth();
  }, [location]);

  const signInWithDiscord = () => {
    console.log("Iniciando login com Discord...");
    // Redirecionamento direto
    window.location.href = `${API_URL}/auth/discord`;
  };

  const signOut = async () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setToken(null);
    navigate("/");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signInWithDiscord, signOut, apiUrl: API_URL, getHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
