module.exports = {
  apps: [
    {
      name: "mysight-weber",
      script: "npm",
      args: "start",
      cwd: "/srv/mysight/app",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        NODE_OPTIONS: "--max-old-space-size=512",
        NEXTAUTH_URL: "https://weber.mysight.net",
        // === TODO: Supabase P1 (weber) eintragen ===
        NEXT_PUBLIC_SUPABASE_URL: "https://<weber>.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "<weber_anon>",
        SUPABASE_SERVICE_ROLE: "<weber_service_role>",
        TENANT_SLUG: "weber"
      }
    },
    {
      name: "mysight-test",
      script: "npm",
      args: "start",
      cwd: "/srv/mysight/app",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
        NODE_OPTIONS: "--max-old-space-size=512",
        NEXTAUTH_URL: "https://test.mysight.net",
        // === TODO: Supabase P2 (test) eintragen ===
        NEXT_PUBLIC_SUPABASE_URL: "https://<test>.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "<test_anon>",
        SUPABASE_SERVICE_ROLE: "<test_service_role>",
        TENANT_SLUG: "test"
      }
    }
  ]
}
