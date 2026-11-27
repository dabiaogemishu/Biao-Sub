<template>
  <div class="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-md px-4">
    <div class="card w-full max-w-sm glass-panel shadow-2xl overflow-hidden">
      <div class="card-body text-center p-8">
        <div class="mb-5 flex justify-center">
          <span class="brand-mark text-xl"><i class="fa-solid fa-bolt"></i></span>
        </div>
        <h2 class="card-title justify-center text-2xl text-adaptive-white mb-1">BiaoSUB</h2>
        <p class="text-adaptive-muted text-sm mb-6">把自建节点和机场订阅，聚成一条可用的订阅地址</p>
        <input type="password" v-model="store.loginPassword" placeholder="管理密码"
          class="input input-bordered w-full bg-adaptive-input text-center text-lg tracking-widest"
          @keyup.enter="handleLogin" />
        <button class="btn btn-primary w-full mt-4" @click="handleLogin" :disabled="store.loginLoading">
          <span v-if="store.loginLoading" class="loading loading-spinner loading-sm"></span>
          {{ store.loginLoading ? '验证中...' : '登录' }}
        </button>
        <p v-if="passwordError" class="text-error text-sm mt-3">{{ passwordError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMainStore } from '../../stores/main.js'
import { writeSession, loadResources, loadGroups, loadTemplates } from '../../api/index.js'
import { showToast } from '../../utils/helpers.js'
import { API } from '../../api/config.js'

const store = useMainStore()
const passwordError = ref('')

async function handleLogin() {
  if (!String(store.loginPassword || '').trim()) {
    passwordError.value = '请输入密码'
    showToast('请输入密码', 'error')
    return
  }
  passwordError.value = ''
  store.loginLoading = true
  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: store.loginPassword })
    })
    const data = await res.json()
    if (data.success && data.token) {
      writeSession(data.token)
      store.loginPassword = ''
      store.resourcesReady = false
      await Promise.all([loadResources(), loadGroups(), loadTemplates()])
      store.isLoggedIn = true
      showToast('登录成功')
    } else {
      showToast(data.error || '密码错误', 'error')
    }
  } catch (e) {
    showToast('登录失败', 'error')
  }
  store.loginLoading = false
}

defineExpose({ handleLogin })
</script>
