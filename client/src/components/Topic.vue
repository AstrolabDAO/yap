<template lang="pug">
div
  header
    .container.mx-auto.mt-8
      div
        h1 {{ topic.title }}
        p {{ topic.description }}
        div(v-if='topic.proposal')
          h2 Proposal
          p {{ topic.proposal.description }}
          div
            button(@click="vote('for')") For
            button(@click="vote('abstain')") Abstain
            button(@click="vote('against')") Against
      .border-b.p-4(v-for='message in messages' :key='message.id')
        p(v-html='message.content')
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Header from './Header.vue';

const topic = ref({});
const messages = ref([]);

onMounted(async () => {
  const res = await fetch('/api/topic/1'); // Replace with dynamic ID
  topic.value = await res.json();

  const msgRes = await fetch('/api/topic/1/messages'); // Replace with dynamic ID
  messages.value = await msgRes.json();
});

const vote = async (type) => {
  // Implement vote functionality
};
</script>
