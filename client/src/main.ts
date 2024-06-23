import { createApp } from 'vue';

import { YAP_ENDPOINT } from '../../common/constants';
import state from './state'; // App state
import App from './App.vue'; // App root component
import './style.css'; // Tailwind

state.init(
  createApp(App),
  new WebSocket(YAP_ENDPOINT.replace('http', 'ws'))
);
