<script setup lang="ts">
import { Dialog } from '@/components/Dialog'
import { Form, type FormSchema } from '@/components/Form'
import { useDesign } from '@/hooks/web/useDesign'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { useLockStore } from '@/store/modules/lock'
import { useUserStore } from '@/store/modules/user'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('lock-dialog')
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)
const { required } = useValidator()

const { t } = useI18n()

const lockStore = useLockStore()

const props = defineProps({
  modelValue: {
    type: Boolean,
  },
})
const { formRegister, formMethods } = useForm()

const { getFormData, getElFormExpose, getComponentExpose } = formMethods

const emit = defineEmits(['update:modelValue'])

const avatarUrl = computed(() => userStore.getUserAvatarUrl)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => {
    console.log('set: ', val)
    emit('update:modelValue', val)
  },
})

//  自动聚焦输入框
watch(
  dialogVisible,
  async (val) => {
    if (val) {
      const formExposeInput = await getComponentExpose('password')
      setTimeout(() => {
        formExposeInput?.focus()
      }, 10)
    }
  },
  { immediate: true },
)

const dialogTitle = ref(t('lock.lockScreen'))

const rules = reactive({
  password: [required()],
})

const schema: FormSchema[] = reactive([
  {
    label: t('lock.lockPassword'),
    field: 'password',
    component: 'Input',
    componentProps: {
      type: 'password',
      showPassword: true,
      // 按下enter键触发登录
      onKeydown: (_e: any) => {
        if (_e.key === 'Enter') {
          handleLock()
        }
      },
    },
  },
])

const handleLock = async () => {
  const formExpose = await getElFormExpose()
  formExpose?.validate(async (valid) => {
    if (valid) {
      dialogVisible.value = false
      const formData = await getFormData()
      await lockStore.setLockInfo({
        isLock: true,
        ...formData,
      })
    }
  })
}
</script>

<template>
  <Dialog v-model="dialogVisible" width="500px" max-height="170px" :class="prefixCls" :title="dialogTitle">
    <div class="flex flex-col items-center">
      <img :src="avatarUrl" alt="" class="w-70px h-70px rounded-[50%]" />
      <span class="text-14px my-10px text-[var(--top-header-text-color)]">{{ userInfo?.username }}</span>
    </div>
    <Form :is-col="false" :schema="schema" :rules="rules" @register="formRegister" />
    <template #footer>
      <BaseButton type="primary" @click="handleLock">{{ t('lock.lock') }}</BaseButton>
    </template>
  </Dialog>
</template>

<style lang="less" scoped>
:global(.v-lock-dialog) {
  @media (width <= 767px) {
    max-width: calc(100vw - 16px);
  }
}
</style>
