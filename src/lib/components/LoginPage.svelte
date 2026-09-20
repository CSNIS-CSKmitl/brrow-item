<script>
  import { ArrowRight, LockKeyhole, Package } from 'lucide-svelte';
  import Button from './Button.svelte';
  export let onLogin = () => {};
  export let onOAuthLogin = () => {};
  export let error = '';
  let email = '';
  let password = '';
</script>

<main class="grid min-h-screen place-items-center bg-[#f2f4ef] px-5 py-12"><div class="w-full max-w-md rounded-3xl border border-[#e1e5dd] bg-white p-8 shadow-soft"><div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sage text-white"><Package size={24}/></div><h1 class="mt-5 text-center text-2xl font-bold text-ink">เข้าสู่ระบบ Borrowly</h1><p class="mt-2 text-center text-sm text-[#7c857e]">เข้าสู่ระบบด้วยบัญชีองค์กรผ่าน OIDC/OAuth</p><button type="button" class="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-[#c9d2c8] bg-white px-4 py-3 text-sm font-bold text-sage hover:bg-[#edf2ed]" on:click={onOAuthLogin}><ArrowRight size={17}/> Login with OIDC</button><div class="my-6 flex items-center gap-3 text-xs text-[#9ba39c]"><span class="h-px flex-1 bg-[#e7e5df]"></span>หรือเข้าสู่ระบบแบบเดิม<span class="h-px flex-1 bg-[#e7e5df]"></span></div><form class="space-y-4" on:submit|preventDefault={() => onLogin(email, password)}><label>อีเมล<input type="email" bind:value={email} placeholder="you@example.com" required /></label><label>รหัสผ่าน<div class="relative"><LockKeyhole class="absolute left-3 top-3 text-[#8a918b]" size={16}/><input class="pl-10" type="password" bind:value={password} placeholder="รหัสผ่าน" required /></div></label>{#if error}<p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>{/if}<Button size="lg" disabled={!email || !password}>เข้าสู่ระบบ <ArrowRight size={17}/></Button></form></div></main>
