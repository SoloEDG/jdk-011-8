<script setup lang="ts">
import { ref, computed } from "vue";
import { Search } from "lucide-vue-next";
import type { Workspace, MaterialId } from "../../../shared/document";
import { stockRows, stockTotal } from "../lib/stock";
defineEmits<{ choose: [MaterialId] }>();
const props = defineProps<{ state: Workspace }>();
const query = ref("");
const rows = computed(() => stockRows(props.state, query.value));
</script>
<template>
  <section class="panel inventory">
    <div class="section-title">
      <h2>方块物品栏</h2>
      <span>{{ stockTotal(state) }} 可用</span>
    </div>
    <label class="search"
      ><Search :size="15" /><input v-model="query" placeholder="搜索方块材质…"
    /></label>
    <div class="material-grid">
      <button
        v-for="m in rows"
        :key="m.id"
        :class="['material-card', { active: m.active }]"
        @click="$emit('choose', m.id)"
      >
        <i class="cube" :style="{ '--cube': m.color }"></i><b>{{ m.name }}</b
        ><small>{{ m.count }}</small>
      </button>
    </div>
    <p class="muted small">选择材质，然后点击方块表面建造</p>
  </section>
</template>
