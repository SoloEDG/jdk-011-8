<script setup lang="ts">
import { computed } from "vue";
import type { Workspace } from "../../../shared/document";
import { formatClock, phaseLabel, percent } from "../index";

const props = defineProps<{ state: Workspace }>();
const emit = defineEmits<{ mode: ["local" | "full"] }>();
const view = computed(() => props.state.lighting);

const exposureLabel = computed(
  () =>
    ({
      open: "露天 · 天光充足",
      sheltered: "屋檐下 · 天光减弱",
      torchlit: "火把照明",
      dark: "封闭 · 无直接光源",
      unknown: "正在采样",
    })[view.value.exposure],
);

const statusText = computed(() => {
  const v = view.value;
  if (v.status === "computing") return "传播中";
  if (v.pending) return "等待重算";
  return v.approximate ? "局部近似" : "完整传播";
});

const timeLabel = computed(() => {
  const t = props.state.doc.time;
  return `${formatClock(t)} · ${phaseLabel(t)}`;
});
</script>

<template>
  <section class="panel lighting-panel">
    <div class="section-title">
      <h2>昼夜与光照</h2>
      <span class="light-status" :class="view.status"
        ><i></i>{{ statusText }}</span
      >
    </div>
    <div class="light-readout">
      <div class="light-dial">
        <div
          class="dial-fill"
          :style="{ height: percent(view.level) }"
        ></div>
        <b>{{ percent(view.level) }}</b>
      </div>
      <div class="light-copy">
        <b>{{ exposureLabel }}</b>
        <small>{{ timeLabel }}</small>
        <small
          >天光 {{ percent(view.daylight) }} · 火把
          {{ percent(view.torch) }} · 天光通道
          {{ percent(view.sky) }}</small
        >
      </div>
    </div>
    <div class="light-stats">
      <div>
        <b>{{ view.torches }}</b><small>火把</small>
      </div>
      <div>
        <b>{{ view.enclosed }}</b><small>封闭格</small>
      </div>
      <div>
        <b>{{ view.visited.toLocaleString() }}</b><small>传播格</small>
      </div>
      <div>
        <b>{{ view.elapsed.toFixed(1) }}ms</b><small>求解耗时</small>
      </div>
    </div>
    <div class="light-modes" role="group" aria-label="光照更新方式">
      <button
        :class="{ active: view.mode === 'local' }"
        title="编辑后只重算附近区域，代价低但可能略有误差"
        @click="emit('mode', 'local')"
      >
        局部近似
      </button>
      <button
        :class="{ active: view.mode === 'full' }"
        title="每次编辑都重算全世界的完整传播"
        @click="emit('mode', 'full')"
      >
        完整传播
      </button>
    </div>
    <p class="light-note">
      火把只照亮相连空间；实体墙与关闭的门洞阻断光线。玻璃透过约 78%
      天光，树叶仅约 32%，同一位置会比玻璃下更暗。
    </p>
    <p v-if="view.discarded" class="light-note warn">
      已丢弃 {{ view.discarded }} 次过期传播，避免显示已拆除火把的迟到计算。
    </p>
  </section>
</template>
