import { useAuth } from "@clerk/clerk-react";

import { apiFetch } from "../api/client";

/** Clerk session JWT on each request for Fastify `registerClerkAuth` */
export function useAuthorizedFetch() {
  const { getToken } = useAuth();
  return (path: string, init?: RequestInit) =>
    apiFetch(path, init, getToken);
}
