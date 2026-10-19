import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
const pbUrl = env.POCKETBASE_URL ?? publicEnv.PUBLIC_POCKETBASE_URL ?? '';
async function pb() { const x = new PocketBase(pbUrl); if (env.PB_ADMIN_EMAIL && env.PB_ADMIN_PASSWORD) await x.admins.authWithPassword(env.PB_ADMIN_EMAIL, env.PB_ADMIN_PASSWORD); return x; }
export async function GET() { try { const x = await pb(); const items = await x.collection('announcements').getFullList({ filter: 'status = "published"', sort: '-updated', fields: 'id,title,body,priority,revision,link_label,link_url,source_url,targets' }); return json({ items: items.filter((a) => !a.targets?.length || a.targets.includes('all') || a.targets.includes('borrowly')), configured: true }); } catch { return json({ items: [], configured: false }); } }
export async function POST({ request, locals, getClientAddress }) { try { const p = await request.json(); const id = String(p.announcement || p.id || '').trim(); if (!/^[a-zA-Z0-9_-]{1,32}$/.test(id)) return json({ ok:true, recorded:false }); const user = locals.user?.id; const viewer_hash = createHash('sha256').update(`${user || getClientAddress()}:${request.headers.get('user-agent') || 'unknown'}`).digest('hex'); await (await pb()).collection('announcement_reads').create({ announcement:id, revision:String(p.revision || 'default').slice(0,100), site:'borrowly', ...(user ? {user} : {}), viewer_hash }); return json({ok:true, recorded:true}); } catch { return json({ok:true, recorded:false}); } }
