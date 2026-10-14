<script>
  export let variant = 'primary';
  export let size = 'md';
  export let disabled = false;
  export let type = 'button';
</script>

<button {type} class="btn {variant} {size}" {disabled} on:click>
  <slot />
</button>
