import { Server } from "./types";
import { mockServers } from "./mock-data";

const STORAGE_KEY = "ff-servers";

function loadServers(): Server[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [...mockServers];
    }
  }
  return [...mockServers];
}

function saveServers(servers: Server[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
}

export function getServers(): Server[] {
  return loadServers();
}

export function addServer(server: Omit<Server, "id" | "createdAt" | "members" | "featured" | "sponsored" | "status">): Server {
  const servers = loadServers();
  const newServer: Server = {
    ...server,
    id: Date.now().toString(),
    createdAt: new Date().toISOString().split("T")[0],
    members: Math.floor(Math.random() * 500) + 10,
    featured: false,
    sponsored: false,
    status: "pending",
  };
  servers.push(newServer);
  saveServers(servers);
  return newServer;
}

export function getServerById(id: string): Server | undefined {
  return loadServers().find((s) => s.id === id);
}
