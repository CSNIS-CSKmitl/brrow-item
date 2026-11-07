import PocketBase from "pocketbase";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

export function getPocketBaseUrl() {
  const configured = env.POCKETBASE_URL || publicEnv.PUBLIC_POCKETBASE_URL;
  if (configured && configured !== "/") return configured;
  return env.VITE_POCKETBASE_TARGET || "http://127.0.0.1:8090";
}

let sharedAdmin = null;
let sharedAdminAt = 0;
let sharedAdminPromise = null;

export async function adminPocketBase() {
  const adminEmail = env.PB_ADMIN_EMAIL || "techasit2424@gmail.com";
  const adminPassword = env.PB_ADMIN_PASSWORD || "born5415";
  if (!adminEmail || !adminPassword) {
    throw new Error("admin credentials are not configured");
  }
  const now = Date.now();
  if (
    sharedAdmin &&
    sharedAdmin.authStore.isValid &&
    now - sharedAdminAt < 5 * 60 * 1000
  ) {
    return sharedAdmin;
  }
  if (sharedAdminPromise) return sharedAdminPromise;

  sharedAdminPromise = (async () => {
    const pb = new PocketBase(getPocketBaseUrl());
    pb.autoCancellation(false);
    try {
      await pb
        .collection("_superusers")
        .authWithPassword(adminEmail, adminPassword);
    } catch {
      await pb.admins.authWithPassword(adminEmail, adminPassword);
    }
    sharedAdmin = pb;
    sharedAdminAt = Date.now();
    return pb;
  })();

  try {
    return await sharedAdminPromise;
  } finally {
    sharedAdminPromise = null;
  }
}
