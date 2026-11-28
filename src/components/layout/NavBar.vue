<template>
  <div class="navbar glass-panel rounded-2xl mb-4 sm:mb-7 shadow-xl px-3 sm:px-5 min-h-16">
    <div class="flex-1 gap-3">
      <span class="brand-mark !w-10 !h-10 text-base flex-shrink-0"><i class="fa-solid fa-bolt"></i></span>
      <div class="leading-tight">
        <div class="text-lg sm:text-xl font-bold text-adaptive-white">BiaoSUB</div>
        <div class="hidden sm:block text-xs text-adaptive-muted">把多个节点合成一条订阅</div>
      </div>
    </div>
    <div class="flex-none flex gap-1">
      <button @click="toggleTheme" class="btn btn-circle btn-sm sm:btn-md btn-ghost tooltip tooltip-bottom"
        :data-tip="store.theme === 'dark' ? '切换亮色' : '切换深色'">
        <i v-if="store.theme === 'dark'" class="fa-solid fa-sun text-lg text-yellow-400"></i>
        <i v-else class="fa-solid fa-moon text-lg text-adaptive-muted"></i>
      </button>
      <button @click="$emit('openSettings')" class="btn btn-circle btn-sm sm:btn-md btn-ghost tooltip tooltip-bottom"
        data-tip="系统设置：备份和远程订阅代理"><i class="fa-solid fa-gear text-lg"></i></button>
      <button @click="logout" class="btn btn-circle btn-sm sm:btn-md btn-ghost text-red-400 tooltip tooltip-bottom"
        data-tip="退出登录"><i class="fa-solid fa-power-off text-lg"></i></button>
    </div>
  </div>
</template>

<script setup>
import { useMainStore } from '../../stores/main.js'
import { showToast } from '../../utils/helpers.js'
import { writeSession } from '../../api/index.js'
import { clearPanelState } from '../../utils/session.js'

const store = useMainStore()

defineEmits(['openSettings'])

function toggleTheme() {
  store.theme = store.theme === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', store.theme)
  localStorage.setItem('theme', store.theme)
}

function logout() {
  store.isLoggedIn = false
  writeSession('')
  clearPanelState(store)
  showToast('已退出登录')
}
</script>
