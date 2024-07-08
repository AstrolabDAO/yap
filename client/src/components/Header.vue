
<template lang="pug">
header.bg-gray-800.text-white.p-4
h1.text-3xl Yap > Astrolab
div
  span Open Topics: {{ stats.topics }}
  span Open Proposals: {{ stats.proposals }}
template(v-if='isConnected')
  button(@click="() => useWeb3Modal().open({ view: 'Account' })") test {{ shortAddress.value }}
template(v-else)
  button(@click="() => login()") Connect

.links
  a(href='https://twitter.com/project' target='_blank') Twitter
  a(href='https://github.com/project' target='_blank') GitHub
  a(href='https://discord.com/invite/project' target='_blank') Discord
</template>

<script setup>
import { computed, ref } from 'vue';
import { useWeb3Modal, useWeb3ModalAccount } from "@web3modal/ethers/vue";

import { login } from '../api-client';
import { shortenAddress } from '../../../common/utils';
import state from '../state';

const { address, isConnected } = useWeb3ModalAccount();
const stats = ref({ topics: 0, proposals: 0 });
const shortAddress = computed(() => shortenAddress(address.value));

// Fetch stats from backend or websocket updates
</script>

<style scoped>
.links a {
  margin-right: 10px;
}
</style>
