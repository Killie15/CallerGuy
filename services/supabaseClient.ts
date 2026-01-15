import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing environment variables. Leaderboard will use localStorage fallback.');
}

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export interface LeaderboardEntry {
    id?: string;
    player_name: string;
    persona_id: string;
    score: number;
    summary?: string;
    transcript?: string;
    rubric?: string;  // JSON stringified rubric
    duration_seconds?: number;
    created_at?: string;
}

export async function saveScore(entry: Omit<LeaderboardEntry, 'id' | 'created_at'>): Promise<boolean> {
    console.log('[Supabase] saveScore called with:', entry);

    if (!supabase) {
        console.warn('[Supabase] Client not configured (missing env vars), skipping save');
        return false;
    }

    console.log('[Supabase] Client exists, attempting insert...');

    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .insert([entry])
            .select();

        if (error) {
            console.error('[Supabase] Insert error:', error.message, error.details, error.hint);
            return false;
        }

        console.log('[Supabase] Insert successful! Data:', data);
        return true;
    } catch (e) {
        console.error('[Supabase] Exception during insert:', e);
        return false;
    }
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
    if (!supabase) {
        console.warn('[Supabase] Not configured, returning empty');
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .order('score', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[Supabase] Error fetching leaderboard:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('[Supabase] Exception:', e);
        return [];
    }
}
