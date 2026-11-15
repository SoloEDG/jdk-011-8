<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import type { Workspace } from "../../../shared/document";
import type { SceneHit } from "../../../shared/commands";
import { mountScene } from "../lib/scene";
const props = defineProps<{ state: Workspace }>();
const emit = defineEmits<{ hit: [SceneHit] }>();
const host = ref<HTMLElement>();
let scene: ReturnType<typeof mountScene>;
onMounted(
  () => (scene = mountScene(host.value!, props.state, (h) => emit("hit", h))),
);
onBeforeUnmount(() => scene?.dispose());
defineExpose({ reset: () => scene?.reset() });
</script>
<template>
  <div ref="host" class="world-canvas" aria-label="三维方块世界"></div>
</template>
