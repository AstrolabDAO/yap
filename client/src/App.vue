<template lang="pug">
Header
  router-view
</template>

<script setup lang="ts">
import Header from './components/Header.vue';
</script>

<style>
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--bg0);
  color: var(--fg0);
  a {
    color: var(--fg3);
    &:visited {
      color: var(--pink);
    }
    &.active, &:hover {
      color: var(--fg2);
    }
  }
  font-family: 'IBM Plex Mono', sans-serif;
}
</style>
