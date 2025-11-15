const PLATFORM_KEYWORDS = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "threads", label: "Threads" },
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "Facebook" },
  { key: "telegram", label: "Telegram" },
  { key: "twitter", label: "Twitter/X" },
  { key: "x ", label: "Twitter/X" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "spotify", label: "Spotify" },
  { key: "discord", label: "Discord" },
  { key: "shopee", label: "Shopee" },
  { key: "tokopedia", label: "Shopee" },
  { key: "bukalapak", label: "Shopee" },
  { key: "kwai", label: "Kwai" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "pinterest", label: "Pinterest" },
  { key: "google play", label: "Google Play" },
  { key: "reddit", label: "Reddit" },
  { key: "quora", label: "Quora" },
  { key: "soundcloud", label: "SoundCloud" },
];

const FALLBACK_ACTIONS = [
  "Followers",
  "Likes",
  "Views",
  "Comments",
  "Shares",
  "Subscribers",
  "Members",
  "Reactions",
  "Other",
];

const ACTION_SYNONYMS = {
  Followers: ["follow", "subscriber", "subscribers", "member"],
  Likes: ["like", "reaction", "favourite", "favorite", "love"],
  Views: ["view", "watch", "play", "visit", "traffic"],
  Comments: ["comment", "review"],
  Shares: ["share", "reshare"],
  Subscribers: ["subscriber", "sub", "subs"],
  Members: ["member", "join"],
  Reactions: ["reaction", "emoji"],
};

function guessPlatform(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (!normalized) return "Other";
  const found = PLATFORM_KEYWORDS.find(({ key }) => normalized.includes(key));
  return found ? found.label : "Other";
}

function normalizeActionLabel(raw = "") {
  if (!raw) return "Other";
  const normalized = String(raw).toLowerCase();
  for (const [label, keywords] of Object.entries(ACTION_SYNONYMS)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return label;
    }
  }
  return "Other";
}

const contains = (a = "", b = "") => String(a).toLowerCase().includes(String(b).toLowerCase());

function matchAction(category = "", action = "") {
  if (!action) return true;
  const normalizedAction = action.toLowerCase();
  const normalizedCategory = String(category || "").toLowerCase();
  if (!normalizedCategory) return normalizedAction === "other";
  if (contains(normalizedCategory, normalizedAction) || contains(normalizedAction, normalizedCategory)) {
    return true;
  }
  const synonyms = ACTION_SYNONYMS[action] || [];
  return synonyms.some((keyword) => normalizedCategory.includes(keyword));
}

function mapService(service = {}, platformHint = "", actionHint = "") {
  const platformGuess =
    platformHint ||
    service?.platform ||
    guessPlatform(service?.platform || service?.name || service?.category || service?.description || "");
  const actionGuess =
    actionHint ||
    service?.action ||
    normalizeActionLabel(service?.category || service?.name || service?.description || "");

  const providerId =
    service?.provider_service_id ??
    service?.service_id ??
    service?.service ??
    service?.id ??
    service?.ID ??
    null;

  const min = Number(service?.min ?? service?.min_qty ?? service?.minimum ?? 1);
  const max = Number(service?.max ?? service?.max_qty ?? service?.maximum ?? 100000);
  const rate = Number(service?.rate ?? service?.price ?? service?.price_per_1000 ?? 0);

  return {
    provider_service_id: providerId ? String(providerId) : null,
    service_id: providerId ? String(providerId) : null,
    name: service?.name || `${platformGuess} ${actionGuess}`.trim(),
    category: service?.category || actionGuess,
    platform: platformGuess,
    action: actionGuess,
    min: Number.isFinite(min) && min > 0 ? min : 1,
    max: Number.isFinite(max) && max > 0 ? max : 100000,
    rate_per_1k: Number.isFinite(rate) ? rate : 0,
    description: service?.note || service?.description || "",
  };
}

module.exports = {
  guessPlatform,
  normalizeActionLabel,
  matchAction,
  mapService,
  FALLBACK_ACTIONS,
};
