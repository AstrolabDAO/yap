
<template lang="pug">
header.bg-gray-800.text-white.p-4
h1.text-3xl Yap > Astrolab
div
  span Open Topics: {{ stats.topics }}
  span Open Proposals: {{ stats.proposals }}
.links
  a(href='https://twitter.com/project' target='_blank') Twitter
  a(href='https://github.com/project' target='_blank') GitHub
  a(href='https://discord.com/invite/project' target='_blank') Discord
</template>

<script setup>
import { ref } from 'vue';

const stats = ref({ topics: 0, proposals: 0 });

// Fetch stats from backend or websocket updates
</script>

<style scoped>
.links a {
  margin-right: 10px;
}
</style>
