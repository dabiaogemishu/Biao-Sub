<template>
  <div class="grid grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-7">
    <div class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-default">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-primary/15 text-primary"><i class="fa-solid fa-server text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-primary">{{ store.stats.nodeCount }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium">自建节点</div>
      </div>
    </div>
    <div class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-default">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-warning/15 text-warning"><i class="fa-solid fa-folder-tree text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-warning">{{ store.stats.groupCount }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium">节点组</div>
      </div>
    </div>
    <div class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-default">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-success/15 text-success"><i class="fa-solid fa-cloud-arrow-down text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-success">{{ store.stats.remoteCount }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium">远程订阅</div>
      </div>
    </div>
    <div class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-default">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-accent/15 text-accent"><i class="fa-solid fa-layer-group text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-accent">{{ store.stats.aggregateCount }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium">聚合组</div>
      </div>
    </div>
    <div class="card glass-panel stat-card hover:-translate-y-0.5 transition-transform duration-300 cursor-default">
      <div class="card-body p-3 sm:p-4 text-center">
        <span class="stat-icon bg-secondary/15 text-secondary"><i class="fa-solid fa-diagram-project text-xs"></i></span>
        <div class="text-2xl sm:text-3xl font-bold text-secondary">{{ store.stats.totalActualNodes }}</div>
        <div class="text-xs sm:text-sm text-adaptive-muted font-medium">总节点数</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useMainStore } from '../../stores/main.js'
const store = useMainStore()
</script>
