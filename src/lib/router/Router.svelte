<script>
  import NotFoundPage from '../../routes/+error.svelte';
  import UnauthorizedPage from '../../routes/+unauthorized.svelte';
  import { authReady, user, userType, canAdmin } from '../stores.js';

  export let path = '/';

  // ค้นหาไฟล์ +page.svelte ทั้งหมดใน src/routes อัตโนมัติ
  const pageModules = import.meta.glob('/src/routes/**/+page.svelte', { eager: true });

  function resolvePage(pathname) {
    const clean = pathname.replace(/\/$/, '') || '/';
    if (clean === '/') {
      return pageModules['/src/routes/+page.svelte']?.default;
    }
    const key = `/src/routes${clean}/+page.svelte`;
    return pageModules[key]?.default;
  }

  $: cleanPath = path.replace(/\/$/, '') || '/';
  $: matchedComponent = resolvePage(cleanPath);

  // ตรวจสอบการเข้าสู่ระบบ
  $: isUnauthenticated = $authReady && !$user && !['/login', '/privacy', '/terms'].includes(cleanPath);

  // ตรวจสอบสิทธิ์เข้าถึง (Guard)
  $: guardFailed =
    (cleanPath === '/approvals' && !($userType === 'teachers' || $canAdmin)) ||
    (cleanPath === '/admin' && !$canAdmin);

  $: activeComponent = isUnauthenticated
    ? pageModules['/src/routes/login/+page.svelte']?.default
    : !matchedComponent
      ? NotFoundPage
      : guardFailed
        ? UnauthorizedPage
        : matchedComponent;

  $: activeProps = guardFailed
    ? {
        message:
          cleanPath === '/approvals'
            ? 'หน้านี้สำหรับอาจารย์และผู้ดูแลระบบเท่านั้น'
            : 'หน้านี้สำหรับผู้ดูแลระบบเท่านั้น',
      }
    : {};
</script>

{#if !$authReady && !['/privacy', '/terms'].includes(cleanPath)}
  <main class="grid min-h-[calc(100dvh-5rem)] place-items-center bg-[#f2f4ef] px-5 py-12" aria-busy="true" aria-label="กำลังตรวจสอบการเข้าสู่ระบบ">
    <div class="flex flex-col items-center gap-3 text-[#68726b]">
      <span class="h-8 w-8 animate-spin rounded-full border-2 border-[#c8d4c9] border-t-sage"></span>
      <p class="text-sm font-semibold">กำลังตรวจสอบการเข้าสู่ระบบ…</p>
    </div>
  </main>
{:else}
  <svelte:component this={activeComponent} {...activeProps} />
{/if}
