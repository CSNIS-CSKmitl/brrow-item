import { json } from "@sveltejs/kit";
import PocketBase from "pocketbase";
import { getPocketBaseUrl } from "$lib/server/pocketbase";
import {
  SESSION_COOKIE,
  cacheSessionUser,
  userFromRecord,
} from "$lib/server/session";

export async function POST({ request, cookies, url }) {
  try {
    const payload = await request.json();
    if (!payload?.token || !payload?.record?.id) {
      return json(
        { ok: false, error: "invalid session payload" },
        { status: 400 },
      );
    }

    const pb = new PocketBase(getPocketBaseUrl());
    pb.autoCancellation(false);
    pb.authStore.save(payload.token);

    let user;
    try {
      const auth = await pb
        .collection("users")
        .authRefresh({ expand: "user_type" });
      user = cacheSessionUser(payload.token, auth.record || payload.record);
    } catch {
      user = cacheSessionUser(payload.token, payload.record);
    }

    cookies.set(SESSION_COOKIE, payload.token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: 60 * 60 * 24 * 7,
    });

    return json({ ok: true, record: user || userFromRecord(payload.record) });
  } catch (err) {
    return json(
      { ok: false, error: "failed to establish session" },
      { status: 500 },
    );
  }
}
