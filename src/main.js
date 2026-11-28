import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/theme.css'
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import '@fortawesome/fontawesome-free/css/regular.min.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
