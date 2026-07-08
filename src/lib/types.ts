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

const createCategoryLogo = (
  label: string,
  background: string,
  foreground: string,
  accent: string
) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="64" viewBox="0 0 160 64" fill="none">
      <rect width="160" height="64" rx="14" fill="${background}"/>
      <rect x="6" y="6" width="148" height="52" rx="10" fill="rgba(255,255,255,0.08)"/>
      <circle cx="24" cy="32" r="10" fill="${accent}"/>
      <path d="M20 32h8M24 28v8" stroke="${background}" stroke-width="2.5" stroke-linecap="round"/>
      <text
        x="42"
        y="38"
        fill="${foreground}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="20"
        font-weight="700"
        letter-spacing="0.5"
      >
        ${label}
      </text>
    </svg>
  `)}`;

export const CATEGORY_LOGOS: Record<ServerCategory, string> = {
  "Free Fire": createCategoryLogo("FREE FIRE", "#F97316", "#FFFFFF", "#FACC15"),
  "Fortnite": createCategoryLogo("FORTNITE", "#2563EB", "#FFFFFF", "#22D3EE"),
  "Minecraft": createCategoryLogo("MINECRAFT", "#166534", "#F8FAFC", "#4ADE80"),
  "Roblox": createCategoryLogo("ROBLOX", "#111827", "#FFFFFF", "#EF4444"),
  "Valorant": createCategoryLogo("VALORANT", "#7F1D1D", "#FFFFFF", "#FB7185"),
  "CS2": createCategoryLogo("CS2", "#1E293B", "#FFFFFF", "#F59E0B"),
  "Outros": createCategoryLogo("OUTROS", "#581C87", "#FFFFFF", "#A78BFA"),
};
