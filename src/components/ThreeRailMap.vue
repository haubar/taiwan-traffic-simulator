<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import sceneConfig from '../data/3dSceneConfig.json' with { type: 'json' }

const props = defineProps({ lines: Array, trains: Array, selectedTrain: Object, journeyMode: String })
const emit = defineEmits(['select'])
const viewport = ref(null)
let renderer, animationFrame, scene, camera, controls, raycaster
const trainMeshes = new Map()
let hoveredTrainId = null
const world = (x, y) => new THREE.Vector3((x - 620) / 55, 0, (y - 260) / 55)
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
  const facadeCanvas = document.createElement('canvas')
  facadeCanvas.width = 128
  facadeCanvas.height = 128
  const facadeContext = facadeCanvas.getContext('2d')
  facadeContext.fillStyle = '#dce5eb'
  facadeContext.fillRect(0, 0, 128, 128)
  facadeContext.strokeStyle = '#c4d0d8'
  facadeContext.lineWidth = 2
  for (let floor = 0; floor <= 5; floor += 1) {
    const y = 7 + floor * 23
    facadeContext.beginPath()
    facadeContext.moveTo(0, y)
    facadeContext.lineTo(128, y)
    facadeContext.stroke()
  }
  for (let floor = 0; floor < 5; floor += 1) for (let bay = 0; bay < 4; bay += 1) {
    const x = 8 + bay * 30
    const y = 12 + floor * 23
    facadeContext.fillStyle = floor % 3 === 0 ? '#7599ae' : '#88a9bb'
    facadeContext.fillRect(x, y, 17, 13)
    facadeContext.fillStyle = '#d7e6ec'
    facadeContext.fillRect(x + 7, y, 2, 13)
  }
  const facadeTexture = new THREE.CanvasTexture(facadeCanvas)
  facadeTexture.colorSpace = THREE.SRGBColorSpace
  facadeTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1)
  const facadeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: facadeTexture, roughness: 0.8, vertexColors: true })
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true })
  const buildingMaterials = [facadeMaterial, facadeMaterial, roofMaterial, roofMaterial, facadeMaterial, facadeMaterial]
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterials, buildingCapacity)
  const rooftopEquipment = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xc6d0d8, roughness: 0.88 }), buildingCapacity)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let buildingIndex = 0
  let rooftopIndex = 0
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
      const height = noise > 0.72 ? 0.62 + ((noise * 29.7) % 1) * 0.8 : 0.24 + ((noise * 29.7) % 1) * 0.48
      dummy.position.set(x, -0.2 + height / 2, z)
      dummy.scale.set(width, height, depth)
      dummy.updateMatrix()
      buildings.setMatrixAt(buildingIndex, dummy.matrix)
      color.set(palette.buildingColors[Math.floor(noise * palette.buildingColors.length)])
      buildings.setColorAt(buildingIndex, color)
      if (noise > 0.68) {
        const equipmentWidth = 0.1 + noise * 0.035
        dummy.position.set(x + width * 0.12, -0.2 + height + 0.045, z)
        dummy.scale.set(equipmentWidth, 0.09, equipmentWidth)
        dummy.updateMatrix()
        rooftopEquipment.setMatrixAt(rooftopIndex, dummy.matrix)
        rooftopIndex += 1
      }
      buildingIndex += 1
    }
  }
  buildings.count = buildingIndex
  buildings.castShadow = true
  buildings.receiveShadow = true
  rooftopEquipment.count = rooftopIndex
  rooftopEquipment.castShadow = true
  scene.add(buildings)
  scene.add(rooftopEquipment)

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

const addMapBase = () => addDioramaCity()

const addRoutes = () => {
  props.lines.forEach((line) => {
    const points = line.stations.map((station) => world(station.x, station.y).setY(0.08))
    const routeColor = line.color
    const route = new THREE.CurvePath()
    points.slice(1).forEach((point, index) => route.add(new THREE.LineCurve3(points[index], point)))
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(route, points.length * 2, 0.09, 7, false), new THREE.MeshStandardMaterial({ color: palette.routeBed, roughness: 0.82 })))
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(route, points.length * 2, 0.045, 7, false), new THREE.MeshStandardMaterial({ color: routeColor, roughness: 0.5, emissive: routeColor, emissiveIntensity: 0.1 })))
    line.stations.forEach((station) => {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 12), new THREE.MeshStandardMaterial({ color: routeColor, emissive: routeColor, emissiveIntensity: 0.08 }))
      const position = world(station.x, station.y)
      marker.position.set(position.x, 0.14, position.z)
      scene.add(marker)
      const stationBuilding = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 }))
      stationBuilding.position.set(position.x, 0.23, position.z)
      stationBuilding.castShadow = true
      scene.add(stationBuilding)
    })
  })
}

const createTrainMesh = (train) => {
  const color = props.lines.find((line) => line.id === train.lineId)?.color || '#ffffff'
  const group = new THREE.Group()
  const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xe7ebee, roughness: 0.34, metalness: 0.32 })
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c1c8, roughness: 0.75, metalness: 0.14 })
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x253b4c, roughness: 0.2, metalness: 0.22 })
  const stripeMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.44, metalness: 0.12 })
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x29333b, roughness: 0.82 })
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.94, 0.34, 0.36, 4, 0.045), shellMaterial)
  body.position.y = 0.34
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.065, 0.012), stripeMaterial)
    stripe.position.set(0, 0.225, side * 0.183)
    group.add(stripe)
    for (const x of [-0.34, -0.23, -0.08, 0.08, 0.23, 0.34]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.11, 0.014), windowMaterial)
      window.position.set(x, 0.385, side * 0.183)
      group.add(window)
    }
    for (const x of [-0.155, 0.155]) {
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.19, 0.018), roofMaterial)
      doorFrame.position.set(x, 0.33, side * 0.184)
      group.add(doorFrame)
      const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.105, 0.019), windowMaterial)
      doorGlass.position.set(x, 0.365, side * 0.185)
      group.add(doorGlass)
    }
    for (const x of [-0.29, 0, 0.29]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.28, 0.014), darkMaterial)
      seam.position.set(x, 0.34, side * 0.184)
      group.add(seam)
    }
    for (const x of [-0.31, 0, 0.31]) for (const offset of [-0.105, 0.105]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.04, 12), darkMaterial)
      wheel.rotation.x = Math.PI / 2
      wheel.position.set(x + offset, 0.16, side * 0.16)
      group.add(wheel)
    }
  }
  for (const x of [-0.31, 0, 0.31]) {
    const airConditioner = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.14), roofMaterial)
    airConditioner.position.set(x, 0.535, 0)
    group.add(airConditioner)
  }
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.145, 0.25), windowMaterial)
  windshield.position.set(0.474, 0.38, 0)
  group.add(windshield)
  for (const side of [-1, 1]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.04, 0.045), new THREE.MeshBasicMaterial({ color: 0xfff1bd }))
    headlight.position.set(0.475, 0.235, side * 0.11)
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
  camera.position.set(...palette.cameraPosition)
  controls.target.set(0, 0, 0)
  controls.update()
}

onMounted(() => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(palette.background)
  camera = new THREE.PerspectiveCamera(42, viewport.value.clientWidth / viewport.value.clientHeight, 0.1, 100)
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
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = true
  controls.minDistance = 5
  controls.maxDistance = 32
  controls.maxPolarAngle = Math.PI / 2.05
  controls.target.set(0, 0, 0)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9badbd, palette.hemisphereIntensity))
  const sun = new THREE.DirectionalLight(0xffffff, palette.sunIntensity)
  sun.position.set(-8, 12, 9)
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
  <div class="three-map-wrap">
    <div class="map-caption">
      <div><strong>{{ journeyMode === 'cab' ? '車內行進視角' : journeyMode === 'follow' ? '列車跟車視角' : '3D 地圖總覽' }}</strong><div class="route-legend"><span v-for="line in lines" :key="line.id"><i :style="{background:line.color}"></i>{{line.id}}</span></div></div>
      <span><small>{{ journeyMode === 'cab' ? '鏡頭位於列車前端 · 朝行車方向觀察' : journeyMode === 'follow' ? '鏡頭跟隨目前列車行駛 · 可旋轉觀察' : '拖曳平移／旋轉 · 滾輪縮放' }}</small><button class="reset-view" type="button" @click="resetView">重置視角</button></span>
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
.three-viewport { height: 520px; cursor: grab; }
.three-viewport:active { cursor: grabbing; }
.map-attribution { padding: 5px 10px 8px; color: #657b8d; font-size: 10px; }
@media (max-width: 700px) { .three-viewport { height: 400px; } .map-caption { align-items: flex-start; } .map-caption > span { text-align: right; } }
</style>
