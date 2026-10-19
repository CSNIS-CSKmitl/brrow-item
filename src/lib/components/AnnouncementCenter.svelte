<script>
  import { onMount } from 'svelte';
  import { Megaphone, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-svelte';
  import { AnnouncementFeed } from '../announcement-feed.svelte';
  import { announcementPriorityLabels, announcementLink } from '../announcements';
  import { floodAnnouncement as legacy } from '../flood-announcement';

  let { open = $bindable(false), userId: _userId } = $props();
  let dialog = $state();

  const fallback = legacy.enabled
    ? {
        id: 'legacy-flood',
        title: legacy.title,
        body: `${legacy.description}\n\n${legacy.instruction}\n“${legacy.message}”`,
        priority: 'emergency',
        revision: legacy.version,
        link_label: 'ไปที่ SOS KMITL',
        link_url: legacy.helpUrl,
        source_url: legacy.sourceUrl,
        start_at: '',
        end_at: ''
      }
    : null;

  const feed = new AnnouncementFeed(
    fallback,
    (unseen) => {
      if (unseen) open = true;
    },
    () => {
      open = false;
    }
  );

  onMount(() => feed.start());

  $effect(() => {
    feed.isOpen = open;
    if (open && !feed.selected && feed.items.length) {
      feed.selected = feed.items[0];
    }
  });

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function dismiss() {
    feed.markRead();
    open = false;
  }

  function acknowledge() {
    if (!feed.nextUnread()) open = false;
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="announcement-title"
  aria-describedby="announcement-body"
  class="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-black/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
  oncancel={(event) => {
    event.preventDefault();
    dismiss();
  }}
  onclick={(event) => {
    if (event.target === dialog) dismiss();
  }}
  onclose={() => (open = false)}
>
  <div class="relative flex flex-col gap-5 p-5 sm:p-6">
    <button
      type="button"
      onclick={dismiss}
      aria-label="ปิดประกาศ"
      class="absolute right-3.5 top-3.5 inline-flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <X aria-hidden="true" class="size-5" />
    </button>

    <header class="flex flex-col gap-2.5 pr-8">
      <div class="flex items-center gap-2">
        <Megaphone aria-hidden="true" class="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
        {#if feed.selected?.priority === 'emergency'}
          <span class="inline-flex items-center rounded-md border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/70 dark:text-red-400">
            ฉุกเฉิน
          </span>
        {:else if feed.selected?.priority === 'important'}
          <span class="inline-flex items-center rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/70 dark:text-amber-400">
            สำคัญ
          </span>
        {:else}
          <span class="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {feed.selected ? announcementPriorityLabels[feed.selected.priority] : 'ประกาศ'}
          </span>
        {/if}
      </div>

      <h2 id="announcement-title" class="break-words text-xl font-semibold leading-snug">
        {feed.selected?.title || (feed.loaded ? 'ยังไม่มีประกาศในขณะนี้' : 'กำลังโหลดประกาศ')}
      </h2>

      <p id="announcement-body" class="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {feed.selected?.body || (feed.loaded ? 'ประกาศใหม่จะแสดงเมื่อเผยแพร่จากศูนย์ประกาศกลาง' : 'กรุณารอสักครู่')}
      </p>
    </header>

    {#if feed.selected}
      {#if announcementLink(feed.selected.link_url)}
        <a
          href={announcementLink(feed.selected.link_url)}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {feed.selected.link_label || 'เปิดลิงก์'}
          <ExternalLink aria-hidden="true" class="size-4" />
        </a>
      {/if}

      {#if announcementLink(feed.selected.source_url)}
        <a
          href={announcementLink(feed.selected.source_url)}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          อ่านประกาศต้นฉบับ
          <ExternalLink aria-hidden="true" class="size-4" />
        </a>
      {/if}
    {/if}

    {#if feed.items.length > 1}
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="ประกาศก่อนหน้า"
          onclick={() => feed.select(-1)}
          class="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ChevronLeft aria-hidden="true" class="size-5" />
        </button>
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
          ประกาศ {feed.items.findIndex((item) => item.id === feed.selected?.id) + 1} / {feed.items.length}
        </p>
        <button
          type="button"
          aria-label="ประกาศถัดไป"
          onclick={() => feed.select(1)}
          class="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ChevronRight aria-hidden="true" class="size-5" />
        </button>
      </div>
    {/if}

    <button
      type="button"
      onclick={feed.selected ? acknowledge : dismiss}
      class="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
    >
      {feed.selected ? 'รับทราบ' : 'ปิด'}
    </button>

    <p class="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      ประกาศจะแสดงอีกครั้งเมื่อเปิดหรือรีโหลดเว็บ
    </p>
  </div>
</dialog>
