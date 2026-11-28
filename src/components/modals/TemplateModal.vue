<template>
  <dialog class="modal" :class="{ 'modal-open': store.templateModal.show }">
    <div class="modal-box glass-panel max-w-2xl">
      <h3 class="font-bold text-xl text-adaptive-white mb-6 flex items-center gap-2">
        <i class="fa-solid fa-wand-magic-sparkles text-accent"></i> 选择配置模板
      </h3>
      <p class="text-xs text-adaptive-muted mb-4">先选一种 Clash 配置方式，下一步再勾选要加入的节点。</p>

      <div class="grid grid-cols-2 gap-4">
        <button @click="selectTemplate('default')" class="card bg-primary/5 hover:bg-primary/10 cursor-pointer transition-all duration-300 border border-primary/20 hover:border-primary/50 p-4 text-center">
          <i class="fa-solid fa-file-shield text-3xl text-primary mb-2"></i>
          <div class="font-bold text-adaptive-white text-sm">默认模板</div>
          <div class="text-xs text-adaptive-muted mt-1">已写好常用头部、Proxy 策略组和分流规则，适合直接用</div>
        </button>
        <button @click="selectTemplate('blank')" class="card bg-secondary/5 hover:bg-secondary/10 cursor-pointer transition-all duration-300 border border-secondary/20 hover:border-secondary/50 p-4 text-center">
          <i class="fa-solid fa-file text-3xl text-secondary mb-2"></i>
          <div class="font-bold text-adaptive-white text-sm">空白模板</div>
          <div class="text-xs text-adaptive-muted mt-1">不含那套长头部，仍带一个可用的 Proxy 选择组和默认规则</div>
        </button>
        <button @click="selectTemplate('raw')" class="card bg-warning/5 hover:bg-warning/10 cursor-pointer transition-all duration-300 border border-warning/20 hover:border-warning/50 p-4 text-center">
          <i class="fa-solid fa-cloud-arrow-up text-3xl text-warning mb-2"></i>
          <div class="font-bold text-adaptive-white text-sm">托管 YAML</div>
          <div class="text-xs text-adaptive-muted mt-1">上传已有的 Clash 配置，用当前勾选的节点替换里面的节点</div>
        </button>
        <!-- 已保存模板 -->
        <button v-for="t in store.userTemplates" :key="t.id" @click="selectTemplate('custom', t)"
          class="card bg-accent/5 hover:bg-accent/10 cursor-pointer transition-all duration-300 border border-accent/20 hover:border-accent/50 p-4 text-center relative group">
          <button @click.stop="deleteTemplate(t.id)" class="btn btn-circle btn-ghost btn-xs absolute top-1 right-1 opacity-0 group-hover:opacity-100">
            <i class="fa-solid fa-xmark text-error"></i>
          </button>
          <i class="fa-solid fa-bookmark text-3xl text-accent mb-2"></i>
          <div class="font-bold text-adaptive-white text-sm truncate">{{ t.name }}</div>
          <div class="text-xs text-adaptive-muted mt-1">你保存过的模板</div>
        </button>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="store.templateModal.show = false">取消</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="store.templateModal.show = false"></form>
  </dialog>
</template>

<script setup>
import { useMainStore } from '../../stores/main.js'
import { authFetch, loadTemplates } from '../../api/index.js'
import { showToast } from '../../utils/helpers.js'
import { API, defaultHeader, defaultRules } from '../../api/config.js'
import { withProcess } from '../../utils/panel.js'

const store = useMainStore()

function selectTemplate(type, template) {
  if (type === 'default') {
    store.groupForm.clash_config = withProcess({
      mode: 'generate',
      header: defaultHeader,
      groups: [
        { name: 'Proxy', type: 'select', proxies: [], useAllProxies: true }
      ],
      rules: defaultRules,
      resources: [],
      raw_yaml: ''
    })
  } else if (type === 'blank') {
    store.groupForm.clash_config = withProcess({
      mode: 'generate',
      header: '',
      groups: [{ name: 'Proxy', type: 'select', proxies: [], useAllProxies: true }],
      rules: 'MATCH,Proxy',
      resources: [],
      raw_yaml: ''
    })
  } else if (type === 'raw') {
    store.groupForm.clash_config = withProcess({
      mode: 'raw', header: '', groups: [], rules: '', resources: [], raw_yaml: ''
    })
  } else if (type === 'custom' && template) {
    store.groupForm.clash_config = withProcess({
      mode: 'generate',
      header: template.header || '',
      groups: JSON.parse(JSON.stringify(template.groups || [])),
      rules: template.rules || '',
      resources: [],
      raw_yaml: ''
    })
  }

  store.templateModal.show = false
  store.groupModal.tab = store.groupForm.clash_config.mode === 'raw' ? 'raw' : 'base'
  store.groupModal.show = true
}

async function deleteTemplate(id) {
  if (!confirm('确定删除这个模板？')) return
  try {
    await authFetch(`${API}/templates/${id}`, { method: 'DELETE' })
    showToast('模板已删除')
    loadTemplates()
  } catch (e) { showToast('删除失败', 'error') }
}
</script>
