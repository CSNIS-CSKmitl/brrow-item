<script>
  import NotFoundPage from '../../routes/+error.svelte';
  import UnauthorizedPage from '../../routes/+unauthorized.svelte';
  import { user, userType, canAdmin } from '../stores.js';

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
  $: isUnauthenticated = !$user && cleanPath !== '/login';

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

<svelte:component this={activeComponent} {...activeProps} />
