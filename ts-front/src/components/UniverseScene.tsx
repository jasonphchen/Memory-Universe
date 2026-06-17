import { useEffect, useRef, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { MemoryNode } from './memory.types'
import type { UniverseTheme, UniverseThemeId } from './universeThemes'
import { useI18n } from '../i18n/I18nContext'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'

type FontMode = 'standard' | 'senior'

const FONT_MODE_STORAGE_KEY = 'memory_universe_font_mode'
const STANDARD_ROOT_FONT_SIZE = 21
const SENIOR_ROOT_FONT_SIZE = 23
const PLANE_SPACING = 2.6
const PLANE_SCATTER_MULTIPLIER = 2.8
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function getPlaneScatterRadius(count: number): number {
  return PLANE_SPACING * Math.sqrt(Math.max(count, 9)) * PLANE_SCATTER_MULTIPLIER
}

const starImages = import.meta.glob('../assets/stars/*.{png,jpg,jpeg,webp}', { eager: true, as: 'url' })
const starImageUrls = Object.values(starImages) as string[]

type UniverseSceneProps = {
  memories: MemoryNode[]
  onSelectMemory: (memoryId: string) => void
  theme: UniverseTheme
  themes: UniverseTheme[]
  selectedThemeId: UniverseThemeId
  onSelectTheme: (themeId: UniverseThemeId) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createFivePointStarGeometry(size: number): THREE.BufferGeometry {
  const outerRadius = size * 1.3
  const innerRadius = size * 0.55
  const shape = new THREE.Shape()

  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + i * (Math.PI / 5)
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) {
      shape.moveTo(x, y)
    } else {
      shape.lineTo(x, y)
    }
  }
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: size * 0.35,
    bevelEnabled: true,
    bevelThickness: size * 0.12,
    bevelSize: size * 0.1,
    bevelSegments: 2,
  })
  geometry.center()
  return geometry
}

function createGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.18)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

function createMemoryGeometry(theme: UniverseTheme, size: number): THREE.BufferGeometry {
  if (theme.memoryShape === 'fivePointStar') {
    return createFivePointStarGeometry(size)
  }
  if (theme.memoryShape === 'octahedron') {
    return new THREE.OctahedronGeometry(size * 1.1, 0)
  }
  if (theme.memoryShape === 'tetrahedron') {
    return new THREE.TetrahedronGeometry(size * 1.2, 0)
  }
    if (theme.memoryShape === 'image') {
      return new THREE.PlaneGeometry(size * 1.5, size * 1.5)
    }
  return new THREE.SphereGeometry(size, 24, 24)
}

function getStarfieldPosition(
  distribution: UniverseTheme['starfieldDistribution'],
): { x: number; y: number; z: number } {
  if (distribution === 'disk') {
    const radius = 8 + Math.pow(Math.random(), 0.72) * 54
    const theta = Math.random() * Math.PI * 2
    return {
      x: radius * Math.cos(theta),
      y: (Math.random() - 0.5) * 8,
      z: radius * Math.sin(theta),
    }
  }

  if (distribution === 'tube') {
    const radius = 18 + Math.random() * 18
    const theta = Math.random() * Math.PI * 2
    return {
      x: radius * Math.cos(theta),
      y: -34 + Math.random() * 68,
      z: radius * Math.sin(theta),
    }
  }

  const radius = 18 + Math.random() * 52
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.sin(phi) * Math.sin(theta),
    z: radius * Math.cos(phi),
  }
}

function getMemoryPosition(
  theme: UniverseTheme,
  index: number,
  total: number,
  spread: number,
): { x: number; y: number; z: number } {
  if (theme.memoryLayout === 'plane') {
    const scatterRadius = getPlaneScatterRadius(total)
    const sectorAngle = (Math.PI * 2) / Math.max(total, 1)
    const baseAngle = index * GOLDEN_ANGLE
    const angle = baseAngle + (Math.random() - 0.5) * sectorAngle * 1.2
    const ringProgress = (index + 0.5) / Math.max(total, 1)
    const radius = scatterRadius * Math.sqrt(ringProgress) * (0.55 + Math.random() * 0.55)
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: (Math.random() - 0.5) * 0.6,
    }
  }

  if (theme.memoryLayout === 'spiral') {
    const arm = index % 3
    const progress = (index + 0.7) / total
    const armOffset = (arm / 3) * Math.PI * 2
    const angle = progress * Math.PI * 8.5 + armOffset + Math.random() * 0.4
    const radius = (3 + progress * 10 + Math.random() * 0.9) * spread
    return {
      x: Math.cos(angle) * radius,
      y: (Math.random() - 0.5) * 2.4 * spread,
      z: Math.sin(angle) * radius,
    }
  }

  if (theme.memoryLayout === 'helix') {
    const progress = index / total
    const turns = 4 + Math.floor(Math.max(0, spread - 1) * 3)
    const angle = progress * Math.PI * 2 * turns + Math.random() * 0.22
    const radius = (6 + Math.sin(progress * Math.PI * 4) * 1.6 + Math.random() * 0.5) * spread
    return {
      x: Math.cos(angle) * radius,
      y: (progress - 0.5) * 9.2 * spread,
      z: Math.sin(angle) * radius,
    }
  }

  const orbitRadius = (6 + Math.random() * 7.5) * spread
  const angle = (index / total) * Math.PI * 2 + Math.random() * 0.34
  return {
    x: Math.cos(angle) * orbitRadius,
    y: (Math.random() - 0.5) * 4.6 * spread,
    z: Math.sin(angle) * orbitRadius,
  }
}

function generateDistributedTextureIndices(
  textureCount: number,
  memoryCount: number,
): number[] {
  if (textureCount === 0) return []
  
  const indices: number[] = []
  const baseCount = Math.floor(memoryCount / textureCount)
  const remainder = memoryCount % textureCount
  
  for (let i = 0; i < textureCount; i++) {
    const count = baseCount + (i < remainder ? 1 : 0)
    for (let j = 0; j < count; j++) {
      indices.push(i)
    }
  }
  
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1]) {
      let swapIndex = -1
      for (let j = i + 1; j < indices.length; j++) {
        if (indices[j] !== indices[i]) {
          swapIndex = j
          break
        }
      }
      if (swapIndex === -1) {
        for (let j = 0; j < i - 1; j++) {
          if (indices[j] !== indices[i]) {
            swapIndex = j
            break
          }
        }
      }
      if (swapIndex !== -1) {
        [indices[i], indices[swapIndex]] = [indices[swapIndex], indices[i]]
      }
    }
  }
  
  return indices
}

export function UniverseScene({
  memories,
  onSelectMemory,
  theme,
  themes,
  selectedThemeId,
  onSelectTheme,
}: UniverseSceneProps) {
  const { t } = useI18n()
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [fontMode, setFontMode] = useState<FontMode>(() => {
    if (typeof window === 'undefined') return 'standard'
    const saved = window.localStorage.getItem(FONT_MODE_STORAGE_KEY)
    return saved === 'senior' ? 'senior' : 'standard'
  })

  useEffect(() => {
    const size = fontMode === 'senior' ? SENIOR_ROOT_FONT_SIZE : STANDARD_ROOT_FONT_SIZE
    const previous = document.documentElement.style.fontSize
    document.documentElement.style.fontSize = `${size}px`
    window.localStorage.setItem(FONT_MODE_STORAGE_KEY, fontMode)
    return () => {
      document.documentElement.style.fontSize = previous
    }
  }, [fontMode])
  
  const starTextures = useMemo(() => {
    if (!theme.useImageTextures || starImageUrls.length === 0) return []
    const loader = new THREE.TextureLoader()
    return starImageUrls.map((imageUrl: string) => {
      const texture = loader.load(imageUrl)
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.flipY = false
      return texture
    })
  }, [theme.useImageTextures])
  
  const textureIndices = useMemo(() => {
    if (!theme.useImageTextures || starTextures.length === 0) return []
    return generateDistributedTextureIndices(starTextures.length, memories.length)
  }, [theme.useImageTextures, starTextures.length, memories.length])

  useEffect(() => {
    const mountElement = mountRef.current
    if (!mountElement) return

    const memoryCount = memories.length
    const isPlane = theme.memoryLayout === 'plane'
    const spreadFactor = isPlane
      ? 1
      : Math.min(2.6, Math.max(1, Math.sqrt(memoryCount / 20)))

    const fovDeg = 68
    const fovRad = (fovDeg * Math.PI) / 180
    const planeScatterRadius = getPlaneScatterRadius(memoryCount)
    const planeCameraZ = 18 + Math.sqrt(Math.max(memoryCount, 9)) * 1.4
    const cameraZ = isPlane ? planeCameraZ : 19 * spreadFactor
    const cameraBaseY = isPlane ? 0 : 1.3 * spreadFactor
    const cameraDriftScale = isPlane ? 0 : spreadFactor

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(theme.sceneBackground)
    scene.fog = new THREE.FogExp2(
      theme.fogColor,
      isPlane ? theme.fogDensity * 0.35 : theme.fogDensity / spreadFactor,
    )

    const cameraFar = isPlane
      ? planeScatterRadius * 4 + 200
      : Math.max(100, cameraZ * 2.5)
    const camera = new THREE.PerspectiveCamera(
      fovDeg,
      mountElement.clientWidth / mountElement.clientHeight,
      0.1,
      cameraFar,
    )
    camera.position.set(0, cameraBaseY, cameraZ)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mountElement.clientWidth, mountElement.clientHeight)
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'none'
    mountElement.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(
      theme.ambientColor,
      theme.ambientIntensity,
    )
    const keyLight = new THREE.PointLight(theme.keyLightColor, theme.keyLightIntensity, 80)
    keyLight.position.set(12, 7, 11)
    const fillLight = new THREE.PointLight(theme.fillLightColor, theme.fillLightIntensity, 70)
    fillLight.position.set(-10, -4, -8)
    scene.add(ambientLight, keyLight, fillLight)

    const starfieldRadius = Math.max(0.018, theme.starfieldSize * 0.42)
    const starfieldGeometry = new THREE.SphereGeometry(starfieldRadius, 8, 8)
    const fieldCount = theme.starfieldCount
    const starfieldMaterial = new THREE.MeshStandardMaterial({
      color: theme.starfieldColor,
      emissive: new THREE.Color(theme.starfieldColor).multiplyScalar(0.55),
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: theme.starfieldOpacity,
      roughness: 0.32,
      metalness: 0.1,
    })
    const starfield = new THREE.InstancedMesh(starfieldGeometry, starfieldMaterial, fieldCount)
    const starDummy = new THREE.Object3D()
    const isSpiralTheme = theme.id === 'spiral'
    for (let i = 0; i < fieldCount; i += 1) {
      const position = getStarfieldPosition(theme.starfieldDistribution)
      const scale = isSpiralTheme ? 0.55 + Math.random() * 0.52 : 0.72 + Math.random() * 1.02
      starDummy.position.set(position.x, position.y, position.z)
      starDummy.scale.setScalar(scale)
      starDummy.updateMatrix()
      starfield.setMatrixAt(i, starDummy.matrix)
    }
    starfield.instanceMatrix.needsUpdate = true
    scene.add(starfield)

    const memoryGroup = new THREE.Group()
    scene.add(memoryGroup)

    const memoryMeshes: THREE.Mesh[] = []
    const sizeShrink = Math.pow(spreadFactor, 0.35)
    const planeSizeBoost = isPlane ? 1.35 : 1
    const memorySize =
      ((theme.useImageTextures ? 1.85 : 0.78) * planeSizeBoost) / sizeShrink
    const glowTexture = createGlowTexture()
    memories.forEach((memory, index) => {
      const geometry = createMemoryGeometry(theme, memorySize)

      let material: THREE.MeshStandardMaterial
      let glowColor: THREE.Color
      if (theme.useImageTextures && starTextures.length > 0 && textureIndices.length > 0) {
        const textureIndex = textureIndices[index % textureIndices.length]
        const selectedTexture = starTextures[textureIndex]
        material = new THREE.MeshStandardMaterial({
          map: selectedTexture,
          emissiveMap: selectedTexture,
          emissive: new THREE.Color(0xffffff).multiplyScalar(0.6),
          emissiveIntensity: 1.8,
          metalness: 0.1,
          roughness: 0.4,
          transparent: true,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
        })
        glowColor = new THREE.Color(0xffe2a8)
      } else {
        const color = new THREE.Color().setHSL(
          theme.hueStart + Math.random() * theme.hueRange,
          theme.saturation,
          theme.lightness,
        )
        material = new THREE.MeshStandardMaterial({
          color,
          emissive: color.clone().multiplyScalar(0.65),
          emissiveIntensity: theme.memoryShape === 'sphere' ? 1.05 : 1.26,
          metalness: 0.2,
          roughness: theme.memoryShape === 'sphere' ? 0.3 : 0.18,
        })
        glowColor = color.clone().lerp(new THREE.Color(0xffffff), 0.35)
      }

      const star = new THREE.Mesh(geometry, material)
      if (theme.memoryShape === 'fivePointStar') {
        star.rotation.z = Math.random() * Math.PI * 2
      }
      const position = getMemoryPosition(theme, index, memories.length, spreadFactor)
      star.position.set(position.x, position.y, position.z)
      star.userData = {
        memoryId: memory.id,
        baseScale: 1,
        pulseOffset: index * 0.5,
      }

      const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: glowColor,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })
      const glow = new THREE.Sprite(glowMaterial)
      glow.scale.setScalar(memorySize * 4)
      glow.renderOrder = -1
      star.add(glow)

      memoryGroup.add(star)
      memoryMeshes.push(star)
    })

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const dragStart = new THREE.Vector2()
    const lastPointer = new THREE.Vector2()
    let dragging = false
    let isPointerDown = false
    let userRotationX = 0
    let userRotationY = 0
    let inertiaX = 0
    let inertiaY = 0
    let userPanX = 0
    let userPanY = 0
    let panInertiaX = 0
    let panInertiaY = 0
    const maxPan = planeScatterRadius * 1.1

    // Zoom is only used by the Stars (plane) scheme. A larger zoom moves the
    // camera closer to the memory plane; the effective distance is cameraZ / zoom.
    const minZoom = 0.4
    const maxZoom = 4
    let userZoom = 1
    const planeCameraDistance = () => cameraZ / userZoom
    const computeWorldPerPixel = () =>
      (2 * planeCameraDistance() * Math.tan(fovRad / 2)) /
      Math.max(1, mountElement.clientHeight)

    // Zoom toward a screen point so the world position under that point stays put.
    const applyZoomAtPoint = (nextZoom: number, clientX: number, clientY: number) => {
      const clampedZoom = clamp(nextZoom, minZoom, maxZoom)
      if (clampedZoom === userZoom) return
      const rect = renderer.domElement.getBoundingClientRect()
      const offsetX = clientX - rect.left - rect.width / 2
      const offsetY = clientY - rect.top - rect.height / 2
      const wppBefore = computeWorldPerPixel()
      const worldX = userPanX + offsetX * wppBefore
      const worldY = cameraBaseY + userPanY - offsetY * wppBefore
      userZoom = clampedZoom
      const wppAfter = computeWorldPerPixel()
      userPanX = clamp(worldX - offsetX * wppAfter, -maxPan, maxPan)
      userPanY = clamp(worldY + offsetY * wppAfter - cameraBaseY, -maxPan, maxPan)
    }

    // Two-finger pinch tracking (touch only).
    const activePointers = new Map<number, { x: number; y: number }>()
    let isPinching = false
    let pinchPrevDistance = 0

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (activePointers.size >= 2) {
          // Second finger down: switch from drag to pinch-zoom.
          isPinching = true
          isPointerDown = false
          dragging = false
          renderer.domElement.style.cursor = 'grab'
          const pts = [...activePointers.values()]
          pinchPrevDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
          event.preventDefault()
          return
        }
      }
      isPointerDown = true
      dragStart.set(event.clientX, event.clientY)
      lastPointer.set(event.clientX, event.clientY)
      dragging = false
      renderer.domElement.style.cursor = 'grabbing'
      renderer.domElement.setPointerCapture(event.pointerId)
      if (event.pointerType === 'touch') {
        event.preventDefault()
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' && activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }

      if (isPinching && activePointers.size >= 2) {
        const pts = [...activePointers.values()]
        const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        if (isPlane && pinchPrevDistance > 0) {
          const midX = (pts[0].x + pts[1].x) / 2
          const midY = (pts[0].y + pts[1].y) / 2
          applyZoomAtPoint(userZoom * (distance / pinchPrevDistance), midX, midY)
        }
        pinchPrevDistance = distance
        event.preventDefault()
        return
      }

      if (!isPointerDown) return

      const deltaX = event.clientX - lastPointer.x
      const deltaY = event.clientY - lastPointer.y
      lastPointer.set(event.clientX, event.clientY)

      const touchSensitivity = event.pointerType === 'touch' ? 1.5 : 1
      const threshold = event.pointerType === 'touch' ? 3 : 4

      if (
        Math.abs(event.clientX - dragStart.x) > threshold ||
        Math.abs(event.clientY - dragStart.y) > threshold
      ) {
        dragging = true
      }

      if (!dragging) return

      if (isPlane) {
        const worldPerPixel = computeWorldPerPixel()
        const panDX = -deltaX * worldPerPixel * touchSensitivity
        const panDY = deltaY * worldPerPixel * touchSensitivity
        userPanX = clamp(userPanX + panDX, -maxPan, maxPan)
        userPanY = clamp(userPanY + panDY, -maxPan, maxPan)
        panInertiaX = panDX * 0.5
        panInertiaY = panDY * 0.5
      } else {
        const rotateY = deltaX * 0.006 * touchSensitivity
        const rotateX = deltaY * 0.0038 * touchSensitivity
        userRotationY += rotateY
        userRotationX = clamp(userRotationX + rotateX, -0.95, 0.95)
        inertiaY = rotateY * 0.5
        inertiaX = rotateX * 0.5
      }
      
      if (event.pointerType === 'touch') {
        event.preventDefault()
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      isPointerDown = false
      renderer.domElement.style.cursor = 'grab'
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId)
      }

      let wasPinching = false
      if (event.pointerType === 'touch') {
        activePointers.delete(event.pointerId)
        if (isPinching) {
          wasPinching = true
          // Stay suppressed until every finger lifts so a leftover finger
          // doesn't snap into a drag or register as a tap.
          if (activePointers.size > 0) {
            event.preventDefault()
            return
          }
          isPinching = false
          pinchPrevDistance = 0
        }
        event.preventDefault()
      }

      if (dragging || wasPinching) return

      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(memoryMeshes, false)
      if (hits.length === 0) return

      const hit = hits[0].object as THREE.Mesh
      const memoryId = hit.userData.memoryId as string | undefined
      if (!memoryId) return
      onSelectMemory(memoryId)
    }

    const onPointerCancel = (event: PointerEvent) => {
      isPointerDown = false
      renderer.domElement.style.cursor = 'grab'
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId)
      }
      if (event.pointerType === 'touch') {
        activePointers.delete(event.pointerId)
        if (activePointers.size < 2) {
          isPinching = false
          pinchPrevDistance = 0
        }
      }
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const deltaY = event.deltaY
      const deltaX = event.deltaX

      if (isPlane) {
        // Wheel (and trackpad pinch, which arrives as a ctrl+wheel) zooms
        // toward the cursor. Scroll up / spread = zoom in.
        const zoomFactor = Math.exp(-deltaY * 0.0015)
        applyZoomAtPoint(userZoom * zoomFactor, event.clientX, event.clientY)
        return
      }

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        const rotateX = deltaY * 0.001
        userRotationX = clamp(userRotationX + rotateX, -0.95, 0.95)
        inertiaX = rotateX * 0.3
      } else if (Math.abs(deltaX) > 0) {
        const rotateY = deltaX * 0.001
        userRotationY += rotateY
        inertiaY = rotateY * 0.3
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      // Prevent native scroll/zoom for both single-finger drag and pinch.
      e.preventDefault()
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
    }
    
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: false })
    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: false })
    renderer.domElement.addEventListener('pointerup', onPointerUp, { passive: false })
    renderer.domElement.addEventListener('pointercancel', onPointerCancel)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false })
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false })
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false })

    const onResize = () => {
      camera.aspect = mountElement.clientWidth / mountElement.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mountElement.clientWidth, mountElement.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()
      const starfieldSpeed =
        theme.starfieldDistribution === 'disk'
          ? 0.024
          : theme.starfieldDistribution === 'tube'
            ? 0.017
            : 0.012
      starfield.rotation.y = t * starfieldSpeed
      starfield.rotation.x = Math.sin(t * 0.08) * 0.05

      if (!isPointerDown) {
        if (isPlane) {
          panInertiaX *= 0.92
          panInertiaY *= 0.92
          userPanX = clamp(userPanX + panInertiaX, -maxPan, maxPan)
          userPanY = clamp(userPanY + panInertiaY, -maxPan, maxPan)
        } else {
          inertiaX *= 0.94
          inertiaY *= 0.94
          userRotationX = clamp(userRotationX + inertiaX, -0.95, 0.95)
          userRotationY += inertiaY
        }
      }

      if (!isPlane) {
        memoryGroup.rotation.y = t * theme.memorySpinSpeed + userRotationY
        memoryGroup.rotation.x =
          Math.sin(t * 0.2) * theme.memoryTiltStrength + userRotationX
      }

      memoryMeshes.forEach((mesh) => {
        const baseScale = mesh.userData.baseScale as number
        const pulseOffset = mesh.userData.pulseOffset as number
        const pulse = Math.sin(t * theme.pulseSpeed + pulseOffset) * theme.pulseAmount
        mesh.scale.setScalar(baseScale + pulse)
        
        if (theme.useImageTextures && theme.memoryShape === 'image') {
          mesh.lookAt(camera.position)
        }
      })

      if (isPlane) {
        camera.position.x = userPanX
        camera.position.y = cameraBaseY + userPanY
        camera.position.z = planeCameraDistance()
        camera.lookAt(userPanX, cameraBaseY + userPanY, 0)
      } else {
        camera.position.x = Math.sin(t * 0.14) * theme.cameraDriftX * cameraDriftScale
        camera.position.y =
          cameraBaseY + Math.sin(t * 0.22) * theme.cameraDriftY * cameraDriftScale
        camera.position.z = cameraZ
        camera.lookAt(0, 0, 0)
      }

      renderer.render(scene, camera)
    }

    renderer.setAnimationLoop(animate)

    return () => {
      renderer.setAnimationLoop(null)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('touchstart', onTouchStart)
      renderer.domElement.removeEventListener('touchmove', onTouchMove)
      renderer.domElement.removeEventListener('touchend', onTouchEnd)

      memoryMeshes.forEach((mesh) => {
        mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (mat.map) mat.map.dispose()
          if (mat.emissiveMap) mat.emissiveMap.dispose()
        }
        mat.dispose()
        mesh.children.forEach((child) => {
          if (child instanceof THREE.Sprite) {
            ;(child.material as THREE.SpriteMaterial).dispose()
          }
        })
      })
      glowTexture.dispose()
      starTextures.forEach((texture: THREE.Texture) => texture.dispose())
      starfieldGeometry.dispose()
      starfieldMaterial.dispose()
      renderer.dispose()
      mountElement.removeChild(renderer.domElement)
    }
  }, [memories, onSelectMemory, theme, starTextures, textureIndices])

  return (
    <>
      <div ref={mountRef} className="universe-canvas" />
      <div className="control-dock">
        <ThemeSwitcher
          themes={themes}
          selectedThemeId={selectedThemeId}
          onSelectTheme={onSelectTheme}
        />
        <button
          type="button"
          className={`control-button${fontMode === 'senior' ? ' is-active' : ''}`}
          aria-label={t('fontSize')}
          aria-pressed={fontMode === 'senior'}
          title={t('fontSize')}
          onClick={() => setFontMode((prev) => (prev === 'senior' ? 'standard' : 'senior'))}
        >
          A
        </button>
        <LanguageSwitcher />
      </div>
    </>
  )
}
