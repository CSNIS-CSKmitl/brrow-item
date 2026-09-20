<script>
  export let variant = 'primary';
  export let size = 'md';
  export let disabled = false;
</script>

<button class="btn {variant} {size}" {disabled} on:click>
  <slot />
</button>
