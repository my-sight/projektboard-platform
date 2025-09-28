"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchCsrf() {
  const res = await fetch("/api/security/csrf", {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Konnte CSRF-Token nicht abrufen");
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export function useCsrfToken() {
  const query = useQuery({
    queryKey: ["csrf-token"],
    queryFn: fetchCsrf,
    refetchInterval: 15 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });

  return query;
}
