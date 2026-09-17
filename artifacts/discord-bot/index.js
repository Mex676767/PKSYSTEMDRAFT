import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  BREAK_KEYWORDS = "afk,lunch,break,dinner",
  RESYNC_INTERVAL_MINUTES = "5",
} = process.env;

for (const [key, value] of Object.entries({ DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!value) {
    console.error(`Missing required env var: ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const breakKeywords = BREAK_KEYWORDS.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let linkedProfiles = new Map();

async function refreshLinkedProfiles() {
  const { data, error } = await supabase.from("profiles").select("id, discord_id").not("discord_id", "is", null);
  if (error) {
    console.error("Failed to refresh linked profiles:", error.message);
    return;
  }
  linkedProfiles = new Map(data.map((p) => [p.discord_id, p.id]));
  console.log(`Linked profiles: ${linkedProfiles.size}`);
}

function classifyChannel(channelName) {
  if (!channelName) return null;
  const lower = channelName.toLowerCase();
  return breakKeywords.some((k) => lower.includes(k)) ? "break" : "active";
}

async function syncMember(member) {
  const userId = linkedProfiles.get(member.id);
  if (!userId) return;

  const channel = member.voice?.channel ?? null;
  const status = member.presence?.status ?? "offline";

  const { error } = await supabase.from("discord_presence").upsert({
    user_id: userId,
    discord_id: member.id,
    voice_channel_id: channel?.id ?? null,
    voice_channel_name: channel?.name ?? null,
    category: channel ? classifyChannel(channel.name) : null,
    presence_status: status,
    updated_at: new Date().toISOString(),
  });

  if (error) console.error(`Failed to sync ${member.id}:`, error.message);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.GuildMember],
});

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await refreshLinkedProfiles();

  const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
  const members = await guild.members.fetch({ withPresences: true });
  console.log(`Fetched ${members.size} members, syncing initial state...`);
  for (const member of members.values()) {
    await syncMember(member);
  }
  console.log("Initial sync complete.");

  setInterval(async () => {
    await refreshLinkedProfiles();
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
    const members = await guild.members.fetch({ withPresences: true });
    for (const member of members.values()) await syncMember(member);
  }, Number(RESYNC_INTERVAL_MINUTES) * 60_000);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const member = newState.member ?? oldState.member;
  if (member) await syncMember(member);
});

client.on("presenceUpdate", async (oldPresence, newPresence) => {
  const member = newPresence?.member ?? oldPresence?.member;
  if (member) await syncMember(member);
});

client.on("guildMemberRemove", async (member) => {
  const userId = linkedProfiles.get(member.id);
  if (!userId) return;
  await supabase.from("discord_presence").upsert({
    user_id: userId,
    discord_id: member.id,
    voice_channel_id: null,
    voice_channel_name: null,
    category: null,
    presence_status: "offline",
    updated_at: new Date().toISOString(),
  });
});

client.login(DISCORD_BOT_TOKEN);
