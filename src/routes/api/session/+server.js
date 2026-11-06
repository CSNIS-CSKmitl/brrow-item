import { json } from "@sveltejs/kit";

export async function GET({ locals }) {
  if (!locals.user) {
    return json({ authenticated: false }, { status: 401 });
  }
  return json({ authenticated: true, user: locals.user });
}
