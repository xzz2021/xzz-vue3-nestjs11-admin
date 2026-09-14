<script setup lang="ts">
import { computed, unref } from 'vue'
import { ElIcon } from 'element-plus'
import { icons as lucideIconSet } from '@iconify-json/lucide'
import { propTypes } from '@/utils/propTypes'
import { useDesign } from '@/hooks/web/useDesign'
import { toLucideIconName } from '@/utils/icon'

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('icon')

const props = defineProps({
  icon: propTypes.string,
  color: propTypes.string,
  size: propTypes.number.def(16),
  hoverColor: propTypes.string
})

const isLocal = computed(() => !!props.icon?.startsWith('svg-icon:'))

const symbolId = computed(() => {
  return unref(isLocal) ? `#icon-${props.icon.split('svg-icon:')[1]}` : ''
})

const lucideSvg = computed(() => {
  const name = toLucideIconName(props.icon)
  if (!name || name.startsWith('svg-icon:')) return null

  const icon = lucideIconSet.icons[name]
  if (!icon) return null

  const width = icon.width ?? lucideIconSet.width ?? 24
  const height = icon.height ?? lucideIconSet.height ?? 24

  return {
    viewBox: `0 0 ${width} ${height}`,
    body: icon.body
  }
})

const iconStyle = computed(() => ({
  fontSize: `${props.size}px`,
  width: `${props.size}px`,
  height: `${props.size}px`,
  color: props.color
}))
</script>

<template>
  <ElIcon :class="prefixCls" :size="size" :color="color">
    <svg v-if="isLocal" aria-hidden="true">
      <use :xlink:href="symbolId" />
    </svg>
    <svg
      v-else-if="lucideSvg"
      class="lucide-icon"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      :viewBox="lucideSvg.viewBox"
      :style="iconStyle"
      v-html="lucideSvg.body"
    />
  </ElIcon>
</template>

<style lang="less" scoped>
@prefix-cls: ~'@{adminNamespace}-icon';

.@{prefix-cls} {
  :deep(svg) {
    &:hover {
      // stylelint-disable-next-line
      color: v-bind(hoverColor) !important;
    }
  }
}

.lucide-icon {
  display: inline-block;
}
</style>
