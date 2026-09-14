<script setup lang="ts">
import { useDesign } from '@/hooks/web/useDesign'
import { ElBacktop } from 'element-plus'

const { getPrefixCls, variables } = useDesign()

const prefixCls = getPrefixCls('backtop')
</script>

<template>
  <!-- bottom 覆写 10px -->
  <ElBacktop
    :class="prefixCls + ' !bottom-[110px]'"
    :target="`.${variables.namespace}-layout-content-scrollbar .${variables.elNamespace}-scrollbar__wrap`"
  />
</template>
