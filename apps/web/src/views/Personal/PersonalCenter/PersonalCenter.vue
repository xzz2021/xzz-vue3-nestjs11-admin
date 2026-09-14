<script setup lang="ts">
import { getPersonByIdApi, uploadAvatarApi } from '@/api/user'
import type { PersonalUserDetail } from '@/api/user/types'
import defaultAvatar from '@/assets/imgs/avatar.jpg'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import { useI18n } from '@/hooks/web/useI18n'
import { useUserStore } from '@/store/modules/user'
import { formatToDateTime } from '@/utils/dateUtil'
import { resolveAvatarUrl } from '@/utils/file'
import { ElButton, ElDivider, ElImage, ElMessage, ElTabPane, ElTabs, ElTag } from 'element-plus'
import { computed, ref, unref } from 'vue'
import EditInfo from './components/EditInfo.vue'
import EditPassword from './components/EditPassword.vue'
import UploadAvatar from './components/UploadAvatar.vue'

const { t } = useI18n()
const userStore = useUserStore()

const userInfo = ref<PersonalUserDetail>()
const pageLoading = ref(false)

const avatarSrc = computed(() => resolveAvatarUrl(userInfo.value?.avatar, userStore.avatarVersion) || defaultAvatar)

const roleNames = computed(() => userInfo.value?.roles?.map((item) => item.role?.name).filter(Boolean) ?? [])

const syncUserStore = (info: PersonalUserDetail) => {
  userStore.setUserInfo({
    ...userStore.getUserInfo,
    id: info.id,
    username: info.username,
    phone: info.phone,
    avatar: info.avatar,
    email: info.email,
    nickname: info.nickname
  })
}

const fetchDetailUserApi = async () => {
  pageLoading.value = true
  try {
    const res = await getPersonByIdApi()
    userInfo.value = res.data.userinfo
    if (userInfo.value) {
      syncUserStore(userInfo.value)
    }
  } finally {
    pageLoading.value = false
  }
}

fetchDetailUserApi()

const activeName = ref('first')
const dialogVisible = ref(false)

const uploadAvatarRef = ref<ComponentRef<typeof UploadAvatar>>()
const avatarLoading = ref(false)

const saveAvatar = async () => {
  try {
    avatarLoading.value = true
    const file = await unref(uploadAvatarRef)?.getCroppedFile()
    if (!file) {
      ElMessage.warning(t('personal.selectAvatarFirst'))
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    const res = await uploadAvatarApi(formData)
    const filePath = res.data?.filePath
    if (filePath && userInfo.value) {
      userInfo.value.avatar = filePath
      syncUserStore(userInfo.value)
    }
    userStore.bumpAvatarVersion()

    await fetchDetailUserApi()
    ElMessage.success(t('personal.avatarUpdateSuccess'))
    dialogVisible.value = false
  } catch (error) {
    console.error(error)
  } finally {
    avatarLoading.value = false
  }
}
</script>

<template>
  <div v-loading="pageLoading" class="flex w-100% h-100%">
    <ContentWrap :title="t('personal.personalInfo')" class="w-400px">
      <div class="flex justify-center items-center">
        <div class="avatar w-[150px] h-[150px] relative cursor-pointer" @click="dialogVisible = true">
          <ElImage class="w-[150px] h-[150px] rounded-full" :src="avatarSrc" fit="cover" />
        </div>
      </div>
      <ElDivider />
      <div class="flex justify-between items-center">
        <div>{{ t('personal.username') }}：</div>
        <div>{{ userInfo?.username ?? '-' }}</div>
      </div>
      <ElDivider />
      <div class="flex justify-between items-center">
        <div>{{ t('personal.phone') }}：</div>
        <div>{{ userInfo?.phone ?? '-' }}</div>
      </div>
      <ElDivider />
      <div class="flex justify-between items-center">
        <div>{{ t('personal.department') }}：</div>
        <div>{{ userInfo?.department?.name ?? '-' }}</div>
      </div>
      <ElDivider />
      <div class="flex justify-between items-center">
        <div>{{ t('personal.role') }}：</div>
        <div>
          <template v-if="roleNames.length">
            <ElTag v-for="item in roleNames" :key="item" class="ml-2 mb-2">{{ item }}</ElTag>
          </template>
          <template v-else>-</template>
        </div>
      </div>
      <ElDivider />
      <div class="flex justify-between items-center">
        <div>{{ t('personal.createTime') }}：</div>
        <div>{{ formatToDateTime(userInfo?.createdAt) ?? '-' }}</div>
      </div>
      <ElDivider />
    </ContentWrap>
    <ContentWrap :title="t('personal.basicInfo')" class="flex-[3] ml-20px">
      <ElTabs v-model="activeName">
        <ElTabPane :label="t('personal.basicProfile')" name="first">
          <EditInfo :user-info="userInfo" @success="fetchDetailUserApi" />
        </ElTabPane>
        <ElTabPane :label="t('personal.changePassword')" name="second" lazy>
          <EditPassword />
        </ElTabPane>
      </ElTabs>
    </ContentWrap>
  </div>

  <Dialog v-model="dialogVisible" :title="t('personal.changeAvatar')" width="800px">
    <UploadAvatar ref="uploadAvatarRef" :url="avatarSrc" />

    <template #footer>
      <ElButton type="primary" :loading="avatarLoading" @click="saveAvatar">{{ t('exampleDemo.save') }}</ElButton>
      <ElButton @click="dialogVisible = false">{{ t('common.close') }}</ElButton>
    </template>
  </Dialog>
</template>

<style lang="less" scoped>
.avatar {
  position: relative;

  &::after {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    width: 100%;
    height: 100%;
    font-size: 50px;
    color: #fff;
    background-color: rgb(0 0 0 / 40%);
    border-radius: 50%;
    content: '+';
    opacity: 0;
    justify-content: center;
    align-items: center;
  }

  &:hover {
    &::after {
      opacity: 1;
    }
  }
}
</style>
