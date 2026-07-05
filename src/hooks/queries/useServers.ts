
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Server } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = "/api";

export const useServers = () => {
  const { getHeaders } = useAuth();
  return useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/servers`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch servers");
      return res.json() as Promise<Server[]>;
    },
  });
};

export const useServer = (id: string) => {
  const { getHeaders } = useAuth();
  return useQuery({
    queryKey: ["server", id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/servers/${id}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch server");
      return res.json() as Promise<Server>;
    },
    enabled: !!id,
  });
};

export const useUserServers = () => {
  const { getHeaders } = useAuth();
  return useQuery({
    queryKey: ["user-servers"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("User not authenticated");

      const res = await fetch(`${API_URL}/user/servers`, {
        headers: getHeaders(token),
      });
      if (!res.ok) throw new Error("Failed to fetch user servers");
      return res.json() as Promise<Server[]>;
    },
  });
};

export const useCreateServer = () => {
  const queryClient = useQueryClient();
  const { getHeaders } = useAuth();

  return useMutation({
    mutationFn: async (newServer: Omit<Server, "id" | "createdAt" | "status" | "featured" | "sponsored" | "members">) => {
      // Get token from local storage
      const token = localStorage.getItem("auth_token");
      
      if (!token) throw new Error("User not authenticated");

      const res = await fetch(`${API_URL}/servers`, {
        method: "POST",
        headers: {
          ...getHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newServer),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create server");
      }

      return res.json() as Promise<Server>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["user-servers"] });
    },
  });
};

export const useUpdateServer = () => {
  const queryClient = useQueryClient();
  const { getHeaders } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Server> }) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("User not authenticated");

      const res = await fetch(`${API_URL}/servers/${id}`, {
        method: "PUT",
        headers: {
          ...getHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update server");
      }

      return res.json() as Promise<Server>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["user-servers"] });
    },
  });
};

export const useDeleteServer = () => {
  const queryClient = useQueryClient();
  const { getHeaders } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("User not authenticated");

      const res = await fetch(`${API_URL}/servers/${id}`, {
        method: "DELETE",
        headers: getHeaders(token),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete server");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["user-servers"] });
    },
  });
};
