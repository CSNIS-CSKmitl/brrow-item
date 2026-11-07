import { json } from "@sveltejs/kit";
import { adminPocketBase, getPocketBaseUrl } from "$lib/server/pocketbase";
import { getUserRoles } from "$lib/roles";
import PocketBase from "pocketbase";

export async function GET() {
  try {
    let pb;
    try {
      pb = await adminPocketBase();
    } catch (e) {
      console.warn("[api/teachers] admin auth failed, trying unauthenticated fallback:", e);
      pb = new PocketBase(getPocketBaseUrl());
      pb.autoCancellation(false);
    }

    const records = await pb.collection("users").getFullList({
      sort: "name",
      expand: "user_type",
      requestKey: null,
    });

    const teachers = records
      .filter((u) => {
        const roles = getUserRoles(u);
        return roles.includes("teachers") || roles.includes("teacher");
      })
      .map((u) => ({
        id: u.id,
        name: String(u.name || u.username || "อาจารย์"),
        email: u.email || "",
      }));

    return json(teachers);
  } catch (err) {
    console.error("[api/teachers] failed to load teachers:", err);
    return json([], { status: 500 });
  }
}
