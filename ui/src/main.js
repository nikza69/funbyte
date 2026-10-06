import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import MainView from './views/MainView.vue'
import DataView from './views/DataView.vue'
import SystemView from './views/SystemView.vue'
import './style.css'

// One URL per page: #/main, #/data-analytics, #/system-analytics
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/main' },
    { path: '/main', component: MainView },
    { path: '/data-analytics', component: DataView },
    { path: '/system-analytics', component: SystemView },
  ],
})
createApp(App).use(router).mount('#app')
