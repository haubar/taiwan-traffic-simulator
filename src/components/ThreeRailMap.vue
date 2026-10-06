<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import sceneConfig from '../data/3dSceneConfig.json' with { type: 'json' }
import SolarIndicator from './SolarIndicator.vue'

const props = defineProps({ lines: Array, trains: Array, selectedTrain: Object, journeyMode: String, daylight: { type: Number, default: 1 }, sunrise: String, sunset: String, simSec: { type: Number, default: 0 } })
const emit = defineEmits(['select'])
const viewport = ref(null)
const stationNamesVisible = ref(false)
let renderer, animationFrame, scene, camera, controls, raycaster
const trainMeshes = new Map()
let stationLabels = []
let hemisphereLight, sunLight, moonLight
let sunSprite, moonSprite
const nightBackground = new THREE.Color('#081321')
const dayBackground = new THREE.Color(sceneConfig.diorama.background)
const frameBackground = new THREE.Color()
let hoveredTrainId = null
let pointerDownPosition = null
let pointerDragged = false
const world = (x, y) => new THREE.Vector3((x - 620) / 55, 0, (y - 260) / 55)
const palette = sceneConfig.diorama

const createRouteRibbon = (points, width, y, color) => {
  const positions = []
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    const dx = end.x - start.x
    const dz = end.z - start.z
    const length = Math.hypot(dx, dz) || 1
    const offsetX = -(dz / length) * width / 2
    const offsetZ = (dx / length) * width / 2
    const leftStart = [start.x + offsetX, y, start.z + offsetZ]
    const rightStart = [start.x - offsetX, y, start.z - offsetZ]
    const leftEnd = [end.x + offsetX, y, end.z + offsetZ]
    const rightEnd = [end.x - offsetX, y, end.z - offsetZ]
    positions.push(...leftStart, ...leftEnd, ...rightStart, ...rightStart, ...leftEnd, ...rightEnd)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }))
}

const createStationLabel = (name, color) => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const context = canvas.getContext('2d')
  context.fillStyle = 'rgba(255,255,255,0.96)'
  context.beginPath()
  context.roundRect(2, 2, 252, 60, 14)
  context.fill()
  context.strokeStyle = color
  context.lineWidth = 8
  context.stroke()
  context.fillStyle = '#21384b'
  context.font = 'bold 32px system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(name, 128, 33)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
  label.scale.set(0.72, 0.18, 1)
  label.renderOrder = 3
  return label
}

const createCelestialSprite = (kind) => {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (kind === 'sun') {
    const glow = context.createRadialGradient(64, 64, 14, 64, 64, 62)
    glow.addColorStop(0, 'rgba(255,244,190,1)')
    glow.addColorStop(0.32, 'rgba(255,215,112,0.94)')
    glow.addColorStop(0.64, 'rgba(255,179,65,0.3)')
    glow.addColorStop(1, 'rgba(255,179,65,0)')
    context.fillStyle = glow
    context.fillRect(0, 0, 128, 128)
    context.beginPath()
    context.arc(64, 64, 25, 0, Math.PI * 2)
    context.fillStyle = '#fff1a8'
    context.fill()
  } else {
    context.beginPath()
    context.arc(64, 64, 39, 0, Math.PI * 2)
    context.fillStyle = '#eef4ff'
    context.fill()
    context.globalCompositeOperation = 'destination-out'
    context.beginPath()
    context.arc(83, 47, 35, 0, Math.PI * 2)
    context.fill()
    context.globalCompositeOperation = 'source-over'
    context.shadowColor = '#c7d9ff'
    context.shadowBlur = 12
    context.strokeStyle = 'rgba(218,230,255,0.85)'
    context.lineWidth = 3
    context.beginPath()
    context.arc(64, 64, 38, -1.08, 1.08)
    context.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }))
  sprite.scale.setScalar(sceneConfig.diorama.celestialSize)
  sprite.renderOrder = 10
  return sprite
}

const updateCelestialBodies = () => {
  if (!sunSprite || !moonSprite) return
  const minute = (((props.simSec % 86400) + 86400) % 86400) / 60
  const rise = (Number(props.sunrise?.slice(0, 2)) || 0) * 60 + (Number(props.sunrise?.slice(3, 5)) || 0)
  const set = (Number(props.sunset?.slice(0, 2)) || 0) * 60 + (Number(props.sunset?.slice(3, 5)) || 0)
  const dayLength = Math.max(1, set - rise)
  const dayProgress = THREE.MathUtils.clamp((minute - rise) / dayLength, 0, 1)
  const nightProgress = THREE.MathUtils.clamp((minute >= set ? minute - set : minute + 1440 - set) / (1440 - dayLength), 0, 1)
  const radius = palette.celestialArcRadiusX
  const sunPosition = new THREE.Vector3(-radius + 2 * radius * dayProgress, palette.celestialBaseHeight + Math.sin(dayProgress * Math.PI) * palette.celestialArcHeight, palette.celestialDepth)
  const moonPosition = new THREE.Vector3(radius - 2 * radius * nightProgress, palette.celestialBaseHeight + Math.sin(nightProgress * Math.PI) * palette.celestialArcHeight, palette.celestialDepth)
  sunSprite.position.copy(sunPosition)
  moonSprite.position.copy(moonPosition)
  sunLight?.position.copy(sunPosition)
  moonLight?.position.copy(moonPosition)
  sunSprite.visible = props.daylight > 0.02
  moonSprite.visible = props.daylight < 0.98
}

const distanceToSegment = (point, start, end) => {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared ? THREE.MathUtils.clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared, 0, 1) : 0
  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz))
}

const addDioramaCity = () => {
  const ground = new THREE.Mesh(new THREE.BoxGeometry(palette.cityWidth, 0.24, palette.cityDepth), new THREE.MeshStandardMaterial({ color: palette.platform, roughness: 0.9 }))
  ground.position.y = -0.34
  ground.receiveShadow = true
  scene.add(ground)

  const surface = new THREE.Mesh(new THREE.PlaneGeometry(palette.cityWidth - 0.12, palette.cityDepth - 0.12), new THREE.MeshStandardMaterial({ color: palette.ground, roughness: 1 }))
  surface.rotation.x = -Math.PI / 2
  surface.position.y = -0.215
  surface.receiveShadow = true
  scene.add(surface)

  const spacing = palette.buildingSpacing
  const roadMaterial = new THREE.MeshStandardMaterial({ color: palette.road, roughness: 1 })
  const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: palette.sidewalk, roughness: 0.94 })
  const markingMaterial = new THREE.MeshBasicMaterial({ color: palette.roadMarking, side: THREE.DoubleSide })
  const columns = Math.floor(palette.cityWidth / spacing)
  const rows = Math.floor(palette.cityDepth / spacing)
  const streetColumns = Array.from({ length: columns }, (_, index) => index).filter((index) => index % palette.streetEvery === 0)
  const streetRows = Array.from({ length: rows }, (_, index) => index).filter((index) => index % palette.streetEvery === 0)
  const streetX = (column) => (column - (columns - 1) / 2) * spacing
  const streetZ = (row) => (row - (rows - 1) / 2) * spacing
  const roadLength = palette.cityWidth - 0.18
  const roadDepth = palette.cityDepth - 0.18
  const roadY = -0.202
  streetColumns.forEach((column) => {
    const x = streetX(column)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(palette.roadWidth, roadDepth), roadMaterial)
    road.rotation.x = -Math.PI / 2
    road.position.set(x, roadY, 0)
    scene.add(road)
    for (const side of [-1, 1]) {
      const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(palette.sidewalkWidth, roadDepth), sidewalkMaterial)
      sidewalk.rotation.x = -Math.PI / 2
      sidewalk.position.set(x + side * (palette.roadWidth + palette.sidewalkWidth) / 2, roadY + 0.002, 0)
      scene.add(sidewalk)
    }
    for (let z = -roadDepth / 2 + 0.32; z < roadDepth / 2; z += 0.64) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(palette.roadMarkingWidth, 0.26), markingMaterial)
      dash.rotation.x = -Math.PI / 2
      dash.position.set(x, roadY + 0.004, z)
      scene.add(dash)
    }
  })
  streetRows.forEach((row) => {
    const z = streetZ(row)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadLength, palette.roadWidth), roadMaterial)
    road.rotation.x = -Math.PI / 2
    road.position.set(0, roadY, z)
    scene.add(road)
    for (const side of [-1, 1]) {
      const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(roadLength, palette.sidewalkWidth), sidewalkMaterial)
      sidewalk.rotation.x = -Math.PI / 2
      sidewalk.position.set(0, roadY + 0.002, z + side * (palette.roadWidth + palette.sidewalkWidth) / 2)
      scene.add(sidewalk)
    }
    for (let x = -roadLength / 2 + 0.32; x < roadLength / 2; x += 0.64) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.26, palette.roadMarkingWidth), markingMaterial)
      dash.rotation.x = -Math.PI / 2
      dash.position.set(x, roadY + 0.004, z)
      scene.add(dash)
    }
  })

  const routeSegments = props.lines.flatMap((line) => line.stations.slice(1).map((station, index) => ({
    start: world(line.stations[index].x, line.stations[index].y),
    end: world(station.x, station.y)
  })))
  const buildingCapacity = columns * rows
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1)
  const profileEntries = [palette.buildingProfiles.lowRise, palette.buildingProfiles.residential, palette.buildingProfiles.office]
  const buildingTypes = profileEntries.map((profile) => {
    const facadeCanvas = document.createElement('canvas')
    facadeCanvas.width = 160
    facadeCanvas.height = 160
    const context = facadeCanvas.getContext('2d')
    context.fillStyle = profile.facade
    context.fillRect(0, 0, 160, 160)
    const floorHeight = 150 / profile.floors
    const bayWidth = 144 / profile.bays
    for (let floor = 0; floor < profile.floors; floor += 1) {
      const y = 5 + floor * floorHeight
      context.fillStyle = floor % 2 ? '#d4dde2' : '#c7d2d9'
      context.fillRect(0, y, 160, 3)
      for (let bay = 0; bay < profile.bays; bay += 1) {
        const x = 8 + bay * bayWidth
        const windowWidth = bayWidth * 0.62
        const windowHeight = floorHeight * (profile.balconies ? 0.5 : 0.66)
        context.fillStyle = profile.window
        context.fillRect(x, y + 5, windowWidth, windowHeight)
        context.fillStyle = '#bdd0da'
        context.fillRect(x + windowWidth * 0.68, y + 5, 2, windowHeight)
        if (profile.balconies) {
          const railY = y + floorHeight - 4
          context.strokeStyle = '#91a4af'
          context.lineWidth = 2
          context.beginPath()
          context.moveTo(x - 1, railY)
          context.lineTo(x + windowWidth + 2, railY)
          context.stroke()
        }
      }
    }
    if (profile === palette.buildingProfiles.lowRise) {
      context.fillStyle = '#526a78'
      context.fillRect(0, 124, 160, 36)
      context.fillStyle = '#9eb9c5'
      for (let bay = 0; bay < profile.bays; bay += 1) context.fillRect(7 + bay * bayWidth, 130, bayWidth * 0.7, 21)
    }
    const texture = new THREE.CanvasTexture(facadeCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    // InstancedMesh applies each building's instanceColor automatically. Enabling
    // vertexColors here also requires a geometry color attribute, which BoxGeometry
    // does not have and can make the facade render black in some Three.js versions.
    const facadeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture, roughness: 0.76 })
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 })
    const materials = [facadeMaterial, facadeMaterial, roofMaterial, roofMaterial, facadeMaterial, facadeMaterial]
    const mesh = new THREE.InstancedMesh(buildingGeometry, materials, buildingCapacity)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  })
  const rooftopEquipment = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xc6d0d8, roughness: 0.88 }), buildingCapacity)
  const podiums = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xaebbc3, roughness: 0.82 }), buildingCapacity)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const buildingIndices = [0, 0, 0]
  let rooftopIndex = 0
  let podiumIndex = 0
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = (column - (columns - 1) / 2) * spacing
      const z = (row - (rows - 1) / 2) * spacing
      if (column % palette.streetEvery === 0 || row % palette.streetEvery === 0) continue
      const noise = Math.abs(Math.sin(column * 127.1 + row * 311.7) * 43758.5453) % 1
      if (noise < 0.15) continue
      if (routeSegments.some(({ start, end }) => distanceToSegment({ x, z }, start, end) < palette.routeClearance)) continue
      const districtSeed = Math.abs(Math.sin(Math.floor(column / palette.streetEvery) * 12.9898 + Math.floor(row / palette.streetEvery) * 78.233) * 43758.5453) % 1
      const typeIndex = districtSeed < 0.28 ? 0 : districtSeed < 0.78 ? 1 : 2
      const profile = profileEntries[typeIndex]
      const width = 0.34 + ((noise * 11.3) % 1) * 0.16
      const depth = 0.34 + ((noise * 17.3) % 1) * 0.16
      const height = 0.22 + ((noise * 29.7) % 1) * (profile.maxHeight - 0.22)
      const hasPodium = typeIndex === 2 || noise > 0.82
      const podiumHeight = hasPodium ? 0.11 : 0
      if (hasPodium) {
        dummy.position.set(x, -0.2 + podiumHeight / 2, z)
        dummy.scale.set(width * 1.2, podiumHeight, depth * 1.2)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        podiums.setMatrixAt(podiumIndex, dummy.matrix)
        podiumIndex += 1
      }
      dummy.position.set(x, -0.2 + podiumHeight + height / 2, z)
      dummy.scale.set(width, height, depth)
      dummy.rotation.set(0, noise > 0.5 ? Math.PI / 2 : 0, 0)
      dummy.updateMatrix()
      buildingTypes[typeIndex].setMatrixAt(buildingIndices[typeIndex], dummy.matrix)
      color.set(palette.buildingColors[Math.floor(noise * palette.buildingColors.length)])
      buildingTypes[typeIndex].setColorAt(buildingIndices[typeIndex], color)
      buildingIndices[typeIndex] += 1
      if (noise > 0.58 || typeIndex === 2) {
        const equipmentWidth = 0.1 + noise * 0.035
        dummy.position.set(x + width * 0.12, -0.2 + podiumHeight + height + 0.045, z)
        dummy.scale.set(equipmentWidth, 0.09, equipmentWidth * 0.8)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        rooftopEquipment.setMatrixAt(rooftopIndex, dummy.matrix)
        rooftopIndex += 1
      }
    }
  }
  buildingTypes.forEach((mesh, index) => {
    mesh.count = buildingIndices[index]
    scene.add(mesh)
  })
  rooftopEquipment.count = rooftopIndex
  rooftopEquipment.castShadow = true
  podiums.count = podiumIndex
  podiums.receiveShadow = true
  scene.add(rooftopEquipment)
  scene.add(podiums)

  const treePositions = [[-9, -3.9], [-7.5, 3.9], [-4.5, -3.9], [-1.5, 3.9], [2, -3.9], [5, 3.9], [8, -3.9], [9.6, 2.8]]
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 0.2, 7), new THREE.MeshStandardMaterial({ color: palette.treeTrunk }), treePositions.length)
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 9, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), treePositions.length)
  treePositions.forEach(([x, z], index) => {
    dummy.position.set(x, -0.08, z)
    dummy.updateMatrix()
    trunks.setMatrixAt(index, dummy.matrix)
    dummy.position.set(x, 0.12, z)
    dummy.scale.set(1, 1.1, 1)
    dummy.updateMatrix()
    crowns.setMatrixAt(index, dummy.matrix)
    color.set(palette.treeColors[index % palette.treeColors.length])
    crowns.setColorAt(index, color)
  })
  trunks.castShadow = true
  crowns.castShadow = true
  scene.add(trunks, crowns)
}

const addMapBase = () => addDioramaCity()

const addRoutes = () => {
  const seenStations = new Set()
  const seenStationNames = new Set()
  const stationLabels = []
  props.lines.forEach((line) => {
    const points = line.stations.map((station) => world(station.x, station.y))
    const routeColor = line.color
    scene.add(createRouteRibbon(points, palette.routeBedWidth, palette.routeSurfaceHeight, palette.routeBed))
    scene.add(createRouteRibbon(points, palette.routeWidth, palette.routeSurfaceHeight + 0.002, routeColor))
    line.stations.forEach((station) => {
      const markerKey = `${station.name}:${Math.round(station.x)}:${Math.round(station.y)}`
      if (seenStations.has(markerKey)) return
      seenStations.add(markerKey)
      const position = world(station.x, station.y)
      const marker = new THREE.Mesh(new THREE.CircleGeometry(0.105, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, toneMapped: false }))
      marker.rotation.x = -Math.PI / 2
      marker.position.set(position.x, palette.routeSurfaceHeight + 0.008, position.z)
      marker.renderOrder = 2
      scene.add(marker)
      const center = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), new THREE.MeshBasicMaterial({ color: routeColor, side: THREE.DoubleSide, toneMapped: false }))
      center.rotation.x = -Math.PI / 2
      center.position.set(position.x, palette.routeSurfaceHeight + 0.01, position.z)
      center.renderOrder = 2
      scene.add(center)
      if (seenStationNames.has(station.name)) return
      seenStationNames.add(station.name)
      const label = createStationLabel(station.name, routeColor)
      label.position.set(position.x, 0.08, position.z + 0.16)
      label.visible = false
      scene.add(label)
      stationLabels.push(label)
    })
  })
  return stationLabels
}

const createTrainMesh = (train) => {
  const routeColor = props.lines.find((line) => line.id === train.lineId)?.color || '#ffffff'
  const trainPalette = sceneConfig.taipeiTrain
  const group = new THREE.Group()
  const shellMaterial = new THREE.MeshStandardMaterial({ color: trainPalette.body, roughness: 0.34, metalness: 0.32 })
  const roofMaterial = new THREE.MeshStandardMaterial({ color: trainPalette.roof, roughness: 0.72, metalness: 0.14 })
  const windowMaterial = new THREE.MeshStandardMaterial({ color: trainPalette.window, roughness: 0.2, metalness: 0.22 })
  const stripeMaterial = new THREE.MeshStandardMaterial({ color: trainPalette.blueStripe, roughness: 0.44, metalness: 0.12 })
  const doorMaterial = new THREE.MeshStandardMaterial({ color: trainPalette.door, roughness: 0.62 })
  const darkMaterial = new THREE.MeshStandardMaterial({ color: trainPalette.undercarriage, roughness: 0.82 })
  const bodyShape = new THREE.Shape()
  bodyShape.moveTo(-0.68, 0.18)
  bodyShape.lineTo(-0.68, 0.49)
  bodyShape.lineTo(0.42, 0.49)
  bodyShape.quadraticCurveTo(0.53, 0.49, 0.61, 0.42)
  bodyShape.lineTo(0.67, 0.37)
  bodyShape.lineTo(0.67, 0.18)
  bodyShape.closePath()
  const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.36, steps: 1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 })
  bodyGeometry.translate(0, 0, -0.18)
  const body = new THREE.Mesh(bodyGeometry, shellMaterial)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.055, 0.012), stripeMaterial)
    stripe.position.set(-0.035, 0.255, side * 0.19)
    group.add(stripe)
    for (const x of [-0.62, -0.28, -0.17, 0.17, 0.28, 0.62]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.115, 0.014), windowMaterial)
      window.position.set(x, 0.39, side * 0.188)
      group.add(window)
    }
    for (const x of [-0.53, -0.37, -0.08, 0.08, 0.37, 0.53]) {
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.205, 0.018), doorMaterial)
      doorFrame.position.set(x, 0.335, side * 0.19)
      group.add(doorFrame)
      const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.105, 0.019), windowMaterial)
      doorGlass.position.set(x, 0.375, side * 0.191)
      group.add(doorGlass)
    }
    for (const x of [-0.225, 0.22]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.29, 0.014), darkMaterial)
      seam.position.set(x, 0.34, side * 0.19)
      group.add(seam)
    }
    const sideDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.016), windowMaterial)
    sideDisplay.position.set(0.51, 0.45, side * 0.19)
    group.add(sideDisplay)
    const routeLamp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.02), new THREE.MeshBasicMaterial({ color: routeColor }))
    routeLamp.position.set(0.51, 0.45, side * 0.201)
    group.add(routeLamp)
    for (const bogie of [-0.55, -0.35, -0.1, 0.1, 0.35, 0.55]) {
      const bogieFrame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 0.3), darkMaterial)
      bogieFrame.position.set(bogie, 0.15, 0)
      group.add(bogieFrame)
      for (const axle of [-0.035, 0.035]) {
        for (const wheelSide of [-1, 1]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.04, 12), darkMaterial)
          wheel.rotation.x = Math.PI / 2
          wheel.position.set(bogie + axle, 0.115, wheelSide * 0.17)
          group.add(wheel)
        }
        const axleDetail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), roofMaterial)
        axleDetail.rotation.x = Math.PI / 2
        axleDetail.position.set(bogie + axle, 0.115, 0)
        group.add(axleDetail)
      }
    }
  }
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.07, 0.39), darkMaterial)
  skirt.position.set(-0.02, 0.18, 0)
  group.add(skirt)
  for (const x of [-0.34, 0, 0.34]) {
    const airConditioner = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.16), roofMaterial)
    airConditioner.position.set(x, 0.535, 0)
    group.add(airConditioner)
    const roofFan = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.11), darkMaterial)
    roofFan.position.set(x, 0.569, 0)
    group.add(roofFan)
  }
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.14, 0.255), windowMaterial)
  windshield.position.set(0.662, 0.325, 0)
  group.add(windshield)
  const frontDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.035, 0.12), new THREE.MeshStandardMaterial({ color: 0x172b3b, emissive: routeColor, emissiveIntensity: 0.18 }))
  frontDisplay.position.set(0.651, 0.455, 0)
  group.add(frontDisplay)
  const frontRouteText = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.055), new THREE.MeshBasicMaterial({ color: routeColor }))
  frontRouteText.position.set(0.663, 0.455, 0)
  group.add(frontRouteText)
  for (const side of [-1, 1]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.038, 0.047), new THREE.MeshBasicMaterial({ color: trainPalette.headlight }))
    headlight.position.set(0.67, 0.22, side * 0.12)
    group.add(headlight)
  }
  const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.09), darkMaterial)
  coupler.position.set(0.7, 0.145, 0)
  group.add(coupler)

  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 256
  labelCanvas.height = 56
  const context = labelCanvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(1, 1, 254, 54)
  context.fillStyle = routeColor
  context.fillRect(1, 1, 7, 54)
  context.fillStyle = '#20384e'
  context.font = 'bold 24px system-ui, sans-serif'
  context.textBaseline = 'middle'
  context.fillText(train.trainId, 18, 28)
  const labelTexture = new THREE.CanvasTexture(labelCanvas)
  labelTexture.colorSpace = THREE.SRGBColorSpace
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }))
  label.scale.set(1.15, 0.25, 1)
  label.position.set(0, 0.88, 0)
  label.visible = false
  group.add(label)
  group.userData.label = label
  return group
}

const syncTrains = () => {
  const activeIds = new Set(props.trains.map((train) => train.trainId || train.id))
  props.trains.forEach((train) => {
    const meshId = train.trainId || train.id
    let mesh = trainMeshes.get(meshId)
    if (!mesh) { mesh = createTrainMesh(train); scene.add(mesh); trainMeshes.set(meshId, mesh) }
    const line = props.lines.find((candidate) => candidate.id === train.lineId)
    const from = line?.stations.find((station) => station.id === train.fromStation)
    const to = line?.stations.find((station) => station.id === train.toStation)
    const progress = THREE.MathUtils.clamp(Number(train.progress) || 0, 0, 1)
    const targetX = from && to ? THREE.MathUtils.lerp(from.x, to.x, progress) : train.x
    const targetY = from && to ? THREE.MathUtils.lerp(from.y, to.y, progress) : train.y
    mesh.userData.target = world(targetX, targetY)
    // Place newly appearing trains directly on their current track position;
    // easing from the scene origin looks like a sudden cross-map jump.
    if (!mesh.userData.positionInitialized) {
      mesh.position.copy(mesh.userData.target)
      mesh.userData.positionInitialized = true
    }
    const fromWorld = from ? world(from.x, from.y) : mesh.userData.target
    const toWorld = to ? world(to.x, to.y) : mesh.userData.target.clone().add(new THREE.Vector3(1, 0, 0))
    mesh.userData.direction = toWorld.sub(fromWorld).normalize()
    // The train model's nose points along local +X. Three.js rotates +X toward
    // negative Z for a positive Y rotation, so invert the track's Z heading.
    mesh.userData.heading = Math.atan2(-mesh.userData.direction.z, mesh.userData.direction.x)
    mesh.userData.train = train
    const isSelected = props.selectedTrain?.trainId === meshId || props.selectedTrain?.id === train.id
    const size = isSelected
      ? palette.selectedTrainScale
      : hoveredTrainId === meshId ? palette.hoverTrainScale : palette.trainScale
    mesh.scale.setScalar(size)
    if (mesh.userData.label) mesh.userData.label.visible = isSelected || hoveredTrainId === meshId
  })
  trainMeshes.forEach((mesh, id) => {
    if (!activeIds.has(id)) {
      scene.remove(mesh)
      mesh.userData.label?.material.map?.dispose()
      mesh.userData.label?.material.dispose()
      trainMeshes.delete(id)
    }
  })
}

const animate = () => {
  animationFrame = requestAnimationFrame(animate)
  const dayAmount = THREE.MathUtils.clamp(props.daylight ?? 1, 0, 1)
  scene.background.lerpColors(nightBackground, dayBackground, dayAmount)
  if (hemisphereLight) hemisphereLight.intensity = 0.38 + palette.hemisphereIntensity * dayAmount
  if (sunLight) sunLight.intensity = palette.sunIntensity * dayAmount
  if (moonLight) moonLight.intensity = 0.35 * (1 - dayAmount)
  updateCelestialBodies()
  trainMeshes.forEach((mesh) => {
    if (!mesh.userData.target) return
    // Simulation time advances every animation frame, so train.x/y already
    // interpolate between stations. Following that sampled position directly
    // keeps motion on the route without accumulating easing lag.
    mesh.position.copy(mesh.userData.target)
    mesh.rotation.y = mesh.userData.heading || 0
    const wheelBottom = (0.115 - 0.046) * mesh.scale.x
    mesh.position.y = palette.routeSurfaceHeight - wheelBottom + Math.sin(performance.now() / 170 + mesh.position.x) * 0.006
  })
  const focus = trainMeshes.get(props.selectedTrain?.trainId || props.selectedTrain?.id) || trainMeshes.get(props.trains[0]?.trainId || props.trains[0]?.id)
  stationLabels.forEach((label) => { label.visible = stationNamesVisible.value })
  if ((props.journeyMode === 'follow' || props.journeyMode === 'cab') && focus) {
    const direction = focus.userData.direction || new THREE.Vector3(1, 0, 0)
    if (props.journeyMode === 'cab') {
      const cabPosition = focus.position.clone().addScaledVector(direction, 0.12).setY(0.58)
      const viewAhead = focus.position.clone().addScaledVector(direction, 3).setY(0.48)
      camera.position.lerp(cabPosition, 0.18)
      controls.target.lerp(viewAhead, 0.18)
      controls.minDistance = 0.2
      controls.maxDistance = 3
    } else {
      const desiredCamera = focus.position.clone().addScaledVector(direction, -2.8).add(new THREE.Vector3(0, 1.55, 0))
      camera.position.lerp(desiredCamera, 0.075)
      controls.target.lerp(new THREE.Vector3(focus.position.x, 0.3, focus.position.z), 0.12)
      controls.minDistance = 1.2
      controls.maxDistance = 8
    }
  } else {
    controls.minDistance = 5
    controls.maxDistance = 32
  }
  controls.update()
  renderer.render(scene, camera)
}

const resize = () => {
  if (!viewport.value || !renderer) return
  camera.aspect = viewport.value.clientWidth / viewport.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight)
}

const pickTrain = (event) => {
  if (pointerDragged) {
    pointerDragged = false
    return
  }
  const bounds = renderer.domElement.getBoundingClientRect()
  const pointer = new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects([...trainMeshes.values()], true)[0]
  if (!hit) return
  let object = hit.object
  while (object && !object.userData.train) object = object.parent
  if (object?.userData.train) emit('select', object.userData.train)
}

const hoverTrain = (event) => {
  if (pointerDownPosition && event.buttons !== 0) {
    const dx = event.clientX - pointerDownPosition.x
    const dy = event.clientY - pointerDownPosition.y
    if (dx * dx + dy * dy > 25) pointerDragged = true
  }
  const bounds = renderer.domElement.getBoundingClientRect()
  const pointer = new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects([...trainMeshes.values()], true)[0]
  let object = hit?.object
  while (object && !object.userData.train) object = object.parent
  const nextId = object?.userData.train ? object.userData.train.trainId || object.userData.train.id : null
  if (nextId === hoveredTrainId) return
  hoveredTrainId = nextId
  renderer.domElement.style.cursor = nextId ? 'pointer' : 'grab'
  syncTrains()
}

const beginPointerInteraction = (event) => {
  pointerDownPosition = { x: event.clientX, y: event.clientY }
  pointerDragged = false
}
const endPointerInteraction = () => { pointerDownPosition = null }

const resetView = () => {
  controls.reset()
  camera.position.set(...palette.cameraPosition)
  controls.target.set(0, 0, 0)
  controls.update()
}

onMounted(() => {
  scene = new THREE.Scene()
  scene.background = frameBackground.copy(nightBackground).lerp(dayBackground, props.daylight ?? 1)
  camera = new THREE.PerspectiveCamera(palette.cameraFov, viewport.value.clientWidth / viewport.value.clientHeight, 0.1, 100)
  camera.position.set(...palette.cameraPosition)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  viewport.value.appendChild(renderer.domElement)
  raycaster = new THREE.Raycaster()
  renderer.domElement.addEventListener('click', pickTrain)
  renderer.domElement.addEventListener('pointermove', hoverTrain)
  renderer.domElement.addEventListener('pointerdown', beginPointerInteraction)
  renderer.domElement.addEventListener('pointerup', endPointerInteraction)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = true
  controls.minDistance = 5
  controls.maxDistance = 32
  controls.maxPolarAngle = Math.PI / 2.05
  controls.target.set(0, 0, 0)
  hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x9badbd, palette.hemisphereIntensity)
  scene.add(hemisphereLight)
  sunLight = new THREE.DirectionalLight(0xffffff, palette.sunIntensity)
  sunLight.position.set(-8, 12, 9)
  sunLight.castShadow = true
  scene.add(sunLight)
  moonLight = new THREE.DirectionalLight(0xb9d5ff, 0)
  moonLight.position.set(8, 8, -9)
  scene.add(moonLight)
  sunSprite = createCelestialSprite('sun')
  moonSprite = createCelestialSprite('moon')
  scene.add(sunSprite, moonSprite)
  addMapBase(); stationLabels = addRoutes(); syncTrains(); animate()
  window.addEventListener('resize', resize)
})
watch(() => props.trains, syncTrains, { deep: true })
watch(() => props.selectedTrain, syncTrains, { deep: true })
onBeforeUnmount(() => { cancelAnimationFrame(animationFrame); window.removeEventListener('resize', resize); renderer?.domElement.removeEventListener('click', pickTrain); renderer?.domElement.removeEventListener('pointermove', hoverTrain); renderer?.domElement.removeEventListener('pointerdown', beginPointerInteraction); renderer?.domElement.removeEventListener('pointerup', endPointerInteraction); controls?.dispose(); trainMeshes.forEach((mesh) => { mesh.userData.label?.material.map?.dispose(); mesh.userData.label?.material.dispose() }); renderer?.dispose(); trainMeshes.clear() })
</script>

<template>
  <div class="three-map-wrap">
    <div class="map-caption">
      <div><strong>{{ journeyMode === 'cab' ? '車內行進視角' : journeyMode === 'follow' ? '列車跟車視角' : '3D 地圖總覽' }}</strong><div class="route-legend"><span v-for="line in lines" :key="line.id"><i :style="{background:line.color}"></i>{{line.id}}</span></div></div>
      <SolarIndicator :daylight="daylight" :sunrise="sunrise" :sunset="sunset" />
      <span><small>{{ journeyMode === 'cab' ? '鏡頭位於列車前端 · 朝行車方向觀察' : journeyMode === 'follow' ? '鏡頭跟隨目前列車行駛 · 可旋轉觀察' : '拖曳平移／旋轉 · 滾輪縮放' }}</small><button class="station-name-toggle" :class="{ active: stationNamesVisible }" type="button" :aria-pressed="stationNamesVisible" @click="stationNamesVisible = !stationNamesVisible">{{ stationNamesVisible ? '隱藏站名' : '顯示站名' }}</button><button class="reset-view" type="button" @click="resetView">重置視角</button></span>
    </div>
    <div ref="viewport" class="three-viewport"></div>
    <div class="map-attribution">地理位置依車站座標投影 · 建築為示意模型 · 列車位置非 LIVE GPS</div>
  </div>
</template>

<style scoped>
.three-map-wrap { overflow: hidden; background: #e2e9f0; border: 1px solid #b8c6d3; border-radius: 18px; }
.map-caption { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; color: #24394b; font-weight: 700; }
.map-caption small { color: #617789; font-weight: 400; }
.route-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 5px; }
.route-legend span { display: inline-flex; align-items: center; gap: 4px; color: #526777; font-size: 10px; }
.route-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 1px #62778955; }
.reset-view { margin-left: 10px; border: 1px solid #aebdca; border-radius: 6px; padding: 4px 8px; color: #334c60; background: #f7fafc; cursor: pointer; }
.station-name-toggle { margin-left: 10px; border: 1px solid #aebdca; border-radius: 6px; padding: 4px 8px; color: #334c60; background: #f7fafc; cursor: pointer; }
.station-name-toggle.active { border-color: #3975aa; background: #e4f2ff; color: #174c7b; }
.three-viewport { height: 520px; cursor: grab; }
.three-viewport:active { cursor: grabbing; }
.map-attribution { padding: 5px 10px 8px; color: #657b8d; font-size: 10px; }
@media (max-width: 700px) { .three-viewport { height: 400px; } .map-caption { align-items: flex-start; } .map-caption > span { text-align: right; } }
</style>
