<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import {
  Box,
  Plus,
  Minus,
  Scan,
  ChevronDown,
  RotateCcw,
  Sun,
  MousePointer2,
  HelpCircle,
  Maximize,
  ArrowUpRight,
  Save,
} from "lucide-vue-next";
import { WorldViewport, summarize } from "../features/world";
import { InventoryPanel, Hotbar } from "../features/inventory";
import { SelectionPanel } from "../features/selection";
import { PlayerPanel, attachPlayer } from "../features/player";
import {
  ArchivePanel,
  save,
  load,
  exportWorld,
  importWorld,
} from "../features/archive";
import { createWorkspace, commandRouter } from "./workspace";
const state = createWorkspace();
const cmd = commandRouter(state);
const stats = computed(() => summarize(state.doc));
const viewport = ref<InstanceType<typeof WorldViewport>>();
const help = ref(false);
let detach: () => void;
onMounted(() => {
  detach = attachPlayer(state);
  window.addEventListener("keydown", cmd.key);
});
onBeforeUnmount(() => {
  detach();
  window.removeEventListener("keydown", cmd.key);
});
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else
    document.documentElement
      .requestFullscreen()
      .catch(() => (state.message = "此浏览器暂不支持全屏"));
}
</script>
<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="./"
        ><span class="brand-mark"><Box :size="24" /></span
        ><strong>方屿<span>BLOCKHAVEN</span></strong></a
      >
      <div class="divider"></div>
      <span class="project-name"
        >{{ state.doc.name }} <ChevronDown :size="14" /></span
      ><span class="local-badge">本地世界</span>
      <div class="top-spacer"></div>
      <span class="version">创造，从一块开始。</span
      ><button class="icon-btn" title="操作帮助" @click="help = !help">
        <HelpCircle :size="19" /></button
      ><button class="primary" @click="save(state)">
        <Save :size="16" />保存世界
      </button>
    </header>
    <main>
      <aside class="left-rail">
        <button class="rail-active" title="建造" @click="cmd.tool('place')">
          <Box /></button
        ><button title="区域" @click="cmd.tool('select')"><Scan /></button
        ><button title="探索" @click="cmd.toggle()"><MousePointer2 /></button>
        <div class="rail-spacer"></div>
        <span class="rail-label">BETA</span>
      </aside>
      <section class="workspace">
        <div class="workspace-heading">
          <div>
            <div class="eyebrow">YOUR LITTLE UNIVERSE</div>
            <h1>一方天地，无限可能<span>✦</span></h1>
            <p>堆叠想象，建造属于你的世界。</p>
          </div>
          <div class="world-meta">
            <span class="status-dot"></span> 世界运行中
            <span class="meta-divider">/</span> 32 × 32 × 20
          </div>
        </div>
        <div class="viewport-wrap">
          <WorldViewport ref="viewport" :state="state" @hit="cmd.hit" />
          <div class="view-top">
            <span class="view-badge"
              ><span class="status-dot"></span
              >{{ state.mode === "walk" ? "角色探索" : "自由建造" }}</span
            ><span class="sun-badge"><Sun :size="16" />晴朗 · 白昼</span>
          </div>
          <div class="tool-palette">
            <button
              :class="{ active: state.tool === 'place' }"
              title="放置 B"
              @click="cmd.tool('place')"
            >
              <Plus :size="19" /><span>放置</span><kbd>B</kbd></button
            ><button
              :class="{ active: state.tool === 'remove' }"
              title="拆除 E"
              @click="cmd.tool('remove')"
            >
              <Minus :size="19" /><span>拆除</span><kbd>E</kbd>
            </button>
            <div></div>
            <button
              :class="{ active: state.tool === 'select' }"
              title="选择 R"
              @click="cmd.tool('select')"
            >
              <Scan :size="19" /><span>选择</span><kbd>R</kbd>
            </button>
          </div>
          <div class="view-actions">
            <button
              class="glass-btn"
              title="重置视角"
              @click="viewport?.reset()"
            >
              <RotateCcw :size="17" /></button
            ><button class="glass-btn" title="全屏" @click="fullscreen">
              <Maximize :size="17" />
            </button>
          </div>
          <div class="compass"><b>N</b><span>╱</span><em>Z</em><i>X</i></div>
          <div class="hotbar-wrap">
            <div class="hotbar-caption">
              你的建造工具箱 <span>1—8 快速切换</span>
            </div>
            <Hotbar :state="state" @choose="cmd.material" />
          </div>
          <div v-if="help" class="help-card">
            <b>随心探索，自由建造</b>
            <p>
              单击放置或拆除 · 拖动旋转视角<br />右键拖动平移 · 滚轮缩放<br />R
              选择两个角点 · Esc 取消选择<br />Tab 切换行走 · WASD 移动 ·
              空格跳跃
            </p>
            <button class="soft" @click="help = false">开始建造</button>
          </div>
        </div>
        <div class="scene-footer">
          <span
            ><MousePointer2 :size="13" /> 单击建造 <i>·</i> 拖动旋转
            <i>·</i> 滚轮缩放</span
          ><span
            >{{ stats.total.toLocaleString() }} 方块 <i>·</i> 高度
            {{ stats.highest }} <i>·</i> {{ stats.materials }} 种材质</span
          >
        </div>
        <div class="tip-banner">
          <span class="tip-icon">✧</span>
          <p><b>每一块，都有可能。</b> 从一座小屋开始，让灵感慢慢生长。</p>
          <button class="text-btn" @click="help = true">
            建造指南 <ArrowUpRight :size="14" />
          </button>
        </div>
      </section>
      <aside class="right-sidebar">
        <InventoryPanel :state="state" @choose="cmd.material" /><SelectionPanel
          :state="state"
          @fill="cmd.region(false)"
          @remove="cmd.region(true)"
          @clear="cmd.clear()"
          @start="cmd.tool('select')"
        /><PlayerPanel :state="state" @toggle="cmd.toggle()" /><ArchivePanel
          :state="state"
          @save="save(state)"
          @load="load(state)"
          @export="exportWorld(state)"
          @import="importWorld(state, $event)"
        />
      </aside>
    </main>
    <footer class="statusbar">
      <span><span class="status-dot"></span>{{ state.message }}</span
      ><span>方屿 Blockhaven <i>·</i> v1.0</span>
    </footer>
  </div>
</template>
