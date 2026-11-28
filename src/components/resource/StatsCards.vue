<template>
  <div class="grid grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-7">
    <div role="button" tabindex="0" class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-pointer" @click="openStat('node')" @keydown="onStatKey($event, 'node')">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-primary/15 text-primary"><i class="fa-solid fa-server text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-primary">{{ store.stats.nodeCount }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium tooltip tooltip-bottom" data-tip="点击查看自建节点，一条分享链接就是一个资源">自建节点</div>
      </div>
    </div>
    <div role="button" tabindex="0" class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-pointer" @click="openStat('group')" @keydown="onStatKey($event, 'group')">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-warning/15 text-warning"><i class="fa-solid fa-folder-tree text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-warning">{{ store.stats.groupCount }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium tooltip tooltip-bottom" data-tip="点击查看节点组，多条节点放在同一个资源里">节点组</div>
      </div>
    </div>
    <div role="button" tabindex="0" class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-pointer" @click="openStat('remote')" @keydown="onStatKey($event, 'remote')">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-success/15 text-success"><i class="fa-solid fa-cloud-arrow-down text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-success">{{ store.stats.remoteCount }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium tooltip tooltip-bottom" data-tip="点击查看远程订阅，用机场订阅地址在线拉取的节点">远程订阅</div>
      </div>
    </div>
    <div role="button" tabindex="0" class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-pointer" @click="openStat('aggregates')" @keydown="onStatKey($event, 'aggregates')">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-accent/15 text-accent"><i class="fa-solid fa-layer-group text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-accent">{{ store.stats.aggregateCount }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium tooltip tooltip-bottom" data-tip="点击查看聚合组，组合后的订阅可复制给客户端">聚合组</div>
      </div>
    </div>
    <div role="button" tabindex="0" class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-pointer" @click="openStat('all')" @keydown="onStatKey($event, 'all')">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-secondary/15 text-secondary"><i class="fa-solid fa-diagram-project text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-secondary">{{ store.stats.totalActualNodes }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium tooltip tooltip-bottom" data-tip="点击查看资源池，数字是所有资源的节点总数">总节点数</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useMainStore } from '../../stores/main.js'
const store = useMainStore()

function openStat(type) {
  if (type === 'aggregates') {
    store.currentTab = 'groups'
    return
  }
  store.currentTab = 'resources'
  store.resourceFilter = type
  store.resourceQuery = ''
}

function onStatKey(event, type) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openStat(type)
  }
}
</script>
