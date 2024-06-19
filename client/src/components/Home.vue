<template lang="pug">
div
  header
    .container.mx-auto.mt-8
      .border-b.p-4(v-for='topic in topics' :key='topic.id')
        h2 {{ topic.title }}
        p {{ topic.description }}
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Header from './Header.vue';

const topics = ref([]);

onMounted(async () => {
  const res = await fetch('/api/topics');
  topics.value = await res.json();
});
</script>
