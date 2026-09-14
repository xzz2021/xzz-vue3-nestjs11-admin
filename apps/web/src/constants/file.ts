export interface FileTypeListItem {
  name: string
  value: number
  icon: string
}

/** 文件分类（icon 为 lucide 短名） */
export const FileTypeList: FileTypeListItem[] = [
  { name: '全部', value: 0, icon: 'folder' },
  { name: '图片', value: 2, icon: 'image' },
  { name: '文档', value: 3, icon: 'file-text' },
  { name: '视频', value: 4, icon: 'video' },
  { name: '音频', value: 5, icon: 'headphones' },
  { name: '其他', value: 1, icon: 'files' }
]

export interface FileExtendNameIconMap {
  [key: string]: string
}

/** 文件类型图标 Map 映射（lucide 短名） */
export const FileIcon: FileExtendNameIconMap = {
  mp3: 'headphones',
  mp4: 'video',
  dir: 'folder',
  ppt: 'file-text',
  doc: 'file-text',
  docx: 'file-text',
  xls: 'file-text',
  xlsx: 'file-text',
  txt: 'file-text',
  rar: 'folder-open',
  zip: 'folder-open',
  html: 'file-text',
  css: 'file-text',
  js: 'file-text',
  jpg: 'image',
  png: 'image',
  gif: 'image',
  jpeg: 'image',
  other: 'files'
}

/** 图片类型 */
export const ImageTypes = ['jpg', 'png', 'gif', 'jpeg', 'webp']

/** WPS、Office文件类型 */
export const OfficeTypes = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'pdf']

export const WordTypes = ['doc', 'docx']

export const ExcelTypes = ['xls', 'xlsx']

export const VideoTypes = ['mp4', 'avi']

export const DocTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'md']

export const AudioTypes = ['mp3', 'wav', 'wma', 'ogg', 'flac', 'aac', 'm4a', 'm3u8']

export const ZipTypes = ['zip', 'rar', '7z', 'tar', 'gz', 'gzip']
