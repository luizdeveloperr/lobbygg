export type ServerStatus = "approved" | "pending" | "rejected";

export interface Server {
  id: string;
  name: string;
  description: string;
  members: number;
  category: ServerCategory;
  tags: string[];
  inviteLink: string;
  invite_link?: string; // Add optional snake_case matching DB
  iconEmoji: string;
  icon_emoji?: string; // Add optional snake_case matching DB
  icon_url?: string;
  banner_url?: string;
  featured: boolean;
  sponsored: boolean;
  createdAt: string;
  created_at?: string; // Add optional created_at matching DB snake_case
  status: ServerStatus;
  user_id?: string;
  guild_id: string;
  guildId?: string; // Optional for creating
  autoInvite?: boolean; // Optional for creating
  rejection_reason?: string;
  allow_resubmission?: boolean;
  boosts?: number;
  custom_slug?: string;
  members_online?: number;
  rating_average?: number;
  reviews_count?: number;
  min_bet_value?: number;
  custom_room_value?: number;
  boost_reminder?: boolean;
  auto_boost?: boolean;
}

export interface Review {
  id: string;
  server_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  user?: {
    username: string;
    avatar_url: string;
  };
}

export type ServerCategory =
  | "Free Fire"
  | "Fortnite"
  | "Minecraft"
  | "Roblox"
  | "Valorant"
  | "CS2"
  | "Outros";

export const CATEGORIES: ServerCategory[] = [
  "Free Fire",
  "Fortnite",
  "Minecraft",
  "Roblox",
  "Valorant",
  "CS2",
  "Outros",
];

export const CATEGORY_ICONS: Record<ServerCategory, string> = {
  "Free Fire": "🔥",
  "Fortnite": "🎮",
  "Minecraft": "⛏️",
  "Roblox": "👾",
  "Valorant": "🔫",
  "CS2": "💣",
  "Outros": "🎲",
};

export const CATEGORY_LOGOS: Record<ServerCategory, string> = {
  "Free Fire": "https://upload.wikimedia.org/wikipedia/pt/4/41/Free_Fire_logo.png",
  "Fortnite": "https://upload.wikimedia.org/wikipedia/commons/0/0e/Fortnite-logo.svg",
  "Minecraft": "https://upload.wikimedia.org/wikipedia/commons/b/bc/Minecraft_2021_logo.svg",
  "Roblox": "https://upload.wikimedia.org/wikipedia/commons/9/98/Roblox_logo.svg",
  "Valorant": "https://upload.wikimedia.org/wikipedia/commons/f/fc/Valorant_logo.svg",
  "CS2": "https://upload.wikimedia.org/wikipedia/commons/2/27/Counter-Strike_2_icon.svg",
  "Outros": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Icon_Games.svg",
};
