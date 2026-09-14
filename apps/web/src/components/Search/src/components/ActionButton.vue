<script setup lang="ts">
import { useI18n } from '@/hooks/web/useI18n'
import { useIcon } from '@/hooks/web/useIcon'
import { propTypes } from '@/utils/propTypes'

const emit = defineEmits(['search', 'reset', 'expand'])

const { t } = useI18n()

defineProps({
  showSearch: propTypes.bool.def(true),
  showReset: propTypes.bool.def(true),
  showExpand: propTypes.bool.def(false),
  visible: propTypes.bool.def(true),
  searchLoading: propTypes.bool.def(false),
  resetLoading: propTypes.bool.def(false)
})

const onSearch = () => {
  emit('search')
}

const onReset = () => {
  emit('reset')
}

const onExpand = () => {
  emit('expand')
}
</script>

<template>
  <BaseButton
    v-if="showSearch"
    type="primary"
    :loading="searchLoading"
    :icon="useIcon({ icon: 'search' })"
    @click="onSearch"
  >
    {{ t('common.query') }}
  </BaseButton>
  <BaseButton v-if="showReset" :loading="resetLoading" plain :icon="useIcon({ icon: 'rotate-cw' })" @click="onReset">
    {{ t('common.reset') }}
  </BaseButton>
  <BaseButton v-if="showExpand" :icon="useIcon({ icon: visible ? 'arrow-up' : 'arrow-down' })" text @click="onExpand">
    {{ t(visible ? 'common.shrink' : 'common.expand') }}
  </BaseButton>
</template>
