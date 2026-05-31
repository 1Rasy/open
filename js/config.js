// 配置与初始化 Supabase Client
const SUPABASE_URL = "https://mnmzqmqxdzagpounvchn.supabase.co";
const SUPABASE_KEY = "sb_publishable_-AQkn3K06H0cykzBsM_pGg_J1lYgIPF";
window.client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
