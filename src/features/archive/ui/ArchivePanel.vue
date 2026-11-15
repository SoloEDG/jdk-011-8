<script setup lang="ts">
import { ref } from "vue";
import { Save, FolderOpen, Download, Upload, HardDrive } from "lucide-vue-next";
import type { Workspace } from "../../../shared/document";
defineProps<{ state: Workspace }>();
const emit = defineEmits<{ save: []; load: []; export: []; import: [File] }>();
const input = ref<HTMLInputElement>();
function choose(e: Event) {
  const el = e.target as HTMLInputElement;
  const f = el.files?.[0];
  if (f) emit("import", f);
  el.value = "";
}
</script>
<template>
  <section class="panel archive">
    <div class="section-title">
      <h2>世界存档</h2>
      <HardDrive :size="17" />
    </div>
    <div class="save-state">
      <i class="status-dot"></i
      ><span>{{
        state.dirty
          ? "有未保存的更改"
          : state.savedAt
            ? "已保存 · " + state.savedAt
            : "本地世界，随时开始"
      }}</span>
    </div>
    <div class="row">
      <button class="soft" @click="$emit('save')">
        <Save :size="14" />保存</button
      ><button class="soft" @click="$emit('load')">
        <FolderOpen :size="14" />载入
      </button>
    </div>
    <div class="row">
      <button class="text-btn" @click="$emit('export')">
        <Download :size="14" />导出世界</button
      ><button class="text-btn" @click="input?.click()">
        <Upload :size="14" />导入
      </button>
    </div>
    <input ref="input" type="file" accept=".json" hidden @change="choose" />
  </section>
</template>
