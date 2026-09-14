<script setup lang="ts">
import { useDesign } from '@/hooks/web/useDesign'
import { useI18n } from '@/hooks/web/useI18n'
import { useLockStore } from '@/store/modules/lock'
import { useUserStore } from '@/store/modules/user'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import LockDialog from './components/LockDialog.vue'
import LockPage from './components/LockPage.vue'

const { push } = useRouter()

const userStore = useUserStore()

const { userInfo } = storeToRefs(userStore)

const avatarUrl = computed(() => userStore.getUserAvatarUrl)

const lockStore = useLockStore()

const getIsLock = computed(() => lockStore.getLockInfo?.isLock ?? false)

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('user-info')

const { t } = useI18n()

const loginOut = () => {
  userStore.logoutConfirm()
}

const dialogVisible = ref<boolean>(false)

// 锁定屏幕
const lockScreen = () => {
  dialogVisible.value = true
}

const toPage = (path: string) => {
  push(path)
}

// onMounted(() => {
//   sseStore.initServerMsgListener()
// })
</script>

<template>
  <ElDropdown class="custom-hover" :class="prefixCls" trigger="click">
    <div class="flex items-center">
      <img :src="avatarUrl" alt="" class="w-[calc(var(--logo-height)-25px)] rounded-[50%]" />
      <span class="<lg:hidden text-14px pl-[5px] text-[var(--top-header-text-color)]">{{ userInfo?.username }}</span>
    </div>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem @click="toPage('/personal/information')">
          <div>
            {{ t('router.personalCenter') }}
          </div>
        </ElDropdownItem>
        <ElDropdownItem divided @click="lockScreen">
          <div>{{ t('lock.lockScreen') }}</div>
        </ElDropdownItem>
        <ElDropdownItem @click="loginOut">
          <div>{{ t('common.loginOut') }}</div>
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>

  <LockDialog v-if="dialogVisible" v-model="dialogVisible" />
  <teleport to="body">
    <transition name="fade-bottom" mode="out-in">
      <LockPage v-if="getIsLock" />
    </transition>
  </teleport>
</template>

<style scoped lang="less">
.fade-bottom-enter-active,
.fade-bottom-leave-active {
  transition:
    opacity 0.25s,
    transform 0.3s;
}

.fade-bottom-enter-from {
  opacity: 0;
  transform: translateY(-10%);
}

.fade-bottom-leave-to {
  opacity: 0;
  transform: translateY(10%);
}
</style>
