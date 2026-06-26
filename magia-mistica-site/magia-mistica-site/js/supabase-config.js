// ============================================
// CONFIGURAÇÃO DO SUPABASE
// ============================================
// Estas são as chaves PÚBLICAS do projeto (seguras para ficar no site).
// A chave "service_role" (secreta) NUNCA deve aparecer aqui.

const SUPABASE_URL = 'https://enjbnsksdicwxdxakzom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuamJuc2tzZGljd3hkeGFrem9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTY3NjQsImV4cCI6MjA5ODA3Mjc2NH0.iS_ll9LbVbK4C-aQCrJvbXuXJmhs730ItJRMVy5hRMU';

// Cria o cliente do Supabase (usado em loja.js e admin.js)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
