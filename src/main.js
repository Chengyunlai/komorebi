import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
if(new URLSearchParams(location.search).get('view')==='motion-lab'){import('./motion-lab/MotionLab.vue').then(({default:MotionLab})=>createApp(MotionLab).mount('#app'))}else createApp(App).mount('#app')
