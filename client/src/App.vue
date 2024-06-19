<template lang="pug">
#app
  Header
    router-view
</template>

<script setup lang="ts">
import Header from './components/Header.vue';
</script>

<style scoped>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
