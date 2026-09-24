import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qyudourdnnaxgzkiayje.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4XwvWrbJVLMLHiDW8-I1OQ_0vxWDP8m";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);