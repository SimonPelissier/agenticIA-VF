// Adresse de la base Supabase et clé publique « anon ». Cette clé est faite pour être dans le site :
// les règles d'accès (supabase/schema.sql) ne lui permettent que de LIRE les votes, les articles
// et les déclarations validées. La clé secrète des agents (service_role) ne doit jamais être ici.
window.MARIAN_SUPABASE = {
  url: "https://rjpqgdxdomktrysokdnv.supabase.co",
  cle: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqcHFnZHhkb21rdHJ5c29rZG52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4OTAxNzQsImV4cCI6MjEwOTQ2NjE3NH0.ffkAV5YoOtm3rjpL5QppGVGZ9Xj_A-d8DXHh7-RMSjQ"
};
