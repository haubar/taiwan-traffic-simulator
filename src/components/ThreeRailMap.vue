<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import sceneConfig from '../data/3dSceneConfig.json' with { type: 'json' }

const props = defineProps({ lines: Array, trains: Array, selectedTrain: Object, journeyMode: String, visualStyle: String })
const emit = defineEmits(['select'])
const viewport = ref(null)
let renderer, animationFrame, scene, camera, controls, raycaster
const trainMeshes = new Map()
let hoveredTrainId = null
const world = (x, y) => new THREE.Vector3((x - 620) / 55, 0, (y - 260) / 55)
const cute = () => props.visualStyle === 'cute'
const palette = sceneConfig.diorama

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
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, vertexColors: true })
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, buildingCapacity)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let buildingIndex = 0
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = (column - (columns - 1) / 2) * spacing
      const z = (row - (rows - 1) / 2) * spacing
      if (column % palette.streetEvery === 0 || row % palette.streetEvery === 0) continue
      const noise = Math.abs(Math.sin(column * 127.1 + row * 311.7) * 43758.5453) % 1
      if (noise < 0.15) continue
      if (routeSegments.some(({ start, end }) => distanceToSegment({ x, z }, start, end) < palette.routeClearance)) continue
      const width = 0.28 + noise * 0.2
      const depth = 0.28 + ((noise * 17.3) % 1) * 0.2
      const height = 0.22 + ((noise * 29.7) % 1) * 0.9
      dummy.position.set(x, -0.2 + height / 2, z)
      dummy.scale.set(width, height, depth)
      dummy.updateMatrix()
      buildings.setMatrixAt(buildingIndex, dummy.matrix)
      color.set(palette.buildingColors[Math.floor(noise * palette.buildingColors.length)])
      buildings.setColorAt(buildingIndex, color)
      buildingIndex += 1
    }
  }
  buildings.count = buildingIndex
  buildings.castShadow = true
  buildings.receiveShadow = true
  scene.add(buildings)

  const treePositions = [[-9, -3.9], [-7.5, 3.9], [-4.5, -3.9], [-1.5, 3.9], [2, -3.9], [5, 3.9], [8, -3.9], [9.6, 2.8]]
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 0.2, 7), new THREE.MeshStandardMaterial({ color: palette.treeTrunk }), treePositions.length)
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 9, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true }), treePositions.length)
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

const addMapBase = () => {
  if (cute()) {
    addDioramaCity()
    return
  }
  const ground = new THREE.Mesh(new THREE.BoxGeometry(23, 0.25, 11), new THREE.MeshStandardMaterial({ color: cute() ? 0xa7d8c8 : 0x172d43, roughness: cute() ? 0.7 : 0.9 }))
  ground.position.y = -0.35
  scene.add(ground)
  const grid = new THREE.GridHelper(23, 23, 0x4f7791, 0x29485f)
  grid.position.y = -0.2
  grid.material.transparent = true
  grid.material.opacity = cute() ? 0.15 : 0.35
  scene.add(grid)
  const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(23, 11), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: cute() ? 0.16 : 0.72 }))
  mapPlane.rotation.x = -Math.PI / 2
  mapPlane.position.y = -0.17
  scene.add(mapPlane)
  new THREE.TextureLoader().load('https://tile.openstreetmap.org/8/171/112.png', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    mapPlane.material.map = texture
    mapPlane.material.needsUpdate = true
  }, undefined, () => { mapPlane.material.opacity = 0 })
  for (let i = 0; i < 18; i += 1) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.7 + (i % 4) * 0.35, 0.3 + (i % 4) * 0.18, 0.45 + (i % 3) * 0.25), new THREE.MeshStandardMaterial({ color: cute() ? (i % 2 ? 0xffc9a9 : 0xffe3a6) : (i % 2 ? 0x274761 : 0x315975), roughness: cute() ? 0.55 : 0.85 }))
    block.position.set(-10 + (i * 3.1) % 20, block.geometry.parameters.height / 2 - 0.2, -4.3 + (i * 1.7) % 8)
    scene.add(block)
    if (cute() && i % 2 === 0) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.24, 8), new THREE.MeshStandardMaterial({ color: 0x9a6844 }))
      trunk.position.set(block.position.x + 0.5, 0.06, block.position.z)
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: i % 4 ? 0x70c783 : 0x82bdf2 }))
      crown.position.set(trunk.position.x, 0.28, trunk.position.z)
      scene.add(trunk, crown)
    }
  }
}

const addRoutes = () => {
  props.lines.forEach((line) => {
    const points = line.stations.map((station) => world(station.x, station.y).setY(0.08))
    const routeColor = cute() ? new THREE.Color(line.color).lerp(new THREE.Color(0xffffff), 0.28) : line.color
    if (cute()) {
      const route = new THREE.CurvePath()
      points.slice(1).forEach((point, index) => route.add(new THREE.LineCurve3(points[index], point)))
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(route, points.length * 2, 0.09, 7, false), new THREE.MeshStandardMaterial({ color: palette.routeBed, roughness: 0.8 })))
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(route, points.length * 2, 0.038, 6, false), new THREE.MeshStandardMaterial({ color: routeColor, roughness: 0.65, emissive: routeColor, emissiveIntensity: 0.06 })))
    } else {
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: routeColor })))
    }
    line.stations.forEach((station) => {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(cute() ? 0.11 : 0.1, cute() ? 0.11 : 0.1, cute() ? 0.09 : 0.18, 12), new THREE.MeshStandardMaterial({ color: cute() ? palette.station : routeColor, emissive: routeColor, emissiveIntensity: cute() ? 0.04 : 0.25 }))
      const position = world(station.x, station.y)
      marker.position.set(position.x, cute() ? 0.14 : 0.2, position.z)
      scene.add(marker)
      const stationBuilding = new THREE.Mesh(new THREE.BoxGeometry(cute() ? 0.28 : 0.34, cute() ? 0.12 : 0.22, cute() ? 0.28 : 0.34), new THREE.MeshStandardMaterial({ color: cute() ? 0xffffff : 0xe5edf4, roughness: cute() ? 0.72 : 0.7 }))
      stationBuilding.position.set(position.x, cute() ? 0.23 : 0.12, position.z)
      stationBuilding.castShadow = true
      scene.add(stationBuilding)
    })
  })
}

const createTrainMesh = (train) => {
  const color = props.lines.find((line) => line.id === train.lineId)?.color || '#ffffff'
  const group = new THREE.Group()
  if (cute()) {
    const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xfafcff, roughness: 0.42, metalness: 0.05 })
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xe4edf5, roughness: 0.72 })
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x31536e, roughness: 0.24, metalness: 0.15 })
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0xd5e0e9, roughness: 0.56 })
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x283947, roughness: 0.82 })
    const stripeMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
    const carGeometry = new RoundedBoxGeometry(0.3, 0.3, 0.34, 3, 0.035)
    const roofGeometry = new RoundedBoxGeometry(0.26, 0.045, 0.29, 2, 0.018)
    const carCenters = [-0.31, 0, 0.31]
    carCenters.forEach((center) => {
      const car = new THREE.Mesh(carGeometry, shellMaterial)
      car.position.set(center, 0.31, 0)
      car.castShadow = true
      car.receiveShadow = true
      group.add(car)
      const roof = new THREE.Mesh(roofGeometry, roofMaterial)
      roof.position.set(center, 0.475, 0)
      group.add(roof)
      for (const side of [-1, 1]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.055, 0.012), stripeMaterial)
        stripe.position.set(center, 0.215, side * 0.173)
        group.add(stripe)
        for (const offset of [-0.075, 0.075]) {
          const window = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.012), windowMaterial)
          window.position.set(center + offset, 0.365, side * 0.173)
          group.add(window)
        }
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.17, 0.014), doorMaterial)
        door.position.set(center + 0.12, 0.31, side * 0.173)
        group.add(door)
      }
      for (const offset of [-0.1, 0.1]) for (const side of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.036, 10), wheelMaterial)
        wheel.rotation.x = Math.PI / 2
        wheel.position.set(center + offset, 0.16, side * 0.15)
        group.add(wheel)
      }
      const airConditioner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.11), roofMaterial)
      airConditioner.position.set(center, 0.52, 0)
      group.add(airConditioner)
    })
    for (const center of [-0.155, 0.155]) {
      const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.07), wheelMaterial)
      coupler.position.set(center, 0.255, 0)
      group.add(coupler)
    }
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.13, 0.24), windowMaterial)
    windshield.position.set(0.466, 0.365, 0)
    group.add(windshield)
    for (const side of [-1, 1]) {
      const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0xfff3c1 }))
      headlight.position.set(0.466, 0.235, side * 0.105)
      group.add(headlight)
    }
    const labelCanvas = document.createElement('canvas')
    labelCanvas.width = 256
    labelCanvas.height = 56
    const context = labelCanvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(1, 1, 254, 54)
    context.fillStyle = color
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
  const body = new THREE.Mesh(new THREE.BoxGeometry(cute() ? 0.78 : 0.62, cute() ? 0.3 : 0.22, cute() ? 0.34 : 0.2), new THREE.MeshStandardMaterial({ color: cute() ? 0xfafcff : train.trainType === 'EXPRESS' ? 0xe5a83b : color, metalness: cute() ? 0.02 : 0.25, roughness: cute() ? 0.48 : 0.35 }))
  body.position.y = cute() ? 0.33 : 0.28
  body.castShadow = true
  group.add(body)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cute() ? 0.54 : 0.48, cute() ? 0.045 : 0.06, cute() ? 0.3 : 0.17), new THREE.MeshStandardMaterial({ color: cute() ? 0xe7eff7 : 0xe7f4ff }))
  roof.position.y = cute() ? 0.49 : 0.43
  group.add(roof)
  if (cute()) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.07, 0.012), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }))
    stripe.position.set(0, 0.29, 0.176)
    group.add(stripe)
    for (const x of [-0.25, 0.25]) for (const z of [-0.145, 0.145]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 10), new THREE.MeshStandardMaterial({ color: 0x364657, roughness: 0.8 }))
      wheel.rotation.x = Math.PI / 2
      wheel.position.set(x, 0.19, z)
      group.add(wheel)
    }
  }
  for (const x of [-0.2, 0, 0.2]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(cute() ? 0.14 : 0.12, cute() ? 0.09 : 0.07, 0.012), new THREE.MeshBasicMaterial({ color: 0x29465d }))
    window.position.set(x, cute() ? 0.37 : 0.31, cute() ? 0.176 : 0.107)
    group.add(window)
  }
  return group
}

const syncTrains = () => {
  const activeIds = new Set(props.trains.map((train) => train.id))
  props.trains.forEach((train) => {
    let mesh = trainMeshes.get(train.id)
    if (!mesh) { mesh = createTrainMesh(train); scene.add(mesh); trainMeshes.set(train.id, mesh) }
    mesh.userData.target = world(train.x, train.y)
    const line = props.lines.find((candidate) => candidate.id === train.lineId)
    const from = line?.stations.find((station) => station.id === train.fromStation)
    const to = line?.stations.find((station) => station.id === train.toStation)
    const fromWorld = from ? world(from.x, from.y) : mesh.userData.target
    const toWorld = to ? world(to.x, to.y) : mesh.userData.target.clone().add(new THREE.Vector3(1, 0, 0))
    mesh.userData.heading = Math.atan2(toWorld.z - fromWorld.z, toWorld.x - fromWorld.x)
    mesh.userData.train = train
    mesh.scale.setScalar(props.selectedTrain?.id === train.id ? 1.18 : hoveredTrainId === train.id ? 1.1 : 1)
    if (mesh.userData.label) mesh.userData.label.visible = props.selectedTrain?.id === train.id || hoveredTrainId === train.id
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
  trainMeshes.forEach((mesh) => {
    if (!mesh.userData.target) return
    mesh.position.lerp(mesh.userData.target, 0.16)
    mesh.rotation.y = mesh.userData.heading || 0
    mesh.position.y = 0.05 + Math.sin(performance.now() / 170 + mesh.position.x) * 0.015
  })
  const focus = trainMeshes.get(props.selectedTrain?.id) || trainMeshes.get(props.trains[0]?.id)
  if (props.journeyMode && focus) {
    const direction = new THREE.Vector3(Math.cos(focus.userData.heading || 0), 0, Math.sin(focus.userData.heading || 0))
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
  const bounds = renderer.domElement.getBoundingClientRect()
  const pointer = new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects([...trainMeshes.values()], true)[0]
  let object = hit?.object
  while (object && !object.userData.train) object = object.parent
  const nextId = object?.userData.train?.id || null
  if (nextId === hoveredTrainId) return
  hoveredTrainId = nextId
  renderer.domElement.style.cursor = nextId ? 'pointer' : 'grab'
  syncTrains()
}

const resetView = () => {
  controls.reset()
  if (cute()) camera.position.set(...palette.cameraPosition)
  else camera.position.set(0, 13, 15)
  controls.target.set(0, 0, 0)
  controls.update()
}

onMounted(() => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(cute() ? palette.background : 0x0b1929)
  camera = new THREE.PerspectiveCamera(42, viewport.value.clientWidth / viewport.value.clientHeight, 0.1, 100)
  if (cute()) camera.position.set(...palette.cameraPosition)
  else camera.position.set(0, 13, 15)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight)
  if (cute()) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
  }
  renderer.shadowMap.enabled = true
  viewport.value.appendChild(renderer.domElement)
  raycaster = new THREE.Raycaster()
  renderer.domElement.addEventListener('click', pickTrain)
  renderer.domElement.addEventListener('pointermove', hoverTrain)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = true
  controls.minDistance = 5
  controls.maxDistance = 32
  controls.maxPolarAngle = Math.PI / 2.05
  controls.target.set(0, 0, 0)
  scene.add(new THREE.HemisphereLight(cute() ? 0xffffff : 0xb8dcff, cute() ? 0x9badbd : 0x183047, cute() ? palette.hemisphereIntensity : 2.2))
  const sun = new THREE.DirectionalLight(0xffffff, cute() ? palette.sunIntensity : 2.5)
  sun.position.set(cute() ? -8 : -5, 12, cute() ? 9 : 7)
  sun.castShadow = true
  scene.add(sun)
  addMapBase(); addRoutes(); syncTrains(); animate()
  window.addEventListener('resize', resize)
})
watch(() => props.trains, syncTrains, { deep: true })
watch(() => props.selectedTrain, syncTrains, { deep: true })
onBeforeUnmount(() => { cancelAnimationFrame(animationFrame); window.removeEventListener('resize', resize); renderer?.domElement.removeEventListener('click', pickTrain); renderer?.domElement.removeEventListener('pointermove', hoverTrain); controls?.dispose(); trainMeshes.forEach((mesh) => { mesh.userData.label?.material.map?.dispose(); mesh.userData.label?.material.dispose() }); renderer?.dispose(); trainMeshes.clear() })
</script>

<template>
  <div class="three-map-wrap"><div class="map-caption"><span>{{ journeyMode === 'cab' ? '車內行進視角' : journeyMode === 'follow' ? '列車跟車視角' : '3D 地圖總覽' }}</span><span><small>{{ journeyMode === 'cab' ? '鏡頭位於列車前端 · 朝行車方向觀察' : journeyMode === 'follow' ? '鏡頭跟隨目前列車行駛 · 可旋轉觀察' : '拖曳平移／旋轉 · 滾輪縮放' }}</small><button class="reset-view" type="button" @click="resetView">重置視角</button></span></div><div ref="viewport" class="three-viewport"></div><div class="map-attribution">地圖底圖 © OpenStreetMap contributors · 路線／車輛為模擬資料，非 LIVE GPS</div></div>
</template>

<style scoped>
.three-map-wrap { overflow: hidden; background: #0b1929; border: 1px solid #29425e; border-radius: 18px; }
.map-caption { display: flex; justify-content: space-between; padding: 10px 14px; color: #d7e5f5; font-weight: 700; }
.map-caption small { color: #7790ad; font-weight: 400; }
.reset-view { margin-left: 10px; border: 1px solid #3a5774; border-radius: 6px; padding: 4px 8px; color: #d9e8f6; background: #142943; cursor: pointer; }
.three-viewport { height: 520px; cursor: grab; }
.three-viewport:active { cursor: grabbing; }
.map-attribution { padding: 5px 10px 8px; color: #7891aa; font-size: 10px; }
@media (max-width: 700px) { .three-viewport { height: 400px; } }
</style>
