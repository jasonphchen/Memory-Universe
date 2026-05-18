export type Lang = 'en' | 'cn'

export const SUPPORTED_LANGS: Lang[] = ['en', 'cn']

/**
 * Chinese translations act as the source-of-truth shape.
 * Plain strings are static text; functions handle interpolated text.
 */
const cn = {
  // Document
  appTitle: '记忆星球',

  // Language switcher
  languageLabelEn: 'English',
  languageLabelCn: '中文',
  switchLanguage: '切换语言',

  // App
  greeting: (p: { name: string }) => `您好, ${p.name}`,
  login: '登录',
  addMemoryAria: '新增记忆',
  memoryLoadFailed: '记忆加载失败，请稍后重试。',
  deleteFailed: '删除失败，请稍后重试。',

  // ThemeSwitcher
  themeFallback: '主题',
  switchTheme: '切换主题',
  themeNebula: '星星',
  themeSpiral: '银河',
  themeGalaxy: '星河',

  // UniverseScene
  fontSize: '字体大小',
  fontStandard: '标准版',
  fontSenior: '老年版',

  // MemoryPanel
  closeDialog: '关闭弹窗',
  loading: '加载中...',
  stopReading: '停止朗读',
  readContent: '朗读内容',
  viewLargeImage: '查看大图',
  editMemoryAria: '编辑记忆',
  edit: '编辑',
  deleteMemoryAria: '删除记忆',
  delete: '删除',
  imagePreview: '大图预览',
  confirmDeleteMemory: '确定删除这条记忆吗？',
  cancel: '取消',
  deleting: '删除中...',
  confirmDelete: '确认删除',
  audioNotSupported: '您的浏览器不支持音频播放。',

  // Add / Edit memory dialogs
  addMemory: '新增记忆',
  editMemory: '编辑记忆',
  fillTitleContent: '请填写标题和内容。',
  saveFailed: '保存失败，请稍后重试。',
  updateFailed: '更新失败，请稍后重试。',
  enterTextOrImage: '请先输入文字或选择至少一张图片。',
  storyGenerateFailed: '故事生成失败，请稍后重试。',
  imageTextRefineFailed: '图文润色失败，请稍后重试。',
  selectAudioFirst: '请先选择至少一段音频。',
  transcribeFailed: '语音转录失败，请稍后重试。',
  fieldTitle: '标题',
  fieldTime: '时间',
  fieldLocation: '地点',
  fieldContent: '内容',
  fieldPhotos: '图片',
  fieldAudio: '音频',
  fieldMap: '地图',
  voiceInputTitle: '语音输入标题',
  voiceInputLocation: '语音输入地点',
  voiceInputContent: '语音输入内容',
  revertRefine: '恢复润色前文本',
  generatingStory: '故事生成中...',
  storyAi: '故事AI助手',
  refiningImageText: '图文润色中...',
  imageTextAi: '图文AI助手',
  transcribingAudio: '语音转录中...',
  voiceTranscribeAi: '语音转录AI',
  choosePhotos: '选择图片',
  chooseAudio: '选择音频',
  photosSelected: (p: { count: number; max: number }) => `已选择 ${p.count}/${p.max} 张`,
  photosMax: (p: { max: number }) => `最多 ${p.max} 张`,
  photosCurrent: (p: { count: number; max: number }) => `当前 ${p.count}/${p.max} 张`,
  audioSelected: (p: { count: number; max: number }) => `已选择 ${p.count}/${p.max} 段`,
  audioMax: (p: { max: number }) => `最多 ${p.max} 段`,
  audioCurrent: (p: { count: number; max: number }) => `当前 ${p.count}/${p.max} 段`,
  removePhoto: (p: { name: string }) => `删除图片 ${p.name}`,
  removeAudio: (p: { name: string }) => `删除音频 ${p.name}`,
  maxUploadPhotos: (p: { max: number }) => `每次最多上传 ${p.max} 张图片。`,
  maxUploadAudio: (p: { max: number }) => `每次最多上传 ${p.max} 段音频。`,
  maxKeepPhotos: (p: { max: number }) => `每次最多保留 ${p.max} 张图片。`,
  maxKeepAudio: (p: { max: number }) => `每次最多保留 ${p.max} 段音频。`,
  saving: '保存中...',
  save: '保存',
  saveChanges: '保存修改',
  unnamedFile: '未命名文件',
  readExistingPhotoFailed: '读取已有图片失败。',
  readExistingAudioFailed: '读取已有音频失败。',

  // Auth
  authFailed: '认证失败，请稍后重试。',
  enterUsernamePassword: '请输入用户名和密码。',
  enterUsernamePasswordSecret: '请输入用户名、密码和注册码。',
  register: '注册',
  username: '用户名',
  password: '密码',
  registrationCode: '注册码',
  loggingIn: '登录中...',
  registering: '注册中...',

  // AudioTranscribeButton
  noAudioCaptured: '未捕获到音频数据，请重试（录音时间可能过短）。',
  audioEmpty: '音频内容为空，请重试。',
  noSpeechRecognized: '未能识别到语音内容，请重试。',
  speechRecognitionFailed: '语音识别失败，请稍后重试。',
  recordingNotSupported: '当前浏览器不支持录音功能。',
  recordingError: '录音过程中出现错误，请重试。',
  microphoneAccessFailed: '无法访问麦克风，请检查权限设置。',
  stopRecording: '停止录音',
  recognizing: '识别中',
  voiceInput: '语音输入',
}

export type Translations = typeof cn
export type TranslationKey = keyof Translations

const en: Translations = {
  // Document
  appTitle: 'Memory Universe',

  // Language switcher
  languageLabelEn: 'English',
  languageLabelCn: '中文',
  switchLanguage: 'Switch language',

  // App
  greeting: (p) => `Hello, ${p.name}`,
  login: 'Sign in',
  addMemoryAria: 'Add memory',
  memoryLoadFailed: 'Failed to load the memory. Please try again later.',
  deleteFailed: 'Failed to delete. Please try again later.',

  // ThemeSwitcher
  themeFallback: 'Theme',
  switchTheme: 'Switch theme',
  themeNebula: 'Stars',
  themeSpiral: 'Galaxy',
  themeGalaxy: 'Star River',

  // UniverseScene
  fontSize: 'Font size',
  fontStandard: 'Standard',
  fontSenior: 'Large',

  // MemoryPanel
  closeDialog: 'Close dialog',
  loading: 'Loading...',
  stopReading: 'Stop reading',
  readContent: 'Read aloud',
  viewLargeImage: 'View full image',
  editMemoryAria: 'Edit memory',
  edit: 'Edit',
  deleteMemoryAria: 'Delete memory',
  delete: 'Delete',
  imagePreview: 'Image preview',
  confirmDeleteMemory: 'Delete this memory?',
  cancel: 'Cancel',
  deleting: 'Deleting...',
  confirmDelete: 'Confirm delete',
  audioNotSupported: 'Your browser does not support audio playback.',

  // Add / Edit memory dialogs
  addMemory: 'Add Memory',
  editMemory: 'Edit Memory',
  fillTitleContent: 'Please fill in the title and content.',
  saveFailed: 'Failed to save. Please try again later.',
  updateFailed: 'Failed to update. Please try again later.',
  enterTextOrImage: 'Please enter some text or select at least one image first.',
  storyGenerateFailed: 'Failed to generate the story. Please try again later.',
  imageTextRefineFailed: 'Failed to refine the text. Please try again later.',
  selectAudioFirst: 'Please select at least one audio clip first.',
  transcribeFailed: 'Audio transcription failed. Please try again later.',
  fieldTitle: 'Title',
  fieldTime: 'Date',
  fieldLocation: 'Location',
  fieldContent: 'Content',
  fieldPhotos: 'Photos',
  fieldAudio: 'Audio',
  fieldMap: 'Map',
  voiceInputTitle: 'Voice input for title',
  voiceInputLocation: 'Voice input for location',
  voiceInputContent: 'Voice input for content',
  revertRefine: 'Restore text before refinement',
  generatingStory: 'Generating story...',
  storyAi: 'Story AI',
  refiningImageText: 'Refining...',
  imageTextAi: 'Photo + Text AI',
  transcribingAudio: 'Transcribing...',
  voiceTranscribeAi: 'Transcription AI',
  choosePhotos: 'Choose photos',
  chooseAudio: 'Choose audio',
  photosSelected: (p) => `Selected ${p.count}/${p.max}`,
  photosMax: (p) => `Up to ${p.max} photos`,
  photosCurrent: (p) => `Current ${p.count}/${p.max}`,
  audioSelected: (p) => `Selected ${p.count}/${p.max}`,
  audioMax: (p) => `Up to ${p.max} clips`,
  audioCurrent: (p) => `Current ${p.count}/${p.max}`,
  removePhoto: (p) => `Remove photo ${p.name}`,
  removeAudio: (p) => `Remove audio ${p.name}`,
  maxUploadPhotos: (p) => `You can upload up to ${p.max} photos at a time.`,
  maxUploadAudio: (p) => `You can upload up to ${p.max} audio clips at a time.`,
  maxKeepPhotos: (p) => `You can keep up to ${p.max} photos.`,
  maxKeepAudio: (p) => `You can keep up to ${p.max} audio clips.`,
  saving: 'Saving...',
  save: 'Save',
  saveChanges: 'Save changes',
  unnamedFile: 'Unnamed file',
  readExistingPhotoFailed: 'Failed to read an existing photo.',
  readExistingAudioFailed: 'Failed to read an existing audio clip.',

  // Auth
  authFailed: 'Authentication failed. Please try again later.',
  enterUsernamePassword: 'Please enter your username and password.',
  enterUsernamePasswordSecret: 'Please enter your username, password and registration code.',
  register: 'Sign up',
  username: 'Username',
  password: 'Password',
  registrationCode: 'Registration code',
  loggingIn: 'Signing in...',
  registering: 'Signing up...',

  // AudioTranscribeButton
  noAudioCaptured: 'No audio captured. Please try again (the recording may have been too short).',
  audioEmpty: 'The audio is empty. Please try again.',
  noSpeechRecognized: 'No speech was recognized. Please try again.',
  speechRecognitionFailed: 'Speech recognition failed. Please try again later.',
  recordingNotSupported: 'Recording is not supported in this browser.',
  recordingError: 'An error occurred while recording. Please try again.',
  microphoneAccessFailed: 'Could not access the microphone. Please check your permission settings.',
  stopRecording: 'Stop recording',
  recognizing: 'Recognizing',
  voiceInput: 'Voice input',
}

export const translations: Record<Lang, Translations> = { cn, en }

type ParamsFor<K extends TranslationKey> = Translations[K] extends (p: infer P) => string
  ? P
  : undefined

/** Resolve a translation key for a given language. */
export function translate<K extends TranslationKey>(
  lang: Lang,
  key: K,
  params?: ParamsFor<K>,
): string {
  const entry = translations[lang][key]
  if (typeof entry === 'function') {
    return (entry as (p: unknown) => string)(params)
  }
  return entry
}
