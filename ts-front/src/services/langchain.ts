const DEFAULT_CHAT_MODEL = 'gpt-5.4-mini'
const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe'
const DEFAULT_AZURE_AUDIO_API_VERSION = '2025-03-01-preview'
const DEFAULT_SYSTEM_PROMPT = '你是一个中文记忆助手，请根据用户输入提供自然、准确、简洁的回复。'
const AUDIO_SUMMARY_SYSTEM_PROMPT =
  '请将音频转录内容总结成约100字的简体中文。只输出总结内容，不要添加说明、标题或项目符号。'
export const REFINED_TEXT_PROMPT =
  '请帮我将文本进行润色，使其更加流畅、自然、符合中文表达习惯。不要添加任何说明或其他内容。'
export const REFINED_TEXT_PHOTO_PROMPT =
  '这是我的图片以及图片相关的文本，请帮我润色一下文本，适当根据图片添加一些细节，使其更加流畅、自然、符合中文表达习惯。如果没有图片，则润色一下文本。只返回内容即可，不用返回标题，时间，地点。不要添加任何说明或其他内容。'
export const STORY_TEXT_PHOTO_PROMPT =
  '这是我的图片以及图片相关的文本，请帮我根据图片和文本写一个适当的故事（100字-150字），适当根据图片添加一些细节，使其更加流畅、自然、符合中文表达习惯。如果没有图片，就根据文本创建故事。只返回内容即可，不用返回标题，时间，地点。不要添加任何说明或其他内容。'

export type OpenAiCredentials = {
  apiKey?: string
  audioApiKey?: string
  audioAPiKey?: string
  apiBaseUrl?: string
  apiAudioUrl?: string
  chatModel?: string
  chatDeployment?: string
  transcriptionModel?: string
  transcriptionDeployment?: string
  audioApiVersion?: string
  APIBaseUrl?: string
  APIAudioUrl?: string
  ApiKey?: string
  AudioApiKey?: string
  AudioAPiKey?: string
  ElevenLabsApiKey?: string
  elevenLabsApiKey?: string
}

export type LangchainChatRequest = {
  message: string
  systemPrompt?: string
}

export type LangchainImageInput = {
  base64: string
  imageType?: string
}

export type LangchainImageRequest = {
  message?: string
  systemPrompt?: string
  images?: LangchainImageInput[]
}

export type LangchainAudioInput = {
  base64: string
  audioType?: string
}

export type LangchainAudioRequest = {
  audios: LangchainAudioInput[]
}

export type LangchainResponse = {
  reply: string
  model: string
}

type NormalizedOpenAiConfig = {
  apiKey: string
  audioApiKey: string
  apiBaseUrl?: string
  apiAudioUrl?: string
  chatModel: string
  transcriptionModel: string
  audioApiVersion?: string
}

type ChatMessage =
  | {
      role: 'system' | 'user'
      content: string
    }
  | {
      role: 'user'
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >
    }

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

type AudioTranscriptionResponse = {
  text?: string
}

type AudioEndpoint = {
  endpoint: string
  usesAzureEndpoint: boolean
}

export function createLangchainService(credentials: OpenAiCredentials) {
  const config = normalizeOpenAiConfig(credentials)

  return {
    chat(request: LangchainChatRequest, signal?: AbortSignal) {
      return getReply(config, request, signal)
    },
    chatWithImages(request: LangchainImageRequest, signal?: AbortSignal) {
      return getReplyWithImages(config, request, signal)
    },
    chatWithAudio(request: LangchainAudioRequest, signal?: AbortSignal) {
      return getReplyWithAudio(config, request, signal)
    },
    transcribeAudio(audio: LangchainAudioInput, signal?: AbortSignal) {
      const audioFile = prepareAudioForTranscription(audio)
      return transcribeAudio(config, audioFile.blob, audioFile.fileName, signal)
    },
  }
}

async function getReply(
  config: NormalizedOpenAiConfig,
  request: LangchainChatRequest,
  signal?: AbortSignal,
): Promise<LangchainResponse> {
  const reply = await createChatCompletion(
    config,
    [
      {
        role: 'system',
        content: request.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: request.message.trim(),
      },
    ],
    signal,
  )

  return {
    reply: reply || '生成回复失败。',
    model: config.chatModel,
  }
}

async function getReplyWithImages(
  config: NormalizedOpenAiConfig,
  request: LangchainImageRequest,
  signal?: AbortSignal,
): Promise<LangchainResponse> {
  const content: Extract<ChatMessage, { role: 'user'; content: unknown[] }>['content'] = []

  if (request.message?.trim()) {
    content.push({ type: 'text', text: request.message.trim() })
  }

  for (const image of request.images ?? []) {
    content.push({
      type: 'image_url',
      image_url: { url: prepareImageForOpenAI(image).dataUrl },
    })
  }

  const reply = await createChatCompletion(
    config,
    [
      {
        role: 'system',
        content: request.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content,
      },
    ],
    signal,
  )

  return {
    reply: reply || '生成回复失败。',
    model: config.chatModel,
  }
}

async function getReplyWithAudio(
  config: NormalizedOpenAiConfig,
  request: LangchainAudioRequest,
  signal?: AbortSignal,
): Promise<LangchainResponse> {
  const transcripts: string[] = []

  for (const audio of request.audios) {
    const audioFile = prepareAudioForTranscription(audio)
    const transcript = await transcribeAudio(config, audioFile.blob, audioFile.fileName, signal)

    if (transcript.trim()) {
      transcripts.push(transcript.trim())
    }
  }

  if (transcripts.length === 0) {
    return {
      reply: '音频转录失败。',
      model: config.transcriptionModel,
    }
  }

  const reply = await summarizeAudioTranscript(config, transcripts.join('\n\n'), signal)

  return {
    reply,
    model: config.chatModel,
  }
}

async function summarizeAudioTranscript(
  config: NormalizedOpenAiConfig,
  transcript: string,
  signal?: AbortSignal,
): Promise<string> {
  const reply = await createChatCompletion(
    config,
    [
      {
        role: 'system',
        content: AUDIO_SUMMARY_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: transcript.trim(),
      },
    ],
    signal,
  )

  return reply || '音频总结失败。'
}

async function createChatCompletion(
  config: NormalizedOpenAiConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const endpoint = new URL('chat/completions', buildOpenAICompatibleEndpoint(config.apiBaseUrl))
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildOpenAiHeaders(config.apiKey, endpoint.hostname, true),
    body: JSON.stringify({
      model: config.chatModel,
      messages,
    }),
    signal,
  })

  const responseBody = (await response.json()) as ChatCompletionResponse & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(getOpenAiErrorMessage(responseBody, '生成回复失败。'))
  }

  return responseBody.choices?.[0]?.message?.content?.trim() ?? ''
}

async function transcribeAudio(
  config: NormalizedOpenAiConfig,
  audioBlob: Blob,
  fileName: string,
  signal?: AbortSignal,
): Promise<string> {
  const audioEndpoint = buildAudioTranscriptionEndpoint(
    config.apiAudioUrl || config.apiBaseUrl,
    config.transcriptionModel,
    config.audioApiVersion,
  )
  const endpoint = new URL(audioEndpoint.endpoint)
  const formData = new FormData()

  if (!audioEndpoint.usesAzureEndpoint) {
    formData.append('model', config.transcriptionModel)
  }

  formData.append('file', audioBlob, fileName)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildOpenAiHeaders(config.audioApiKey, endpoint.hostname),
    body: formData,
    signal,
  })

  const responseBody = (await response.json()) as AudioTranscriptionResponse & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(getOpenAiErrorMessage(responseBody, '音频转写失败。'))
  }

  return responseBody.text ?? ''
}

function normalizeOpenAiConfig(credentials: OpenAiCredentials): NormalizedOpenAiConfig {
  const apiKey = credentials.apiKey?.trim() || credentials.ApiKey?.trim()
  if (!apiKey) {
    throw new Error('尚未配置 OpenAI API 密钥。')
  }

  const audioApiKey =
    credentials.audioApiKey?.trim() ||
    credentials.audioAPiKey?.trim() ||
    credentials.AudioApiKey?.trim() ||
    credentials.AudioAPiKey?.trim() ||
    apiKey

  return {
    apiKey,
    audioApiKey,
    apiBaseUrl: firstNonEmpty(credentials.apiBaseUrl, credentials.APIBaseUrl),
    apiAudioUrl: firstNonEmpty(credentials.apiAudioUrl, credentials.APIAudioUrl),
    chatModel: firstNonEmpty(credentials.chatDeployment, credentials.chatModel) || DEFAULT_CHAT_MODEL,
    transcriptionModel:
      firstNonEmpty(credentials.transcriptionDeployment, credentials.transcriptionModel) ||
      DEFAULT_TRANSCRIPTION_MODEL,
    audioApiVersion: firstNonEmpty(credentials.audioApiVersion),
  }
}

function buildOpenAICompatibleEndpoint(apiBaseUrl?: string): string {
  if (!apiBaseUrl?.trim()) {
    return 'https://api.openai.com/v1/'
  }

  const normalized = apiBaseUrl.trim().replace(/\/+$/, '')
  if (normalized.endsWith('/v1') || normalized.toLowerCase().includes('/openai/v1')) {
    return `${normalized}/`
  }

  const url = new URL(normalized)
  if (url.hostname.toLowerCase().endsWith('.openai.azure.com')) {
    return `${normalized}/openai/v1/`
  }

  return `${normalized}/v1/`
}

function buildAudioTranscriptionEndpoint(
  apiAudioUrl: string | undefined,
  transcriptionDeployment: string,
  azureApiVersion: string | undefined,
): AudioEndpoint {
  if (!apiAudioUrl?.trim()) {
    return {
      endpoint: 'https://api.openai.com/v1/audio/transcriptions',
      usesAzureEndpoint: false,
    }
  }

  const normalized = apiAudioUrl.trim().replace(/\/+$/, '')
  if (normalized.toLowerCase().includes('/audio/transcriptions')) {
    const endpoint = new URL(normalized)
    return {
      endpoint: normalized,
      usesAzureEndpoint: endpoint.hostname.toLowerCase().endsWith('.openai.azure.com'),
    }
  }

  const baseUrl = new URL(`${normalized}/`)
  if (baseUrl.hostname.toLowerCase().endsWith('.openai.azure.com')) {
    const apiVersion = azureApiVersion?.trim() || DEFAULT_AZURE_AUDIO_API_VERSION
    const deployment = encodeURIComponent(transcriptionDeployment)

    return {
      endpoint: new URL(
        `openai/deployments/${deployment}/audio/transcriptions?api-version=${apiVersion}`,
        baseUrl,
      ).toString(),
      usesAzureEndpoint: true,
    }
  }

  return {
    endpoint: new URL('audio/transcriptions', buildOpenAICompatibleEndpoint(apiAudioUrl)).toString(),
    usesAzureEndpoint: false,
  }
}

function buildOpenAiHeaders(apiKey: string, hostname: string, isJson = false): Headers {
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
  })

  if (hostname.toLowerCase().endsWith('.openai.azure.com')) {
    headers.set('api-key', apiKey)
  }

  if (isJson) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

function prepareImageForOpenAI(image: LangchainImageInput): { dataUrl: string } {
  const normalizedType = normalizeImageType(image.imageType, image.base64)

  if (normalizedType === '.heic' || normalizedType === '.heif') {
    throw new Error('前端暂不支持 HEIC/HEIF 图片转换，请先转换成 JPG/PNG。')
  }

  const mimeType = imageMimeTypes[normalizedType]
  if (!mimeType) {
    throw new Error('不支持的图片格式。')
  }

  return {
    dataUrl: `data:${mimeType};base64,${getBase64Payload(image.base64)}`,
  }
}

function prepareAudioForTranscription(audio: LangchainAudioInput): { blob: Blob; fileName: string } {
  const normalizedType = normalizeAudioType(audio.audioType, audio.base64)
  const audioType = audioMimeTypes[normalizedType]

  if (!audioType) {
    throw new Error('不支持的音频格式。')
  }

  return {
    blob: base64ToBlob(audio.base64, audioType.mimeType),
    fileName: audioType.fileName,
  }
}

function normalizeImageType(imageType: string | undefined, base64: string): string {
  const detectedType = imageType?.trim() || getDataUriMediaType(base64, 'image')
  if (!detectedType) {
    throw new Error('图片格式不能为空。')
  }

  return normalizeMediaExtension(detectedType, 'image')
}

function normalizeAudioType(audioType: string | undefined, base64: string): string {
  const detectedType = audioType?.trim() || getDataUriMediaType(base64, 'audio')
  if (!detectedType) {
    throw new Error('音频格式不能为空。')
  }

  return normalizeMediaExtension(detectedType, 'audio')
}

function normalizeMediaExtension(mediaType: string, prefix: 'image' | 'audio'): string {
  let normalized = mediaType.trim().toLowerCase()
  const fullPrefix = `${prefix}/`

  if (normalized.startsWith(fullPrefix)) {
    normalized = normalized.slice(fullPrefix.length)
  }

  return normalized.startsWith('.') ? normalized : `.${normalized}`
}

function getDataUriMediaType(base64: string, prefix: 'image' | 'audio'): string | undefined {
  const trimmed = base64.trim()
  const dataPrefix = `data:${prefix}/`

  if (!trimmed.toLowerCase().startsWith(dataPrefix)) {
    return undefined
  }

  const semicolonIndex = trimmed.indexOf(';')
  return semicolonIndex > dataPrefix.length ? trimmed.slice(dataPrefix.length, semicolonIndex) : undefined
}

function getBase64Payload(base64: string): string {
  const trimmed = base64.trim()
  const commaIndex = trimmed.indexOf(',')
  return commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const payload = getBase64Payload(base64)
  if (!payload.trim()) {
    throw new Error('音频内容不能为空。')
  }

  const binary = window.atob(payload)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()

    if (trimmed) {
      return trimmed
    }
  }

  return undefined
}

function getOpenAiErrorMessage(
  responseBody: ChatCompletionResponse | AudioTranscriptionResponse | { error?: { message?: string } },
  fallback: string,
): string {
  if ('error' in responseBody && responseBody.error?.message) {
    return responseBody.error.message
  }

  return fallback
}

const imageMimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const audioMimeTypes: Record<string, { mimeType: string; fileName: string }> = {
  '.mp3': { mimeType: 'audio/mpeg', fileName: 'audio.mp3' },
  '.mpeg': { mimeType: 'audio/mpeg', fileName: 'audio.mp3' },
  '.mpga': { mimeType: 'audio/mpeg', fileName: 'audio.mp3' },
  '.wav': { mimeType: 'audio/wav', fileName: 'audio.wav' },
  '.m4a': { mimeType: 'audio/mp4', fileName: 'audio.m4a' },
  '.mp4': { mimeType: 'audio/mp4', fileName: 'audio.mp4' },
  '.ogg': { mimeType: 'audio/ogg', fileName: 'audio.ogg' },
  '.webm': { mimeType: 'audio/webm', fileName: 'audio.webm' },
}
