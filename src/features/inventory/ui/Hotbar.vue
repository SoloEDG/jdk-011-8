<script setup lang="ts">
import { materials } from "../../../shared/materials";
import type { Workspace, MaterialId } from "../../../shared/document";
defineProps<{ state: Workspace }>();
defineEmits<{ choose: [MaterialId] }>();
</script>
<template>
  <div class="hotbar">
    <button
      v-for="(m, i) in materials"
      :class="{ active: state.material === m.id }"
      :title="m.name"
      @click="$emit('choose', m.id)"
    >
      <sup>{{ i + 1 }}</sup
      ><i class="cube" :style="{ '--cube': m.color }"></i
      ><small>{{ state.doc.inventory[m.id] }}</small>
    </button>
  </div>
</template>
