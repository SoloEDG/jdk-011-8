<script setup lang="ts">
import { computed } from "vue";
import { Sun, Moon, Play, Pause } from "lucide-vue-next";
import type { Workspace } from "../../../shared/document";
import { formatClock, phaseLabel, sunStateAt } from "../index";

const props = defineProps<{ state: Workspace }>();
const emit = defineEmits<{ time: [number]; toggle: [] }>();

const label = computed(() => formatClock(props.state.doc.time));
const phase = computed(() => phaseLabel(props.state.doc.time));
const night = computed(() => sunStateAt(props.state.doc.time).daylight < 0.12);
const altitude = computed(() => {
  const s = sunStateAt(props.state.doc.time);
  return Math.max(0, Math.min(1, s.y));
});

function scrub(e: Event) {
  emit("time", Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="time-scrubber">
    <button
      class="time-icon"
      :title="state.clockPlaying ? '暂停时间 T' : '让时间流动 T'"
      @click="$emit('toggle')"
    >
      <Play v-if="!state.clockPlaying" :size="14" />
      <Pause v-else :size="14" />
    </button>
    <span class="time-read"><b>{{ label }}</b><small>{{ phase }}</small></span>
    <div class="time-track">
      <input
        type="range"
        min="0"
        max="23.99"
        step="0.05"
        :value="state.doc.time"
        aria-label="一天中的时刻"
        @input="scrub"
      />
      <span class="time-arc" :style="{ opacity: 0.35 + altitude * 0.65 }"></span>
    </div>
    <Sun v-if="!night" :size="16" class="time-sun" />
    <Moon v-else :size="16" class="time-moon" />
  </div>
</template>
