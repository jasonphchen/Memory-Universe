import { useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import type { MemoryNode } from './memory.types'
import type { UniverseTheme } from './universeThemes'

const starImages = import.meta.glob('../assets/stars/*.{png,jpg,jpeg,webp}', { eager: true, as: 'url' })
const starImageUrls = Object.values(starImages) as string[]

type UniverseSceneProps = {
  memories: MemoryNode[]
  onSelectMemory: (memoryId: string) => void
  theme: UniverseTheme
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
): { x: number; y: number; z: number } {
  if (theme.memoryLayout === 'spiral') {
    const arm = index % 3
    const progress = (index + 0.7) / total
    const armOffset = (arm / 3) * Math.PI * 2
    const angle = progress * Math.PI * 8.5 + armOffset + Math.random() * 0.4
    const radius = 3 + progress * 10 + Math.random() * 0.9
    return {
      x: Math.cos(angle) * radius,
      y: (Math.random() - 0.5) * 2.4,
      z: Math.sin(angle) * radius,
    }
  }

  if (theme.memoryLayout === 'helix') {
    const progress = index / total
    const turns = 4
    const angle = progress * Math.PI * 2 * turns + Math.random() * 0.22
    const radius = 6 + Math.sin(progress * Math.PI * 4) * 1.6 + Math.random() * 0.5
    return {
      x: Math.cos(angle) * radius,
      y: (progress - 0.5) * 9.2,
      z: Math.sin(angle) * radius,
    }
  }

  const orbitRadius = 6 + Math.random() * 7.5
  const angle = (index / total) * Math.PI * 2 + Math.random() * 0.34
  return {
    x: Math.cos(angle) * orbitRadius,
    y: (Math.random() - 0.5) * 4.6,
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

export function UniverseScene({ memories, onSelectMemory, theme }: UniverseSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  
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

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(theme.sceneBackground)
    scene.fog = new THREE.FogExp2(theme.fogColor, theme.fogDensity)

    const camera = new THREE.PerspectiveCamera(
      68,
      mountElement.clientWidth / mountElement.clientHeight,
      0.1,
      100,
    )
    camera.position.set(0, 2, 19)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mountElement.clientWidth, mountElement.clientHeight)
    renderer.domElement.style.cursor = 'grab'
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
    const memorySize = theme.useImageTextures ? 0.92 : 0.37
    memories.forEach((memory, index) => {
      const geometry = createMemoryGeometry(theme, memorySize)
      
      let material: THREE.MeshStandardMaterial
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
      }
      
      const star = new THREE.Mesh(geometry, material)
      if (theme.memoryShape === 'fivePointStar') {
        star.rotation.z = Math.random() * Math.PI * 2
      }
      const position = getMemoryPosition(theme, index, memories.length)
      star.position.set(position.x, position.y, position.z)
      star.userData = {
        memoryId: memory.id,
        baseScale: 1,
        pulseOffset: index * 0.5,
      }
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

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' && (event as any).touches?.length > 1) {
        return
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
      if (!isPointerDown) return
      
      if (event.pointerType === 'touch' && (event as any).touches?.length > 1) {
        return
      }

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

      const rotateY = deltaX * 0.006 * touchSensitivity
      const rotateX = deltaY * 0.0038 * touchSensitivity
      userRotationY += rotateY
      userRotationX = clamp(userRotationX + rotateX, -0.95, 0.95)
      inertiaY = rotateY * 0.5
      inertiaX = rotateX * 0.5
      
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
      
      if (event.pointerType === 'touch') {
        event.preventDefault()
      }
      
      if (dragging) return

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
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const deltaY = event.deltaY
      const deltaX = event.deltaX
      
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
      if (e.touches.length === 1) {
        e.preventDefault()
      }
    }
    
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault()
      }
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
        inertiaX *= 0.94
        inertiaY *= 0.94
        userRotationX = clamp(userRotationX + inertiaX, -0.95, 0.95)
        userRotationY += inertiaY
      }

      memoryGroup.rotation.y = t * theme.memorySpinSpeed + userRotationY
      memoryGroup.rotation.x =
        Math.sin(t * 0.2) * theme.memoryTiltStrength + userRotationX

      memoryMeshes.forEach((mesh) => {
        const baseScale = mesh.userData.baseScale as number
        const pulseOffset = mesh.userData.pulseOffset as number
        const pulse = Math.sin(t * theme.pulseSpeed + pulseOffset) * theme.pulseAmount
        mesh.scale.setScalar(baseScale + pulse)
        
        if (theme.useImageTextures && theme.memoryShape === 'image') {
          mesh.lookAt(camera.position)
        }
      })

      camera.position.x = Math.sin(t * 0.14) * theme.cameraDriftX
      camera.position.y = 1.3 + Math.sin(t * 0.22) * theme.cameraDriftY
      camera.lookAt(0, 0, 0)

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
      })
      starTextures.forEach((texture: THREE.Texture) => texture.dispose())
      starfieldGeometry.dispose()
      starfieldMaterial.dispose()
      renderer.dispose()
      mountElement.removeChild(renderer.domElement)
    }
  }, [memories, onSelectMemory, theme, starTextures, textureIndices])

  return <div ref={mountRef} className="universe-canvas" />
}
