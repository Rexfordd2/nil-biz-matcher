-- Supabase-like roles for a disposable acceptance database. Synthetic only.
CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path = auth;
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
