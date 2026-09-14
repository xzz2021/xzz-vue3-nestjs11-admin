<script setup lang="ts">
import DOMPurify from 'dompurify'
import { computed } from 'vue'

interface Props {
  content?: string
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  emptyText: '-'
})

const safeContent = computed(() =>
  DOMPurify.sanitize(props.content, {
    USE_PROFILES: { html: true }
  })
)
</script>

<template>
  <div v-if="safeContent" class="rich-text-preview" v-html="safeContent"></div>
  <div v-else class="text-[var(--el-text-color-secondary)]">{{ emptyText }}</div>
</template>

<style scoped>
.rich-text-preview {
  line-height: 1.7;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.rich-text-preview :deep(p) {
  margin: 0 0 0.75em;
}

.rich-text-preview :deep(p:last-child) {
  margin-bottom: 0;
}

.rich-text-preview :deep(img),
.rich-text-preview :deep(video) {
  height: auto;
  max-width: 100%;
}

.rich-text-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.rich-text-preview :deep(th),
.rich-text-preview :deep(td) {
  padding: 6px 10px;
  border: 1px solid var(--el-border-color);
}

.rich-text-preview :deep(blockquote) {
  padding-left: 1em;
  margin: 0.75em 0;
  color: var(--el-text-color-secondary);
  border-left: 3px solid var(--el-border-color);
}
</style>
