<script setup lang="ts">
import { Footprints, Navigation } from "lucide-vue-next";
import type { Workspace } from "../../../shared/document";
defineProps<{ state: Workspace }>();
defineEmits<{ toggle: [] }>();
</script>
<template>
  <section class="panel">
    <div class="section-title">
      <h2>角色探索</h2>
      <Footprints :size="17" />
    </div>
    <div class="player-position">
      <span class="avatar-dot"><Navigation :size="18" /></span>
      <div>
        <b>探索者</b
        ><small
          >X {{ state.doc.player.x.toFixed(1) }} &nbsp; Y
          {{ state.doc.player.y.toFixed(1) }} &nbsp; Z
          {{ state.doc.player.z.toFixed(1) }}</small
        >
      </div>
      <i class="status-dot"></i>
    </div>
    <button
      :class="['soft', 'full', { selected: state.mode === 'walk' }]"
      @click="$emit('toggle')"
    >
      {{ state.mode === "walk" ? "返回建造模式" : "进入行走模式" }}
      <span>Tab</span>
    </button>
    <p class="small muted">W A S D 移动 · 空格跳跃</p>
  </section>
</template>
