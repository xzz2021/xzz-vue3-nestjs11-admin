import Editor from './src/Editor.vue'
import RichTextPreview from './src/RichTextPreview.vue'
import type { IDomEditor } from '@wangeditor/editor'

export interface EditorExpose {
  getEditorRef: () => Promise<IDomEditor>
}

export { Editor, RichTextPreview }
