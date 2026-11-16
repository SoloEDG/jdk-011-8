<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import type { Workspace } from "../../../shared/document";
import type { SceneHit } from "../../../shared/commands";
import { mountScene } from "../lib/scene";
import { lightingFor } from "../../lighting";
const props = defineProps<{ state: Workspace }>();
const emit = defineEmits<{ hit: [SceneHit] }>();
const host = ref<HTMLElement>();
let scene: ReturnType<typeof mountScene>;
let frame = 0;
onMounted(() => {
  const light = lightingFor(props.state);
  scene = mountScene(
    host.value!,
    props.state,
    light,
    (h) => emit("hit", h),
    (time) => {
      props.state.doc.time = time;
    },
  );
  // The light scheduler is stepped here, not inside the scene, so a solve is
  // bounded per frame even if the tab is rendering at a different rate.
  const tick = () => {
    light.tick(props.state.doc);
    frame = requestAnimationFrame(tick);
  };
  tick();
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  scene?.dispose();
});
defineExpose({ reset: () => scene?.reset() });
</script>
<template>
  <div ref="host" class="world-canvas" aria-label="三维方块世界"></div>
</template>
