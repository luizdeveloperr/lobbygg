const fs = require("fs");

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

if (!fs.existsSync(path.join(__dirname, "../dist"))) {
  console.warn("[⚠️] Pasta dist não encontrada. O frontend precisa ser buildado antes de iniciar em produção.");
}

// Fix for iconv-lite issue in some container environments
try {
  require('iconv-lite').getCodec('utf8');
} catch (e) {
  console.warn("[⚠️] iconv-lite pre-load warning:", e.message);
}

require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { pgClient: db } = require("./db");
const jwt = require("jsonwebtoken");
const axios = require("axios");

if (!process.env.JWT_SECRET) {
  console.error("❌ CRITICAL: JWT_SECRET is not defined in environment variables!");
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Simple in-memory cache for Discord Guilds
const guildsCache = new Map();
const autoBoostDisableCooldown = new Map();

// Rate Limiting (Simple In-Memory)
const rateLimit = {};
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

const limiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 1, startTime: now };
    return next();
  }

  const { count, startTime } = rateLimit[ip];

  if (now - startTime < RATE_LIMIT_WINDOW) {
    if (count >= MAX_REQUESTS) {
      return res.status(429).json({ error: "Muitas requisições. Tente novamente em 15 minutos." });
    }
    rateLimit[ip].count++;
  } else {
    rateLimit[ip] = { count: 1, startTime: now };
  }
  next();
};

let Discord;
try {
  Discord = require("discord.js");
} catch (e) {
  console.warn("discord.js not found. Bot features will be disabled.");
}

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
const ADMIN_IDS = (process.env.VITE_ADMIN_IDS || process.env.ADMIN_IDS || "").split(",").map(id => id.trim());

const adminOnly = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is banned
    const { data: user, error } = await db
      .from("users")
      .select("is_banned")
      .eq("id", decoded.id)
      .single();
    
    if (user?.is_banned) {
      console.warn(`[🚫] Acesso bloqueado para usuário banido: ${decoded.username} (${decoded.id})`);
      return res.status(403).json({ error: "Sua conta foi suspensa por violar nossos termos de uso." });
    }

    if (!ADMIN_IDS.includes(decoded.id)) {
      console.warn(`[🚫] Tentativa de acesso admin negada: ${decoded.username} (${decoded.id})`);
      return res.status(403).json({ error: "Acesso negado: Somente administradores." });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};

// Maintenance Mode State (In-memory for simplicity, or use DB for persistence)
let isMaintenanceMode = false;

// --- Admin Logging Helper ---
const logAdminAction = async (action, details, user = null, type = 'info') => {
  try {
    const logData = {
      action,
      details,
      type,
      user_id: user?.id || null,
      username: user?.username || 'Sistema',
      ip_address: null // Can be added if needed
    };

    const { error } = await db
      .from("admin_logs")
      .insert([logData]);

    if (error) {
        // If table doesn't exist yet, we'll just log to console to avoid crashing
        console.warn("[⚠️] Erro ao salvar log no DB (tabela admin_logs pode não existir):", error.message);
    }
  } catch (err) {
    console.error("[❌] Erro crítico no helper de log:", err);
  }
};

const internalOnly = (req, res, next) => {
  const path = req.path.replace(/^\/api/, '');
  const hasBearerToken = typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ");
  
  // Exceção para rotas admin (protegidas pelo adminOnly depois)
  if (path.startsWith("/admin/")) return next();
  
  // Bloqueio de manutenção para rotas não-admin
  if (isMaintenanceMode && 
      !req.path.startsWith("/auth/") && 
      !path.startsWith("/auth/") && 
      path !== "/maintenance-status" // Não bloqueia a própria checagem de status
  ) {
    return res.status(503).json({ error: "Site em manutenção" });
  }

  // Ignorar rotas públicas, de autenticação e rotas administrativas (que já possuem seu próprio middleware adminOnly)
  if (
    req.path.startsWith("/auth/") || 
    path === "/user/check-bio" || // Permite checagem de bio
    (hasBearerToken && path === "/user/guilds") || // Fluxo autenticado do Add Server
    (hasBearerToken && path === "/user/servers") || // Fluxo autenticado de Meus Servidores
    (hasBearerToken && path === "/servers" && req.method === "POST") || // Criação autenticada
    (hasBearerToken && path.startsWith("/servers/") && (req.method === "PUT" || req.method === "DELETE")) || // Edição/remoção autenticada
    path.startsWith("/slugs/") || 
    path.startsWith("/admin/") || 
    path === "/maintenance-status" || // Permite checagem de manutenção pública
    path === "/events" || // Permite carrossel público
    path === "/servers" || 
    path.startsWith("/servers/") && req.method === "GET" ||
    path.endsWith("/validate-image") // Permite reporte de imagens quebradas do frontend
  ) {
    return next();
  }

  const secret = req.headers['x-internal-secret'];
  if (!INTERNAL_API_SECRET || secret !== INTERNAL_API_SECRET) {
    const errorMsg = `Acesso externo não autorizado de ${req.ip} para ${req.path}`;
    console.warn(`[🚫] Bloqueado: ${errorMsg}`);
    
    // Log security violation (fire and forget)
    logAdminAction('ACESSO_NEGADO', errorMsg, null, 'security');

    return res.status(403).json({ error: "Acesso restrito: Somente o site oficial pode acessar esta API." });
  }
  next();
};

const app = express();
// Habilita a confiança no proxy para detectar HTTPS corretamente em produção
app.set('trust proxy', 1);

const port = process.env.PORT || 3000;

// Configurações de URL
const CANONICAL_SITE_URL = "https://lobbygg.com.br";
const CANONICAL_SITE_HOST = "lobbygg.com.br";
const SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || CANONICAL_SITE_URL).trim();

// Funções auxiliares para URLs
const getBaseUrl = (req) => {
  // Se SITE_URL estiver definida no .env, ela tem prioridade total
  if (SITE_URL) return SITE_URL.replace(/\/$/, ""); // Remove barra final se houver

  // Detecta o protocolo (http ou https) considerando o proxy
  const protocol = req.protocol;
  const host = req.get('host');
  
  return `${protocol}://${host}`;
};

// Discord Config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Middleware
app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use("/api/", internalOnly);
app.use("/api/", limiter);

const DISCORD_SCOPES = "identify email guilds guilds.join";
const TARGET_GUILD_ID = "1470858689467514942";
const DISCORD_LOGS_CHANNEL_ID = process.env.DISCORD_LOGS_CHANNEL_ID;
const DISCORD_REPORTS_CHANNEL_ID = process.env.DISCORD_REPORTS_CHANNEL_ID;
const DISCORD_DELETION_LOG_CHANNEL_ID = process.env.DISCORD_DELETION_LOG_CHANNEL_ID || DISCORD_LOGS_CHANNEL_ID;

// --- Discord Bot Setup ---
let discordClient = null;

if (Discord && DISCORD_BOT_TOKEN) {
  const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = Discord;
  
  discordClient = new Client({ 
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.GuildMember, Partials.User]
  });

  discordClient.once('clientReady', async () => {
    console.log(`[🤖] Bot iniciado como: ${discordClient.user.tag}`);
    
    // Register /boost command
    try {
      const { SlashCommandBuilder, Routes, REST } = Discord;
      const boostCommand = new SlashCommandBuilder()
        .setName('boost')
        .setDescription('Dê um boost no servidor atual para subir na lista do site!');

      const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
      console.log('[🔁] Iniciando a atualização do aplicativo (/) comandos');
      await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body: [boostCommand.toJSON()] },
      );
      console.log('[✅] Comandos (/) carregados com sucesso');
    } catch (error) {
      console.error('[❌] Erro ao registrar comandos (/) slash:', error);
    }
  });

  discordClient.on('interactionCreate', async interaction => {
    // 0. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'boost') {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        try {
          // 1. Check if server is registered in site
          const { data: server, error: serverError } = await db
            .from('servers')
            .select('id, name, boosts, status, boost_reminder, auto_boost')
            .eq('guild_id', guildId)
            .single();

          if (serverError || !server || server.status !== 'approved') {
            return interaction.reply({ 
              content: '❌ Este servidor não está postado ou aprovado no site LobbyGG. Por favor, entre em contato com os administradores do servidor.', 
              ephemeral: true 
            });
          }

          // 2. Check cooldown (2 hours = 7200000 ms)
          const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
          const { data: recentBoost, error: boostCheckError } = await db
            .from('boost_logs')
            .select('created_at')
            .eq('user_id', userId)
            .eq('server_id', server.id)
            .gt('created_at', twoHoursAgo)
            .order('created_at', { ascending: false })
            .limit(1);

          if (recentBoost && recentBoost.length > 0) {
            const nextBoostDate = new Date(new Date(recentBoost[0].created_at).getTime() + 7200000);
            const timeLeft = Math.ceil((nextBoostDate.getTime() - Date.now()) / 60000);
            return interaction.reply({ 
              content: `⏳ Você já deu boost neste servidor recentemente. Tente novamente em ${timeLeft} minutos.`, 
              ephemeral: true 
            });
          }

          // 3. Perform Boost
          const { error: updateError } = await db
            .from('servers')
            .update({ 
              boosts: server.boosts + 1,
              last_boost_at: new Date().toISOString() 
            })
            .eq('id', server.id);

          if (updateError) throw updateError;

          // 4. Log Boost
          await db.from('boost_logs').insert({
            user_id: userId,
            server_id: server.id,
            guild_id: guildId
          });

          // 4.1 Schedule Boost Reminder if enabled
          if (server.boost_reminder && !server.auto_boost) {
            const reminderTime = 7200000; // 2 hours
            setTimeout(async () => {
              try {
                // Check if the server still has reminder enabled
                const { data: currentServer } = await db
                  .from('servers')
                  .select('name, boost_reminder, auto_boost, id')
                  .eq('id', server.id)
                  .single();

                if (currentServer && currentServer.boost_reminder && !currentServer.auto_boost) {
                   const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
                   const reminderEmbed = new EmbedBuilder()
                    .setTitle(`🚀 Boost Liberado: ${currentServer.name}`)
                    .setDescription(`O tempo de espera acabou! Você já pode dar outro **boost** no servidor **${currentServer.name}** para subir na lista!`)
                    .addFields(
                        { name: 'Como fazer?', value: 'Vá até o servidor e use o comando `/boost` novamente.' },
                        { name: 'Dica', value: 'Manter seu servidor no topo atrai muito mais membros!' }
                    )
                    .setThumbnail("https://i.postimg.cc/VNVM5Jyg/lobbygg.png")
                    .setColor(0x00FFFF)
                    .setTimestamp();
                   
                   const components = [
                       new ActionRowBuilder().addComponents(
                           new ButtonBuilder()
                               .setLabel('Ir para o Site')
                               .setStyle(ButtonStyle.Link)
                               .setURL(SITE_URL || 'https://lobbygg.com.br')
                       )
                   ];

                   sendDiscordDM(userId, reminderEmbed, components);
                }
              } catch (reminderErr) {
                console.error("Failed to send boost reminder:", reminderErr);
              }
            }, reminderTime);
          }

          // 5. Send Log to Discord Channel
          if (DISCORD_DELETION_LOG_CHANNEL_ID) {
            try {
              const logChannel = await discordClient.channels.fetch(DISCORD_DELETION_LOG_CHANNEL_ID);
              if (logChannel) {
                const { EmbedBuilder } = Discord;
                const logEmbed = new EmbedBuilder()
                  .setTitle('🚀 Novo Boost!')
                  .setColor(0x00FFFF)
                  .addFields(
                    { name: 'Servidor', value: server.name, inline: true },
                    { name: 'Usuário', value: `${interaction.user.tag} (${userId})`, inline: true },
                    { name: 'Total de Boosts', value: (server.boosts + 1).toString(), inline: true }
                  )
                  .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
              }
            } catch (logErr) {
              console.error('Error sending boost log:', logErr);
            }
          }

          return interaction.reply({ 
            content: `🚀 **BOOST REALIZADO!** O servidor **${server.name}** subiu na lista! Próximo boost disponível em 2 horas.`, 
            ephemeral: false 
          });

        } catch (err) {
          console.error('Error in /boost command:', err);
          return interaction.reply({ 
            content: '❌ Ocorreu um erro ao processar seu boost. Tente novamente mais tarde.', 
            ephemeral: true 
          });
        }
      }
    }

    // 1. Handle Buttons
    if (interaction.isButton()) {
      const { customId } = interaction;
      const [action, serverId] = customId.split('_');

      if (!['approve', 'reject'].includes(action)) return;

      if (action === 'reject') {
        // Show Modal for Rejection
        const modal = new ModalBuilder()
          .setCustomId(`rejectModal_${serverId}`)
          .setTitle('Motivo da Rejeição');

        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel("Por que está rejeitando?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const allowResubmitInput = new TextInputBuilder()
          .setCustomId('allow_resubmit')
          .setLabel("Permitir reenvio? (sim/nao)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("sim")
          .setRequired(false); // Default to yes if empty

        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
        const secondActionRow = new ActionRowBuilder().addComponents(allowResubmitInput);

        modal.addComponents(firstActionRow, secondActionRow);
        await interaction.showModal(modal);
        return;
      }

      // Approve Logic
      await interaction.deferUpdate();
      try {
        const { error } = await db
          .from('servers')
          .update({ status: 'approved', rejection_reason: null, allow_resubmission: true })
          .eq('id', serverId);

        if (error) throw error;

        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = new EmbedBuilder(oldEmbed.data)
          .setColor(0x00FF00)
          .setFooter({ text: `Aprovado por ${interaction.user.tag}` });

        await interaction.editReply({ embeds: [newEmbed], components: [] });

      } catch (err) {
        console.error("Error approving:", err);
        await interaction.followUp({ content: 'Erro ao aprovar.', ephemeral: true });
      }
    }

    // 2. Handle Modals
    if (interaction.isModalSubmit()) {
      const { customId } = interaction;
      const [action, serverId] = customId.split('_');

      if (action === 'rejectModal') {
        await interaction.deferUpdate();

        const reason = interaction.fields.getTextInputValue('reason');
        const allowResubmitRaw = interaction.fields.getTextInputValue('allow_resubmit').toLowerCase().trim();
        const allowResubmission = allowResubmitRaw === 'não' || allowResubmitRaw === 'nao' ? false : true;

        try {
          const { data: serverData, error } = await db
            .from('servers')
            .update({ 
              status: 'rejected', 
              rejection_reason: reason,
              allow_resubmission: allowResubmission 
            })
            .eq('id', serverId)
            .select()
            .single();

          if (error) throw error;

          // Notify User via DM
          if (serverData) {
            const isNew = (Date.now() - new Date(serverData.created_at).getTime()) < 60 * 60 * 1000;
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .addFields({ name: 'Motivo', value: `\`\`\`${reason}\`\`\`` })
                .setTimestamp();

            const components = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Corrigir')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`${SITE_URL || 'https://lobbygg.com.br'}/dashboard/my-servers`)
                )
            ];

            if (isNew) {
                embed.setTitle("<:svTick_Nao:1069113966128799754> Servidor Reprovado")
                     .setDescription(`O servidor **${serverData.name}** foi reprovado por um admin.`);
            } else {
                embed.setTitle("<:svTick_Nao:1069113966128799754> Alteração Recusada")
                     .setDescription(`A alteração no servidor **${serverData.name}** foi recusada.`);
            }

            sendDiscordDM(serverData.user_id, embed, components);
          }

          const oldEmbed = interaction.message.embeds[0];
          const newEmbed = new EmbedBuilder(oldEmbed.data)
            .setColor(0xFF0000)
            .addFields(
              { name: 'Motivo da Rejeição', value: reason },
              { name: 'Pode Reenviar?', value: allowResubmission ? 'Sim' : 'Não' }
            )
            .setFooter({ text: `Rejeitado por ${interaction.user.tag}` });

          await interaction.editReply({ embeds: [newEmbed], components: [] });

        } catch (err) {
          console.error("Error rejecting:", err);
          await interaction.followUp({ content: 'Erro ao rejeitar.', ephemeral: true });
        }
      }
    }
  });

  discordClient.on("presenceUpdate", async (oldPresence, newPresence) => {
    const member = newPresence?.member;
    const userId = newPresence?.userId || member?.id;
    if (!userId) return;

    const username = member?.user?.username || "";
    const displayName = member?.displayName || "";
    const statusText = newPresence?.activities?.find(a => a.type === 4)?.state || "";
    const hasSite = textHasSite(displayName) || textHasSite(username) || textHasSite(statusText);
    if (hasSite) return;

    const { data } = await db
      .from("servers")
      .select("id")
      .eq("user_id", userId)
      .eq("auto_boost", true)
      .limit(1);

    if (data && data.length > 0) {
      await disableAutoBoostForUser(userId);
    }
  });

  discordClient.login(DISCORD_BOT_TOKEN).catch(err => console.error("Failed to login Discord Bot:", err));

  // --- Auto Boost System ---
  // Runs every 10 minutes to check for servers needing auto boost
  setInterval(async () => {
    try {
      const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
      
      // Fetch servers with auto_boost enabled and last_boost older than 2 hours
      const { data: servers, error } = await db
        .from('servers')
        .select('id, name, user_id, boosts, last_boost_at')
        .eq('auto_boost', true)
        .eq('status', 'approved')
        .or(`last_boost_at.lt.${twoHoursAgo},last_boost_at.is.null`);

      if (error) throw error;
      if (!servers || servers.length === 0) return;

      console.log(`[🚀] Iniciando Auto Boost para ${servers.length} servidores...`);

      for (const server of servers) {
        try {
          const hasSite = await getUserHasSite(server.user_id);
          if (hasSite === false) {
            await disableAutoBoostForUser(server.user_id);
            continue;
          }
          
          const { data: updatedRows, error: updateError } = await db
            .from('servers')
            .update({ 
              boosts: (server.boosts || 0) + 1,
              last_boost_at: new Date().toISOString() 
            })
            .eq('id', server.id)
            .select('id');

          if (updateError) throw updateError;
          if (!updatedRows || updatedRows.length === 0) continue;

          // Log boost
          await db.from('boost_logs').insert({
            user_id: server.user_id,
            server_id: server.id,
            guild_id: 'AUTO_BOOST'
          });

          console.log(`[✅] Auto Boost realizado para: ${server.name}`);
        } catch (serverErr) {
          console.error(`[❌] Erro no Auto Boost para ${server.name}:`, serverErr);
        }
      }
    } catch (err) {
      console.error("[❌] Erro no sistema de Auto Boost:", err);
    }
  }, 10 * 60 * 1000); // Check every 10 minutes
}

// Helper to send DM to user
async function sendDiscordDM(userId, embedData, components = []) {
  if (!discordClient || !discordClient.isReady()) return;

  try {
    const user = await discordClient.users.fetch(userId);
    if (user) {
      await user.send({ embeds: [embedData], components });
    }
  } catch (err) {
    console.error(`Failed to send DM to user ${userId}:`, err.message);
  }
}

async function getGuildMember(userId) {
  if (!discordClient || !discordClient.isReady()) return null;
  const guild =
    discordClient.guilds.cache.get(TARGET_GUILD_ID) ||
    (await discordClient.guilds.fetch(TARGET_GUILD_ID).catch(() => null));
  if (!guild) return null;
  return guild.members.fetch(userId).catch(() => null);
}

function textHasSite(text) {
  const normalized = String(text || "").toLowerCase();
  return normalized.includes(CANONICAL_SITE_HOST) || normalized.includes(`www.${CANONICAL_SITE_HOST}`);
}

async function getUserHasSite(userId, memberHint = null) {
  if (!discordClient || !discordClient.isReady()) return null;
  const member = memberHint || (await getGuildMember(userId));
  if (!member) return null;

  const username = member.user?.username || "";
  const displayName = member.displayName || "";

  if (textHasSite(displayName) || textHasSite(username)) return true;

  if (!member.presence) return null;
  const statusText = member.presence.activities.find(a => a.type === 4)?.state || "";
  return textHasSite(statusText);
}

async function disableAutoBoostForUser(userId) {
  const now = Date.now();
  const last = autoBoostDisableCooldown.get(userId);
  if (last && now - last < 5 * 60 * 1000) return;
  autoBoostDisableCooldown.set(userId, now);

  const { data } = await db
    .from("servers")
    .update({ auto_boost: false })
    .eq("user_id", userId)
    .eq("auto_boost", true)
    .select("id");

  if (!data || data.length === 0) return;

  if (Discord) {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
    const embed = new EmbedBuilder()
      .setTitle("⛔ Auto Boost desativado")
      .setDescription("Detectamos que você não está mais cumprindo os requisitos do Auto Boost.")
      .addFields(
        { name: "Motivo", value: "O link **lobbygg.com.br** não foi encontrado no seu status do Discord." },
        { name: "Como reativar", value: "Coloque **lobbygg.com.br** no seu status e ative novamente na configuração do servidor." }
      )
      .setColor(0xFF0000)
      .setTimestamp();

    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Abrir Meus Servidores")
          .setStyle(ButtonStyle.Link)
          .setURL(`${SITE_URL || "https://lobbygg.com.br"}/my-servers`)
      ),
    ];

    sendDiscordDM(userId, embed, components);
  }
}

async function sendServerLog(server, type) {
  if (!discordClient || !discordClient.isReady() || !DISCORD_LOGS_CHANNEL_ID) return;
  
  try {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
    const channel = await discordClient.channels.fetch(DISCORD_LOGS_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(type)
        .setDescription(server.description)
        .addFields(
            { name: 'Nome', value: server.name, inline: true },
            { name: 'Categoria', value: server.category, inline: true },
            { name: 'Tags', value: server.tags?.join(', ') || 'Nenhuma' },
            { name: 'Convite', value: server.invite_link || 'N/A' },
            { name: 'ID', value: server.id }
        )
        .setColor(0xFFFF00) // Yellow for pending
        .setTimestamp();

    if (server.icon_url) {
        embed.setThumbnail(server.icon_url);
    }

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`approve_${server.id}`)
                .setLabel('Aprovar')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`reject_${server.id}`)
                .setLabel('Reprovar')
                .setStyle(ButtonStyle.Danger)
        );

    await channel.send({ embeds: [embed], components: [row] });

  } catch (err) {
    console.error("Failed to send log:", err);
  }
}

// Helper to add user to Discord Guild
async function addMemberToGuild(userId, username, accessToken) {
  try {
    await axios.put(
      `https://discord.com/api/guilds/${TARGET_GUILD_ID}/members/${userId}`,
      { access_token: accessToken },
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    // Log to admin logs instead of console
    logAdminAction(
      'DISCORD_GUILD_JOIN', 
      `Usuário ${username} (${userId}) entrou no servidor oficial via login.`,
      { id: userId, username },
      'info'
    );
  } catch (error) {
    // Ignore if already in guild or permission error
    if (error.response?.status === 204 || error.response?.status === 201) return;
    
    const discordError = error.response?.data;
    if (discordError?.code === 30001) {
       console.warn(`[⚠️] Usuário ${username} (${userId}) não pôde ser adicionado ao servidor oficial: Limite de 100 servidores atingido.`);
       return;
    }
    
    console.error("Error adding user to guild:", discordError || error.message);
  }
}

const BOT_GUILD_CHECK_TTL_MS = 5 * 60 * 1000;

async function isBotInGuild(guildId, { force = false } = {}) {
  if (!DISCORD_BOT_TOKEN || !guildId) return false;

  const cacheKey = `BOT_IN:${guildId}`;
  const cached = guildsCache.get(cacheKey);
  if (!force) {
    if (cached && (Date.now() - cached.timestamp < BOT_GUILD_CHECK_TTL_MS)) {
      return Boolean(cached.data);
    }
  }

  let present = false;

  try {
    await axios.get(`https://discord.com/api/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });
    present = true;
  } catch (err) {
    const status = err?.response?.status;
    if (status === 429) {
      console.warn(`[⚠️] Discord Rate Limit ao verificar presença do bot na guild ${guildId}.`);
      if (cached) {
        return Boolean(cached.data);
      }
    } else if (status !== 403 && status !== 404) {
      console.error(`Error checking bot presence for guild ${guildId}:`, err?.response?.data || err?.message || err);
    }
    present = false;
  }

  guildsCache.set(cacheKey, { data: present, timestamp: Date.now() });
  return present;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

const GUILD_COUNTS_TTL_MS = 5 * 60 * 1000;
const GUILD_COUNTS_CONCURRENCY = 2;
const USER_GUILDS_BOT_CHECK_CONCURRENCY = 3;

async function getGuildCounts(guildId, { force = false, timeoutMs = 1500 } = {}) {
  if (!DISCORD_BOT_TOKEN || !guildId) return null;

  const cacheKey = `GUILD_COUNTS:${guildId}`;
  const cached = guildsCache.get(cacheKey);
  if (!force) {
    if (cached && (Date.now() - cached.timestamp < GUILD_COUNTS_TTL_MS)) {
      return cached.data || null;
    }
  }

  try {
    const guildRes = await axios.get(`https://discord.com/api/guilds/${guildId}?with_counts=true`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      timeout: timeoutMs,
    });

    const guildData = guildRes.data;
    const result = {
      members: guildData.approximate_member_count || 0,
      members_online: guildData.approximate_presence_count || 0,
      icon_url: guildData.icon ? `https://cdn.discordapp.com/icons/${guildData.id}/${guildData.icon}.png` : null,
    };

    guildsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn(`[⚠️] Discord Rate Limit ao buscar contagens para guild ${guildId}.`);
    }
    if (cached?.data) {
      return cached.data;
    }
    return null;
  }
}

async function fetchManageableGuilds(discordToken) {
  const guildsRes = await axios.get("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${discordToken}` },
  });

  return guildsRes.data.filter((guild) => {
    const perms = BigInt(guild.permissions);
    const ADMIN = 0x8n;
    const MANAGE_GUILD = 0x20n;
    return (perms & ADMIN) === ADMIN || (perms & MANAGE_GUILD) === MANAGE_GUILD;
  });
}

// Simple in-memory cache for guilds: { [userId]: { data: [], timestamp: number } }
// const guildsCache = new Map(); // Already declared above

// --- Routes ---

// 1. Initiate Login (Pure Discord OAuth)
app.get("/api/auth/discord", (req, res) => {
  const baseUrl = getBaseUrl(req);
  const { state: originalState, guild_id, permissions } = req.query;

  if (!DISCORD_CLIENT_ID) {
    console.error("Missing DISCORD_CLIENT_ID");
    return res.redirect(`${baseUrl}?error=server_config_error`);
  }

  // Generate a random state for CSRF protection
  const randomState = crypto.randomBytes(16).toString("hex");
  
  // Save state in cookie (expires in 15 minutes)
  res.cookie("oauth_state", randomState, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production", 
    maxAge: 15 * 60 * 1000,
    sameSite: 'lax'
  });

  // Combine random state with original state if present
  const combinedState = originalState ? `${randomState}:${originalState}` : randomState;

  // Decide scopes: if we are adding a bot, we need the 'bot' scope
  let scopes = DISCORD_SCOPES;
  if (originalState && originalState.startsWith('refresh_guilds')) {
    // If we have 'bot' in the original scope or if it's the refresh_guilds flow
    if (!scopes.includes('bot')) {
      scopes += " bot";
    }
  }

  const redirectUri = `${baseUrl}/api/auth/callback`;
  let url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${combinedState}`;
  
  // Support for adding bot (passed from frontend)
  if (guild_id) url += `&guild_id=${guild_id}`;
  if (permissions) url += `&permissions=${permissions}`;
  if (req.query.disable_guild_select) url += `&disable_guild_select=true`;

  res.redirect(url);
});

// 2. Handle Callback (Exchange code for token)
app.get("/api/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.cookies.oauth_state;
  const baseUrl = getBaseUrl(req);

  // Clear the state cookie
  res.clearCookie("oauth_state");

  if (!code) {
    return res.redirect(`${baseUrl}?error=no_code`);
  }

  // CSRF Protection: Verify state
  // Format: randomState[:originalState]
  const [receivedRandomState, ...rest] = (state || "").split(":");
  const originalState = rest.join(":");

  if (!receivedRandomState || !savedState || receivedRandomState !== savedState) {
    console.warn(`[⚠️] Tentativa de login com state inválido. Recusando.`);
    return res.redirect(`${baseUrl}?error=invalid_state`);
  }

  try {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: code.toString(),
      redirect_uri: `${baseUrl}/api/auth/callback`,
    });

    const tokenRes = await axios.post("https://discord.com/api/oauth2/token", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    
    const { access_token } = tokenRes.data;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const discordUser = userRes.data;

    // Add user to the main Discord server
    await addMemberToGuild(discordUser.id, discordUser.username, access_token);

    // --- Record User in Database ---
    try {
      const { error: upsertError } = await db.from('users').upsert({
        id: discordUser.id,
        username: discordUser.username,
        email: discordUser.email, // Salva o e-mail do usuário
        avatar_url: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
        last_login: new Date().toISOString()
      }, { onConflict: 'id' });

      if (upsertError) {
        console.error(`[❌] Erro ao salvar usuário no banco:`, upsertError.message);
      }
    } catch (dbErr) {
      console.error("Error recording user in DB:", dbErr);
      // Don't block login if user recording fails
    }

    // Create our own Session Token
    const sessionToken = jwt.sign({
      id: discordUser.id,
      email: discordUser.email,
      username: discordUser.username,
      avatar_url: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
      discord_token: access_token // Save Discord Token to fetch guilds later
    }, JWT_SECRET, { expiresIn: "7d" });

    // Handle redirection based on originalState
    if (originalState && originalState.startsWith('refresh_guilds')) {
      const parts = originalState.split(':');
      const guildId = parts[1] || '';
      // Redirect back to add server page with refresh flag and guild_id
      return res.redirect(`${baseUrl}/add?refresh=true&guild_id=${guildId}#token=${sessionToken}`);
    }

    // Default redirect to frontend home with token in hash
    res.redirect(`${baseUrl}/#token=${sessionToken}`);

  } catch (err) {
    console.error("Auth callback error:", err.response?.data || err.message);
    res.redirect(`${baseUrl}?error=auth_callback_failed`);
  }
});

// 3. Verify Token Endpoint (for frontend initialization)
app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.replace("Bearer ", "");
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    
    // Check if banned
    const { data: dbUser } = await db
      .from("users")
      .select("is_banned")
      .eq("id", user.id)
      .single();

    if (dbUser?.is_banned) {
      return res.status(403).json({ error: "Conta suspensa" });
    }

    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});


// --- SLUG SYSTEM ENDPOINTS ---

// GET /api/slugs/check/:slug - Check slug availability
app.get("/api/slugs/check/:slug", async (req, res) => {
  const { slug } = req.params;
  const { currentServerId } = req.query; // To allow keeping current slug

  try {
    // 1. Format check: letters, numbers and hyphens.
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.json({ available: false, reason: "Use apenas letras, números e hifens." });
    }

    if (slug.length < 3 || slug.length > 20) {
      return res.json({ available: false, reason: "O convite deve ter entre 3 e 20 caracteres." });
    }

    // 2. Check reserved slugs
    const reservedSlugs = ['moreira', 'orgze', 'morro', 'shark', 'admin', 'config', 'api', 'auth', 'settings'];
    if (reservedSlugs.includes(slug.toLowerCase())) {
      return res.json({ 
        available: false, 
        reserved: true,
        reason: "Essa url está reservada, se você é o dono do servidor entre em contato com a administração." 
      });
    }

    // 3. Check if already in use
    const { data: existing, error: searchError } = await db
      .from("servers")
      .select("id, guild_id")
      .eq("custom_slug", slug.toLowerCase())
      .maybeSingle();

    if (searchError) {
      console.error("Database error searching slug:", searchError);
      return res.status(500).json({ error: "Database error" });
    }

    if (existing) {
      // If it belongs to the current server, it's "available" (unchanged)
      if (currentServerId && (existing.id === currentServerId || String(existing.guild_id) === String(currentServerId))) {
        return res.json({ available: true, isCurrent: true });
      }
      return res.json({ available: false, reason: "Este convite já está sendo usado por outro servidor." });
    }

    res.json({ available: true });
  } catch (err) {
    console.error("Error checking slug:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/slugs/:slug - Resolve slug to server
app.get("/api/slugs/resolve/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const { data, error } = await db
      .from("servers")
      .select("guild_id")
      .eq("custom_slug", slug.toLowerCase())
      .single();

    if (error || !data) return res.status(404).json({ error: "Slug not found" });
    res.json({ guild_id: data.guild_id });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /servers - Fetch all approved servers
app.get("/api/servers", async (req, res) => {
  try {
    const { data, error } = await db
      .from("servers")
      .select("*")
      .eq("status", "approved")
      .order("featured", { ascending: false })
      .order("sponsored", { ascending: false })
      .order("last_boost_at", { ascending: false, nullsFirst: false })
      .order("boosts", { ascending: false })
      .order("members", { ascending: false });

    if (error) throw error;

    // --- Reviews Stats Integration ---
    let statsMap = {};
    try {
        const { data: reviewsData, error: reviewsError } = await db
            .from("reviews")
            .select("server_id, rating");
        
        if (reviewsError) {
             console.error("Error fetching reviews for stats:", reviewsError);
        } else if (reviewsData) {
            reviewsData.forEach(r => {
                if (!statsMap[r.server_id]) statsMap[r.server_id] = { count: 0, sum: 0 };
                statsMap[r.server_id].count++;
                statsMap[r.server_id].sum += r.rating;
            });
        }
    } catch (err) {
        console.error("Exception fetching reviews stats:", err);
    }

    // Fetch online status from Discord Bot if available
    const serversWithOnline = await mapWithConcurrency(data, GUILD_COUNTS_CONCURRENCY, async (server) => {
      // Add stats
      const stats = statsMap[server.id] || { count: 0, sum: 0 };
      server.reviews_count = stats.count;
      server.rating_average = stats.count > 0 ? stats.sum / stats.count : 0;

      if (DISCORD_BOT_TOKEN && server.guild_id) {
        const counts = await getGuildCounts(server.guild_id, { timeoutMs: 1000 });
        if (counts) return { ...server, members: counts.members, members_online: counts.members_online };
        return server;
      }
      return server;
    });

    res.json(serversWithOnline);
  } catch (err) {
    console.error("Error fetching servers:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /servers/:id - Fetch single server (supports both UUID and Guild ID for compatibility)
app.get("/api/servers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Try to find by guild_id first (Discord ID), then by UUID if it looks like one, or custom_slug
    let query = db.from("servers").select("*");
    
    // Regular expression for UUID validation
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const isGuildId = /^\d{17,20}$/.test(id);

    if (isGuildId) {
      query = query.eq("guild_id", id);
    } else if (isUUID) {
      query = query.eq("id", id);
    } else {
      // If it's not a Guild ID or UUID, try searching by custom_slug
      query = query.eq("custom_slug", id.toLowerCase());
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return res.status(404).json({ error: "Servidor não encontrado" });
      }
      throw error;
    }

    // --- Sync Logic (Lazy Update) ---
    // If we have a guild_id and DISCORD_BOT_TOKEN, try to update members and icon
    // We do this asynchronously or synchronously? 
    // For better UX, let's do it "fire-and-forget" or with a small timeout, 
    // but since the user wants it "synced", maybe we return the updated data if possible.
    // Let's try to update and return updated data if it's quick.
    
    if (data.guild_id && DISCORD_BOT_TOKEN) {
       // Check if update is needed (e.g., every 1 hour)
       // For now, let's update every time to ensure "always synced" as requested, 
       // but handle errors gracefully so we don't break the page load.
       try {
         const counts = await getGuildCounts(data.guild_id, { timeoutMs: 2000 });
         if (counts) {
           const oldMembers = data.members;
           const oldIconUrl = data.icon_url;

           const newMemberCount = counts.members;
           const newOnlineCount = counts.members_online;
           const newIconUrl = counts.icon_url || data.icon_url;

           data.members = newMemberCount;
           data.members_online = newOnlineCount;
           data.icon_url = newIconUrl;

          if (newMemberCount !== oldMembers || newIconUrl !== oldIconUrl) {
             db.from("servers").update({
                 members: newMemberCount,
                 icon_url: newIconUrl
             }).eq("id", data.id).then(({ error }) => {
                 if (error) console.error("Failed to sync server update to DB:", error);
             });
           }
         }
       } catch (syncErr) {
         console.error(`Sync failed for server ${id}:`, syncErr.message);
         // Continue returning existing DB data
       }
    }

    res.json(data);
  } catch (err) {
    console.error("Error fetching server:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/servers/:id/validate-image - Lazy clean broken images
app.post("/api/servers/:id/validate-image", async (req, res) => {
  const { id } = req.params;
  const { field } = req.body; // 'banner_url' or 'icon_url'

  if (!['banner_url', 'icon_url'].includes(field)) {
    return res.status(400).json({ error: "Invalid field" });
  }

  try {
    // 1. Resolve server
    let query = db.from("servers").select(`id, ${field}, guild_id`);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const isGuildId = /^\d{17,20}$/.test(id);

    if (isGuildId) query = query.eq("guild_id", id);
    else if (isUUID) query = query.eq("id", id);
    else query = query.eq("custom_slug", id.toLowerCase());

    const { data: server, error: fetchError } = await query.single();
    if (fetchError || !server) return res.status(404).json({ error: "Server not found" });

    const imageUrl = server[field];
    if (!imageUrl) return res.json({ status: "already_null" });

    // 2. Validate URL (Fire and forget if it's already known to be 404 in browser, but let's check properly)
    try {
      await axios.get(imageUrl, { timeout: 5000 });
      return res.json({ status: "ok", message: "Image is working" });
    } catch (axiosErr) {
      // If image is broken (404, 403, timeout, etc.)
      console.log(`[🧼] Cleaning broken ${field} for server ${server.id}: ${imageUrl}`);
      
      const { error: updateError } = await db
        .from("servers")
        .update({ [field]: null })
        .eq("id", server.id);

      if (updateError) throw updateError;
      return res.json({ status: "cleaned", message: `Broken ${field} removed from database.` });
    }
  } catch (err) {
    console.error("Error validating image:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Admin Routes ---

// GET /api/admin/servers - List all servers for management
app.get("/api/admin/servers", adminOnly, async (req, res) => {
  try {
    const { data, error } = await db
      .from("servers")
      .select(`
        *
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch all users to map manually since foreign key might not be explicitly defined in DB cache
    const { data: users, error: usersError } = await db
      .from("users")
      .select("id, username, avatar_url");

    if (usersError) console.error("Error fetching users for mapping:", usersError);

    // Map users to owner_name manually
    const serversWithUsers = data.map(server => {
      const user = users?.find(u => u.id === server.user_id);
      return {
        ...server,
        owner_name: user?.username || 'Desconhecido',
        owner_avatar: user?.avatar_url
      };
    });

    res.json(serversWithUsers);
  } catch (err) {
    console.error("Error fetching admin servers:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/admin/servers/:id/status - Approve or Reject a server
app.post("/api/admin/servers/:id/status", adminOnly, async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: "Status inválido" });
  }

  try {
    const updateData = { status };
    if (status === 'rejected' && reason) {
      updateData.rejection_reason = reason;
    } else if (status === 'approved') {
      updateData.rejection_reason = null; // Clear rejection reason if approved
    }

    const { data, error } = await db
      .from("servers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Send DM Notification
    if (discordClient && discordClient.isReady()) {
        try {
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
            const isNew = (Date.now() - new Date(data.created_at).getTime()) < 60 * 60 * 1000;
            
            if (status === 'approved') {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTimestamp();
                
                const components = [];
                const serverLink = `${SITE_URL || 'https://lobbygg.com.br'}/server/${data.custom_slug || data.id}`;

                if (isNew) {
                    embed.setTitle("<a:giveaway:1069291826126798859> Parabéns! Seu servidor foi aprovado!")
                         .setDescription(`Seu servidor **${data.name}** foi aprovado e já está disponível no site.`);
                } else {
                    embed.setTitle("<:svTick_sim:1069113909212102706> Alteração Aprovada")
                         .setDescription(`A alteração no servidor **${data.name}** foi aprovada.`);
                }

                components.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Ver Servidor')
                            .setStyle(ButtonStyle.Link)
                            .setURL(serverLink)
                    )
                );

                sendDiscordDM(data.user_id, embed, components);
            } else if (status === 'rejected') {
                 const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .addFields({ name: 'Motivo', value: `\`\`\`${reason || 'Não especificado'}\`\`\`` })
                    .setTimestamp();

                const components = [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Corrigir')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`${SITE_URL || 'https://lobbygg.com.br'}/dashboard/my-servers`)
                    )
                ];

                if (isNew) {
                    embed.setTitle("<:svTick_Nao:1069113966128799754> Servidor Reprovado")
                         .setDescription(`O servidor **${data.name}** foi reprovado por um admin.`);
                } else {
                    embed.setTitle("<:svTick_Nao:1069113966128799754> Alteração Recusada")
                         .setDescription(`A alteração no servidor **${data.name}** foi recusada.`);
                }

                sendDiscordDM(data.user_id, embed, components);
            }
        } catch (dmError) {
            console.error("Error sending DM via API:", dmError);
        }
    }

    // Log status update
    logAdminAction(
        status === 'approved' ? 'SERVIDOR_APROVADO' : 'SERVIDOR_REJEITADO', 
        `Servidor "${data.name}" (${id}) ${status === 'approved' ? 'aprovado' : 'rejeitado'}${reason ? ` - Motivo: ${reason}` : ''}`, 
        req.user,
        status === 'approved' ? 'success' : 'warning'
    );

    // Log to Discord
    if (discordClient && DISCORD_LOGS_CHANNEL_ID) {
        try {
            const channel = await discordClient.channels.fetch(DISCORD_LOGS_CHANNEL_ID);
            if (channel) {
                const { EmbedBuilder } = Discord;
                const color = status === 'approved' ? 0x00FF00 : (status === 'rejected' ? 0xFF0000 : 0xFFFF00);
                const embed = new EmbedBuilder()
                    .setTitle(`🛡️ Status do Servidor Atualizado: ${status.toUpperCase()}`)
                    .setColor(color)
                    .addFields(
                        { name: 'Servidor', value: data.name, inline: true },
                        { name: 'ID', value: data.guild_id || data.id, inline: true },
                        { name: 'Moderador', value: `${req.user.username} (${req.user.id})` }
                    )
                    .setTimestamp();
                
                if (status === 'rejected' && reason) {
                    embed.addFields({ name: 'Motivo da Rejeição', value: reason });
                }

                await channel.send({ embeds: [embed] });
            }
        } catch (e) {
            console.error("Failed to send admin log to Discord:", e);
        }
    }

    res.json(data);
  } catch (err) {
    console.error("Error updating server status:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/admin/servers/:id/custom-slug - Remove custom slug
app.delete("/api/admin/servers/:id/custom-slug", adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: server, error: fetchError } = await db
      .from("servers")
      .select("name, custom_slug")
      .eq("id", id)
      .single();

    if (fetchError || !server) return res.status(404).json({ error: "Servidor não encontrado" });

    const { data, error } = await db
      .from("servers")
      .update({ custom_slug: null })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    logAdminAction(
        'REMOVER_LINK_CUSTOMIZADO', 
        `Link personalizado "${server.custom_slug}" removido do servidor "${server.name}" (${id})`, 
        req.user,
        'warning'
    );

    res.json(data);
  } catch (err) {
    console.error("Error removing custom slug:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/admin/stats - Admin overview stats
app.get("/api/admin/stats", adminOnly, async (req, res) => {
  try {
    // 1. Get total servers count
    const { count: totalServers, error: serversErr } = await db
      .from("servers")
      .select("*", { count: 'exact', head: true });

    // 2. Get pending servers count
    const { count: pendingServers, error: pendingErr } = await db
      .from("servers")
      .select("*", { count: 'exact', head: true })
      .eq("status", "pending");

    // 3. Get approved servers count
    const { count: approvedServers, error: approvedErr } = await db
      .from("servers")
      .select("*", { count: 'exact', head: true })
      .eq("status", "approved");

    // 4. Get rejected servers count
    const { count: rejectedServers, error: rejectedErr } = await db
      .from("servers")
      .select("*", { count: 'exact', head: true })
      .eq("status", "rejected");

    // 5. Count total registered users from users table
    const { count: totalUsers, error: usersErr } = await db
      .from("users")
      .select("*", { count: 'exact', head: true });

    // 6. Count users who have at least one server
    let usersWithServers = 0;
    const { data: serverOwners, error: ownersErr } = await db
      .from("servers")
      .select("user_id");
    
    if (serverOwners) {
      usersWithServers = new Set(serverOwners.map(s => s.user_id)).size;
    }

    if (usersErr && usersErr.code !== 'PGRST116') {
      console.error("Error fetching users count:", usersErr);
    }

    res.json({
      totalUsers: totalUsers || 0,
      usersWithServers: usersWithServers || 0,
      totalServers: totalServers || 0,
      pendingServers: pendingServers || 0,
      approvedServers: approvedServers || 0,
      rejectedServers: rejectedServers || 0
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// GET /api/admin/settings - Fetch admin settings
app.get("/api/admin/settings", adminOnly, (req, res) => {
  res.json({ maintenance: isMaintenanceMode });
});

// POST /api/admin/settings/maintenance - Toggle maintenance mode
app.post("/api/admin/settings/maintenance", adminOnly, (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: "Campo 'enabled' é obrigatório e deve ser booleano" });
  }
  
  isMaintenanceMode = enabled;
  const statusMsg = isMaintenanceMode ? 'ATIVADO' : 'DESATIVADO';
  
  // Log maintenance change
  logAdminAction('MANUTENCAO_ALTERADA', `Modo manutenção alterado para ${statusMsg}`, req.user, 'admin');

  res.json({ maintenance: isMaintenanceMode });
});

// GET /api/admin/logs - Fetch admin logs
app.get("/api/admin/logs", adminOnly, async (req, res) => {
  try {
    const { data, error } = await db
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Error fetching admin logs:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/maintenance-status - Public route to check maintenance
app.get("/api/maintenance-status", (req, res) => {
  res.json({ maintenance: isMaintenanceMode });
});

// --- Public Events Route ---
app.get("/api/events", async (req, res) => {
  try {
    const { data, error } = await db
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Admin Events CRUD ---
app.post("/api/admin/events", adminOnly, async (req, res) => {
  try {
    const { title, description, icon, link, color } = req.body;
    const { data, error } = await db
      .from("events")
      .insert([{ title, description, icon, link, color }])
      .select()
      .single();

    if (error) throw error;
    
    logAdminAction('EVENTO_CRIADO', `Evento "${title}" criado`, req.user, 'success');
    res.json(data);
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/admin/events/:id", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, icon, link, color } = req.body;
    const { data, error } = await db
      .from("events")
      .update({ title, description, icon, link, color })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    
    logAdminAction('EVENTO_EDITADO', `Evento "${title}" editado`, req.user, 'info');
    res.json(data);
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/api/admin/events/:id", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await db
      .from("events")
      .delete()
      .eq("id", id);

    if (error) throw error;
    
    logAdminAction('EVENTO_DELETADO', `Evento ID ${id} removido`, req.user, 'warning');
    res.status(204).send();
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Admin Users Management ---
app.get("/api/admin/users", adminOnly, async (req, res) => {
  try {
    const { data: users, error } = await db
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch server counts for each user
    const { data: serverCounts } = await db
      .from("servers")
      .select("user_id");

    const usersWithCounts = users.map(user => {
      const userServers = serverCounts?.filter(s => s.user_id === user.id) || [];
      return {
        ...user,
        serverCount: userServers.length
      };
    });

    res.json(usersWithCounts);
  } catch (err) {
    console.error("Error fetching admin users:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/admin/users/:id/servers", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: servers, error } = await db
      .from("servers")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(servers);
  } catch (err) {
    console.error("Error fetching user servers:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/admin/users/:id/ban", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { banned } = req.body;
    
    const { data, error } = await db
      .from("users")
      .update({ is_banned: banned })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const action = banned ? 'USUARIO_BANIDO' : 'USUARIO_DESBANIDO';
    const statusText = banned ? 'banido' : 'desbanido';
    logAdminAction(action, `Usuário ${data.username} (${id}) foi ${statusText}`, req.user, banned ? 'danger' : 'success');

    res.json(data);
  } catch (err) {
    console.error("Error banning user:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/admin/servers/:id/feature - Toggle featured/sponsored status
app.post("/api/admin/servers/:id/feature", adminOnly, async (req, res) => {
    const { id } = req.params;
    const { featured, sponsored } = req.body;
  
    try {
      const updates = {};
      if (typeof featured === 'boolean') updates.featured = featured;
      if (typeof sponsored === 'boolean') updates.sponsored = sponsored;
  
      const { data, error } = await db
        .from("servers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
  
      if (error) throw error;
      
      // Log feature toggle
      const featureMsg = [];
      if (typeof featured === 'boolean') featureMsg.push(`Destaque: ${featured ? 'ON' : 'OFF'}`);
      if (typeof sponsored === 'boolean') featureMsg.push(`Patrocínio: ${sponsored ? 'ON' : 'OFF'}`);
      
      logAdminAction(
          'SERVIDOR_DESTAQUE_ALTERADO', 
          `Servidor "${data.name}" (${id}) alterado: ${featureMsg.join(', ')}`, 
          req.user,
          'info'
      );

      res.json(data);
    } catch (err) {
      console.error("Error toggling feature status:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
});

// 4. Get User's Manageable Guilds
app.get("/api/user/guilds", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.replace("Bearer ", "");
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const discordToken = decoded.discord_token;
    const userId = decoded.id;

    if (!discordToken) {
      return res.status(401).json({ error: "No Discord token found in session" });
    }

    // Check cache (valid for 1 hour), unless refresh=true is passed
    const forceRefresh = req.query.refresh === 'true';
    const cached = guildsCache.get(userId);
    
    let adminGuilds = [];

    if (!forceRefresh && cached && (Date.now() - cached.timestamp < 60 * 60 * 1000)) {
      adminGuilds = cached.data;
    } else {
        const manageableGuilds = await fetchManageableGuilds(discordToken);

        adminGuilds = await mapWithConcurrency(manageableGuilds, USER_GUILDS_BOT_CHECK_CONCURRENCY, async (guild) => {
          const hasBot = await isBotInGuild(guild.id, { force: forceRefresh });
          return { ...guild, has_bot: hasBot };
        });

        // Update cache
        guildsCache.set(userId, { data: adminGuilds, timestamp: Date.now() });
    }

    // ALWAYS Fetch registered servers to mark them (fresh status)
    try {
        const { data: registeredServers } = await db
            .from("servers")
            .select("guild_id");
        
        const registeredSet = new Set(registeredServers?.map(s => s.guild_id) || []);
        
        const guildsWithStatus = adminGuilds.map(g => ({
            ...g,
            is_registered: registeredSet.has(g.id)
        }));
        
        res.json(guildsWithStatus);
    } catch (dbErr) {
        console.error("Error fetching registered status:", dbErr);
        // Fallback without status
        res.json(adminGuilds.map(g => ({ ...g, is_registered: false })));
    }

  } catch (err) {
    console.error("Error fetching guilds:", err.message);
    if (err.response && err.response.status === 429) {
       return res.status(429).json({ error: "Too many requests to Discord. Please try again later." });
    }
    res.status(500).json({ error: "Failed to fetch guilds" });
  }
});

// POST /servers - Create new server (Protected)
app.post("/api/servers", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is banned
    const { data: userData } = await db
      .from("users")
      .select("is_banned")
      .eq("id", decoded.id)
      .single();

    if (userData?.is_banned) {
      return res.status(403).json({ error: "Sua conta foi suspensa." });
    }

    const user = decoded;
    
    if (!user) {
      return res.status(401).json({ error: "Invalid Token" });
    }

    if (!decoded.discord_token) {
      return res.status(401).json({ error: "Sessão do Discord inválida ou expirada." });
    }

    const newServer = req.body;

    // Validate Input (Basic)
    if (!newServer.name || !newServer.description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check for Duplicates (if guildId is provided)
    if (newServer.guildId) {
        try {
            const { data: existing, error: dupError } = await db
                .from("servers")
                .select("id")
                .eq("guild_id", newServer.guildId)
                .single();
            
            if (existing) {
                return res.status(400).json({ error: "Este servidor já está cadastrado!" });
            }
        } catch (ignored) {
        }
    }

    if (newServer.guildId) {
      const manageableGuilds = await fetchManageableGuilds(decoded.discord_token);
      const selectedGuild = manageableGuilds.find((guild) => guild.id === newServer.guildId);

      if (!selectedGuild) {
        return res.status(403).json({ error: "Você não possui permissão para cadastrar este servidor." });
      }

      if (newServer.autoInvite) {
        const hasBot = await isBotInGuild(newServer.guildId);
        if (!hasBot) {
          return res.status(400).json({ error: "Adicione o bot ao servidor antes de continuar." });
        }
      }
    }

    let inviteLink = newServer.inviteLink;
    let iconUrl = null;
    let bannerUrl = newServer.bannerUrl || null;
    let memberCount = 0;

    // Generate Invite and Fetch Guild Data if requested
    if (newServer.autoInvite && newServer.guildId && DISCORD_BOT_TOKEN) {
       try {
         const guildRes = await axios.get(`https://discord.com/api/guilds/${newServer.guildId}?with_counts=true`, {
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
         });
         const guildData = guildRes.data;
         
         if (guildData.icon) {
            iconUrl = `https://cdn.discordapp.com/icons/${guildData.id}/${guildData.icon}.png`;
         }
         
         if (guildData.banner && !bannerUrl) {
            bannerUrl = `https://cdn.discordapp.com/banners/${guildData.id}/${guildData.banner}.png?size=1024`;
         }

         memberCount = guildData.approximate_member_count || 0;

         const channelsRes = await axios.get(`https://discord.com/api/guilds/${newServer.guildId}/channels`, {
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
         });
         const channels = channelsRes.data;
         const textChannel = channels.find(c => c.type === 0);
         
         if (textChannel) {
            const inviteRes = await axios.post(`https://discord.com/api/channels/${textChannel.id}/invites`, {
              max_age: 0, 
              max_uses: 0 
            }, {
              headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
            });
            inviteLink = `https://discord.gg/${inviteRes.data.code}`;
         } else {
            throw new Error("No text channel found to create invite");
         }
       } catch (inviteErr) {
         console.error("Failed to generate invite or fetch guild data:", inviteErr.message);
         return res.status(500).json({ error: "Falha ao gerar convite via Bot ou buscar dados do servidor." });
       }
    }

    // Insert into DB
    const { data, error } = await db
      .from("servers")
      .insert([
        {
          name: newServer.name,
          description: newServer.description,
          category: newServer.category,
          tags: newServer.tags,
          invite_link: inviteLink, 
          icon_emoji: newServer.iconEmoji,   
          icon_url: iconUrl, 
          banner_url: bannerUrl, 
          guild_id: newServer.guildId, 
          status: "pending",
          rejection_reason: null,
          allow_resubmission: true,
          featured: false,
          sponsored: false,
          members: memberCount, 
          user_id: user.id
        },
      ])
      .select()
      .single();

    if (error) throw error;

    sendServerLog(data, "Novo Servidor");

    // Notify User via DM
    if (Discord) {
        const embed = new Discord.EmbedBuilder()
            .setTitle("<:svTick_sim:1069113909212102706> Servidor Enviado para Análise!")
            .setDescription(`Seu servidor **${newServer.name}** foi enviado para nossa equipe de moderação.`)
            .addFields(
                { name: 'O que acontece agora?', value: 'Nossa equipe irá verificar se seu servidor segue nossas diretrizes. Você será notificado aqui assim que houver uma atualização.' }
            )
            .setColor(0x00FF00)
            .setTimestamp();
        
        sendDiscordDM(user.id, embed);
    }

    res.status(201).json(data);

  } catch (err) {
    console.error("Error creating server:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/user/servers - Fetch user's servers (approved, pending, rejected)
app.get("/api/user/servers", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.replace("Bearer ", "");
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    
    const { data, error } = await db
      .from("servers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error fetching user servers:", err);
    res.status(500).json({ error: "Failed to fetch user servers" });
  }
});

// GET /api/user/check-bio - Check if user has site in Discord bio
app.get("/api/user/check-bio", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.replace("Bearer ", "");
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await getUserHasSite(decoded.id);
    res.json({ hasSiteInBio: result === true });
  } catch (err) {
    res.status(500).json({ error: "Failed to check bio" });
  }
});

// PUT /api/servers/:id - Update server (Protected)
app.put("/api/servers/:id", async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.replace("Bearer ", "");

  try {
    const user = jwt.verify(token, JWT_SECRET);
    const updates = req.body;

    // Security Check: Ensure user owns the server
    let fetchQuery = db
      .from("servers")
      .select("user_id, id, status, description, category, tags, banner_url, custom_slug, boost_reminder, auto_boost");
    
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const isGuildId = /^\d{17,20}$/.test(id);

    if (isGuildId) {
      fetchQuery = fetchQuery.eq("guild_id", id);
    } else if (isUUID) {
      fetchQuery = fetchQuery.eq("id", id);
    } else {
      fetchQuery = fetchQuery.eq("custom_slug", id.toLowerCase());
    }
    
    const { data: server, error: fetchError } = await fetchQuery.single();
    
    if (fetchError || !server) return res.status(404).json({ error: "Server not found" });
    if (server.user_id !== user.id) return res.status(403).json({ error: "Unauthorized" });

    // Validar slug se fornecido
    if (updates.customSlug) {
      const slug = updates.customSlug.toLowerCase().trim();
      
      // 1. Regex check (letters, numbers and hyphens)
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({ error: "Slug inválido. Use apenas letras, números e hifens." });
      }

      // 2. Size check
      if (slug.length < 3 || slug.length > 20) {
        return res.status(400).json({ error: "O convite deve ter entre 3 e 20 caracteres." });
      }

      // 3. Reserved check
      const reservedSlugs = ['moreira', 'orgze', 'morro', 'shark', 'admin', 'config', 'api', 'auth', 'settings'];
      if (reservedSlugs.includes(slug)) {
        return res.status(400).json({ error: "Este convite está reservado." });
      }

      // 3. Uniqueness check
      const { data: existing } = await db
        .from("servers")
        .select("id, guild_id")
        .eq("custom_slug", slug)
        .maybeSingle();

      if (existing && existing.id !== id && String(existing.guild_id) !== String(id)) {
        return res.status(400).json({ error: "Este convite já está em uso." });
      }
    }

    const normalizeTags = (tags) => {
      if (!Array.isArray(tags)) return "";
      return tags.map(t => String(t).toLowerCase().trim()).filter(Boolean).sort().join(",");
    };

    const desiredDescription = String(updates.description || "").trim();
    const desiredCategory = updates.category;
    const desiredTags = Array.isArray(updates.tags) ? updates.tags : [];
    const desiredBannerUrl = updates.bannerUrl ? String(updates.bannerUrl).trim() : null;
    const desiredCustomSlug = updates.customSlug ? String(updates.customSlug).toLowerCase().trim() : null;

    const desiredBoostReminder = updates.auto_boost ? false : Boolean(updates.boost_reminder);
    const desiredAutoBoost = updates.boost_reminder ? false : Boolean(updates.auto_boost);

    const currentDescription = String(server.description || "").trim();
    const currentCategory = server.category;
    const currentTags = Array.isArray(server.tags) ? server.tags : [];
    const currentBannerUrl = server.banner_url ? String(server.banner_url).trim() : null;
    const currentCustomSlug = server.custom_slug ? String(server.custom_slug).toLowerCase().trim() : null;

    const requiresReview =
      desiredDescription !== currentDescription ||
      desiredCategory !== currentCategory ||
      normalizeTags(desiredTags) !== normalizeTags(currentTags) ||
      desiredBannerUrl !== currentBannerUrl ||
      desiredCustomSlug !== currentCustomSlug;

    // Allowed updates only
    const allowedUpdates = {
      description: desiredDescription,
      category: desiredCategory,
      tags: desiredTags,
      banner_url: desiredBannerUrl, // Allow banner update
      custom_slug: desiredCustomSlug, // New field
      boost_reminder: desiredAutoBoost ? false : desiredBoostReminder, // New field
      auto_boost: desiredBoostReminder ? false : desiredAutoBoost, // New field
      status: requiresReview ? 'pending' : server.status
    };

    const { data, error } = await db
      .from("servers")
      .update(allowedUpdates)
      .eq("id", server.id) // Use the UUID for internal update
      .select()
      .single();

    if (error) throw error;

    if (requiresReview) {
      // Log to Discord
      sendServerLog(data, "Modificação de Servidor");

      // Notify User via DM (Update)
      if (Discord) {
           const embed = new Discord.EmbedBuilder()
              .setTitle("📝 Alterações Enviadas para Análise")
              .setDescription(`As alterações no servidor **${data.name}** foram enviadas para aprovação.`)
              .addFields(
                  { name: 'O que acontece agora?', value: 'Nossa equipe irá verificar as alterações. Você será notificado assim que elas forem aprovadas ou rejeitadas.' }
              )
              .setColor(0xFFFF00)
              .setTimestamp();
          
          sendDiscordDM(user.id, embed);
      }
    }

    res.json(data);
  } catch (err) {
    console.error("Error updating server:", err);
    res.status(500).json({ error: "Failed to update server" });
  }
});

// DELETE /api/servers/:id - Delete server (Protected)
app.delete("/api/servers/:id", async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.replace("Bearer ", "");

  try {
    const user = jwt.verify(token, JWT_SECRET);

    // Security Check
    let fetchQuery = db.from("servers").select("user_id, name, category, id");
    
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const isGuildId = /^\d{17,20}$/.test(id);

    if (isGuildId) {
      fetchQuery = fetchQuery.eq("guild_id", id);
    } else if (isUUID) {
      fetchQuery = fetchQuery.eq("id", id);
    } else {
      fetchQuery = fetchQuery.eq("custom_slug", id.toLowerCase());
    }

    const { data: server, error: fetchError } = await fetchQuery.single();
    
    if (fetchError) {
        console.error("Delete check failed - DB Error:", fetchError);
        return res.status(404).json({ error: "Server not found (DB Error)" });
    }
    
    if (!server) {
        console.error("Delete check failed - Server not found in DB");
        return res.status(404).json({ error: "Server not found" });
    }

    if (server.user_id !== user.id) {
        console.warn(`Unauthorized delete attempt by ${user.id} for server owned by ${server.user_id}`);
        return res.status(403).json({ error: "Unauthorized" });
    }

    const { error: deleteError } = await db
      .from("servers")
      .delete()
      .eq("id", server.id); // Use internal UUID for delete

    if (deleteError) {
        console.error("db delete failed:", deleteError);
        throw deleteError;
    }
    
    // Log deletion to Discord
    if (discordClient && DISCORD_DELETION_LOG_CHANNEL_ID) {
      try {
        const channel = await discordClient.channels.fetch(DISCORD_DELETION_LOG_CHANNEL_ID);
        if (channel) {
           const { EmbedBuilder } = Discord;
           const embed = new EmbedBuilder()
             .setTitle("🗑️ Servidor Deletado")
             .setColor(0xFF0000)
             .addFields(
               { name: 'Nome', value: server.name || 'Desconhecido', inline: true },
               { name: 'Categoria', value: server.category || 'N/A', inline: true },
               { name: 'ID', value: id },
               { name: 'Deletado por', value: `${user.username} (${user.id})` }
             )
             .setTimestamp();
           
           await channel.send({ embeds: [embed] });
        }
      } catch (discordErr) {
        console.error("Failed to send deletion log to Discord:", discordErr);
      }
    }

    res.json({ message: "Server deleted successfully" });

  } catch (err) {
    console.error("Error deleting server:", err);
    res.status(500).json({ error: "Failed to delete server" });
  }
});

// POST /api/reports - Report a server
app.post("/api/reports", async (req, res) => {
  try {
    const { serverId, reason, contact } = req.body;
    
    if (!serverId || !reason) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Optional: Get user info if token provided
    let reporter = "Anônimo";
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const user = jwt.verify(token, JWT_SECRET);
        reporter = `${user.username} (${user.id})`;
      } catch (e) {
        // Ignore invalid token
      }
    } else if (contact) {
        reporter = contact;
    }

    // Fetch server details
    const { data: server, error } = await db
      .from("servers")
      .select("name, invite_link, id")
      .eq("id", serverId)
      .single();

    if (error || !server) {
      return res.status(404).json({ error: "Server not found" });
    }

    // Send to Discord
    if (discordClient && DISCORD_REPORTS_CHANNEL_ID) {
       try {
         const channel = await discordClient.channels.fetch(DISCORD_REPORTS_CHANNEL_ID);
         if (channel) {
            const { EmbedBuilder } = Discord;
            const embed = new EmbedBuilder()
              .setTitle("🚨 Report de Servidor")
              .setColor(0xFF0000)
              .addFields(
                { name: 'Servidor', value: server.name, inline: true },
                { name: 'ID', value: server.id, inline: true },
                { name: 'Motivo', value: reason },
                { name: 'Reportado por', value: reporter },
                { name: 'Convite', value: server.invite_link || "N/A" }
              )
              .setTimestamp();
            
            await channel.send({ embeds: [embed] });
         }
       } catch (discordErr) {
         console.error("Failed to send report to Discord:", discordErr);
       }
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Error sending report:", err);
    res.status(500).json({ error: "Failed to send report" });
  }
});

// --- Review Routes ---

// GET /api/servers/:id/reviews
app.get("/api/servers/:id/reviews", async (req, res) => {
  const { id } = req.params;
  try {
    // Check if id is UUID, Guild ID, or Slug
    let serverId = id;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const isGuildId = /^\d{17,20}$/.test(id);

    if (isGuildId) {
        // It's a Guild ID, find the UUID
        const { data: server } = await db.from("servers").select("id").eq("guild_id", id).single();
        if (server) serverId = server.id;
        else return res.status(404).json({ error: "Servidor não encontrado" });
    } else if (!isUUID) {
        // It's a Slug, find the UUID
        const { data: server } = await db.from("servers").select("id").eq("custom_slug", id.toLowerCase()).single();
        if (server) serverId = server.id;
        else return res.status(404).json({ error: "Servidor não encontrado" });
    }

    const { data, error } = await db
      .from("reviews")
      .select("*, user:users(username, avatar_url)")
      .eq("server_id", serverId)
      .order("created_at", { ascending: false });

    if (error) {
       // If table doesn't exist, return empty array to not break frontend
       if (error.code === '42P01') return res.json([]); 
       throw error;
    }
    
    res.json(data);
  } catch (err) {
    console.error("Error fetching reviews:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// POST /api/servers/:id/reviews
app.post("/api/servers/:id/reviews", async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.replace("Bearer ", "");
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Nota inválida (1-5)" });
    }

    const numericRating = Number(rating);
    const safeComment = comment ? String(comment).slice(0, 500) : "";
    
    // Resolve Server ID
    let serverId = id;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const isGuildId = /^\d{17,20}$/.test(id);

    if (isGuildId) {
        const { data: server } = await db.from("servers").select("id").eq("guild_id", id).single();
        if (server) serverId = server.id;
        else return res.status(404).json({ error: "Servidor não encontrado" });
    } else if (!isUUID) {
        // It's a Slug, find the UUID
        const { data: server } = await db.from("servers").select("id").eq("custom_slug", id.toLowerCase()).single();
        if (server) serverId = server.id;
        else return res.status(404).json({ error: "Servidor não encontrado" });
    }

    // Check if already reviewed
    const { data: existing } = await db
        .from("reviews")
        .select("id")
        .eq("server_id", serverId)
        .eq("user_id", user.id)
        .single();
        
    if (existing) {
        return res.status(400).json({ error: "Você já avaliou este servidor." });
    }

    const { data, error } = await db
      .from("reviews")
      .insert([{
        server_id: serverId,
        user_id: user.id,
        rating: numericRating,
        comment: safeComment
      }])
      .select("*, user:users(username, avatar_url)")
      .single();

    if (error) throw error;
    
    res.json(data);
  } catch (err) {
    console.error("Error posting review:", err);
    res.status(500).json({ error: "Failed to post review" });
  }
});

// DELETE /api/reviews/:id
app.delete("/api/reviews/:id", async (req, res) => {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.replace("Bearer ", "");
    
    try {
        const user = jwt.verify(token, JWT_SECRET);
        
        // Verify ownership or admin
        const { data: review, error: fetchError } = await db
            .from("reviews")
            .select("user_id")
            .eq("id", id)
            .single();
            
        if (fetchError || !review) return res.status(404).json({ error: "Review not found" });
        
        const isAdmin = ADMIN_IDS.includes(user.id);
        
        if (review.user_id !== user.id && !isAdmin) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        
        const { error } = await db.from("reviews").delete().eq("id", id);
        if (error) throw error;
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete review" });
    }
});

// --- Serve Frontend Static Files (Production) ---
const frontendPath = path.join(__dirname, "../dist");
app.use(express.static(frontendPath));

// Fallback para qualquer rota não encontrada na API (SPA Routing)
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api/")) {
    res.sendFile(path.join(frontendPath, "index.html"), (err) => {
      if (err) {
        res.status(404).send("Frontend não compilado. Execute 'npm run build' antes de iniciar.");
      }
    });
  } else {
    res.status(404).json({ error: "Rota da API não encontrada" });
  }
});

// --- Global Error Handler (Silent URIErrors) ---
app.use((err, req, res, next) => {
  if (err instanceof URIError) {
    // Log minimal information for URI errors to avoid log pollution
    console.warn(`[⚠️] URL malformada detectada de ${req.ip}: ${req.url}`);
    return res.status(400).json({ error: "URL malformada" });
  }
  
  // Generic error handler for other types of errors
  console.error("[❌] Erro não tratado:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`[✅] Backend iniciado em: http://localhost:${port}`);
});
