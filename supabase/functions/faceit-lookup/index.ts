// Supabase Edge Function: faceit-lookup
// Looks up CS2 player statistics by SteamID64 via Faceit Data API v4

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PlayerLookupResult {
  steam_id: string;
  faceit_nickname: string | null;
  faceit_level: number | null;
  faceit_elo: number | null;
  avatar?: string | null;
  not_found?: boolean;
  error?: string | null;
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const FACEIT_API_KEY = Deno.env.get("FACEIT_API_KEY");
    if (!FACEIT_API_KEY) {
      console.warn("FACEIT_API_KEY secret is not configured in Supabase.");
      // If secret not configured yet, return structured fallback without 500 error
      return new Response(
        JSON.stringify({
          error: "FACEIT_API_KEY secret is not set in Supabase Edge Functions",
          results: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const body = await req.json();
    let steamIds: string[] = [];

    if (Array.isArray(body.steam_ids)) {
      steamIds = body.steam_ids;
    } else if (body.steam_id) {
      steamIds = [body.steam_id];
    } else {
      return new Response(
        JSON.stringify({ error: "Missing steam_id or steam_ids in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process Steam IDs in parallel
    const lookups = steamIds.map(async (rawSteamId): Promise<PlayerLookupResult> => {
      const steamId = String(rawSteamId).trim();

      // Basic SteamID64 validation (17 digits)
      if (!/^\d{17}$/.test(steamId)) {
        return {
          steam_id: steamId,
          faceit_nickname: null,
          faceit_level: null,
          faceit_elo: null,
          error: "Invalid SteamID64 format (must be 17 digits)",
        };
      }

      try {
        // Faceit Data API v4 endpoint for CS2 player by game_player_id
        const faceitUrl = `https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${encodeURIComponent(steamId)}`;
        const response = await fetch(faceitUrl, {
          headers: {
            Authorization: `Bearer ${FACEIT_API_KEY}`,
            Accept: "application/json",
          },
        });

        if (response.status === 404) {
          // Player not registered on Faceit - allow registration to proceed
          return {
            steam_id: steamId,
            faceit_nickname: null,
            faceit_level: null,
            faceit_elo: null,
            not_found: true,
          };
        }

        if (!response.ok) {
          console.error(`Faceit API error (${response.status}) for ${steamId}`);
          return {
            steam_id: steamId,
            faceit_nickname: null,
            faceit_level: null,
            faceit_elo: null,
            error: `Faceit API returned ${response.status}`,
          };
        }

        const data = await response.json();
        const cs2Game = data.games?.cs2;

        return {
          steam_id: steamId,
          faceit_nickname: data.nickname || null,
          faceit_level: cs2Game?.skill_level ?? null,
          faceit_elo: cs2Game?.faceit_elo ?? null,
          avatar: data.avatar || null,
        };
      } catch (err) {
        console.error("Fetch error for SteamID:", steamId, err);
        return {
          steam_id: steamId,
          faceit_nickname: null,
          faceit_level: null,
          faceit_elo: null,
          error: "Network error during Faceit lookup",
        };
      }
    });

    const results = await Promise.all(lookups);

    return new Response(
      JSON.stringify({
        results,
        // convenience single result if only one steam_id was requested
        player: results.length === 1 ? results[0] : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Edge function general error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
