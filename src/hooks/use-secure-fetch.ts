"use client";

import { useCsrfToken } from "@/hooks/use-csrf-token";

interface Options extends RequestInit {
  csrf?: boolean;
}

export function useSecureFetch() {
  const { data: csrfToken } = useCsrfToken();

  async function secureFetch<T>(input: RequestInfo | URL, options: Options = {}): Promise<T> {
    const headers = new Headers(options.headers ?? {});
    headers.set("Accept", "application/json");
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (options.csrf !== false) {
      if (!csrfToken) {
        throw new Error("CSRF-Token noch nicht verfügbar");
      }
      headers.set("x-csrf-token", csrfToken);
    }
    const response = await fetch(input, {
      ...options,
      headers,
      credentials: "include",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Unbekannter Fehler");
    }
    return (await response.json()) as T;
  }

  return secureFetch;
}
