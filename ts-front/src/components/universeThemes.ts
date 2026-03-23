export type UniverseThemeId = 'nebula' | 'spiral' | 'galaxy'

export type UniverseTheme = {
  id: UniverseThemeId
  label: string
  sceneBackground: string
  fogColor: string
  fogDensity: number
  ambientColor: string
  ambientIntensity: number
  keyLightColor: string
  keyLightIntensity: number
  fillLightColor: string
  fillLightIntensity: number
  starfieldColor: string
  starfieldSize: number
  starfieldOpacity: number
  starfieldCount: number
  starfieldDistribution: 'sphere' | 'disk' | 'tube'
  memoryShape: 'sphere' | 'octahedron' | 'tetrahedron' | 'fivePointStar' | 'image'
  memoryLayout: 'orbital' | 'spiral' | 'helix'
  useImageTextures?: boolean
  memorySpinSpeed: number
  memoryTiltStrength: number
  pulseSpeed: number
  pulseAmount: number
  cameraDriftX: number
  cameraDriftY: number
  hueStart: number
  hueRange: number
  saturation: number
  lightness: number
}

export const universeThemes: UniverseTheme[] = [
  {
    id: 'nebula',
    label: '星星',
    sceneBackground: '#02030b',
    fogColor: '#060a1b',
    fogDensity: 0.022,
    ambientColor: '#8ab5ff',
    ambientIntensity: 0.48,
    keyLightColor: '#89beff',
    keyLightIntensity: 1.15,
    fillLightColor: '#9f8dff',
    fillLightIntensity: 0.65,
    starfieldColor: '#a9cbff',
    starfieldSize: 0.065,
    starfieldOpacity: 0.8,
    starfieldCount: 8000,
    starfieldDistribution: 'sphere',
    memoryShape: 'fivePointStar',
    memoryLayout: 'orbital',
    memorySpinSpeed: 0.085,
    memoryTiltStrength: 0.075,
    pulseSpeed: 1.65,
    pulseAmount: 0.12,
    cameraDriftX: 1.2,
    cameraDriftY: 0.45,
    hueStart: 0.56,
    hueRange: 0.12,
    saturation: 0.75,
    lightness: 0.64,
  },
  {
    id: 'spiral',
    label: '银河',
    sceneBackground: '#080308',
    fogColor: '#1d0821',
    fogDensity: 0.028,
    ambientColor: '#ffd4a8',
    ambientIntensity: 0.42,
    keyLightColor: '#ffbe93',
    keyLightIntensity: 1.08,
    fillLightColor: '#ff88d7',
    fillLightIntensity: 0.72,
    starfieldColor: '#ffd9ba',
    starfieldSize: 0.056,
    starfieldOpacity: 0.78,
    starfieldCount: 8000,
    starfieldDistribution: 'disk',
    memoryShape: 'sphere',
    memoryLayout: 'spiral',
    memorySpinSpeed: 0.14,
    memoryTiltStrength: 0.04,
    pulseSpeed: 2.1,
    pulseAmount: 0.18,
    cameraDriftX: 1.7,
    cameraDriftY: 0.3,
    hueStart: 0.01,
    hueRange: 0.14,
    saturation: 0.8,
    lightness: 0.62,
  },
  {
    id: 'galaxy',
    label: '星河',
    sceneBackground: '#080308',
    fogColor: '#1d0821',
    fogDensity: 0.028,
    ambientColor: '#ffd4a8',
    ambientIntensity: 0.42,
    keyLightColor: '#ffbe93',
    keyLightIntensity: 1.08,
    fillLightColor: '#ff88d7',
    fillLightIntensity: 0.72,
    starfieldColor: '#ffd9ba',
    starfieldSize: 0.056,
    starfieldOpacity: 0.78,
    starfieldCount: 8000,
    starfieldDistribution: 'disk',
    memoryShape: 'image',
    memoryLayout: 'spiral',
    memorySpinSpeed: 0.14,
    memoryTiltStrength: 0.04,
    pulseSpeed: 2.1,
    pulseAmount: 0.18,
    cameraDriftX: 1.7,
    cameraDriftY: 0.3,
    hueStart: 0.01,
    hueRange: 0.14,
    saturation: 0.8,
    lightness: 0.62,
    useImageTextures: true,
  },
]
