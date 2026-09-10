<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps({ lines: Array, trains: Array, selectedTrain: Object, journeyMode: String, visualStyle: String })
const emit = defineEmits(['select'])
const viewport = ref(null)
let renderer, animationFrame, scene, camera, controls, raycaster
const trainMeshes = new Map()
let hoveredTrainId = null
const world = (x, y) => new THREE.Vector3((x - 620) / 55, 0, (y - 260) / 55)
const cute = () => props.visualStyle === 'cute'

const addMapBase = () => {
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
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: routeColor })))
    line.stations.forEach((station) => {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(cute() ? 0.13 : 0.1, cute() ? 0.13 : 0.1, 0.18, 12), new THREE.MeshStandardMaterial({ color: routeColor, emissive: routeColor, emissiveIntensity: cute() ? 0.08 : 0.25 }))
      const position = world(station.x, station.y)
      marker.position.set(position.x, 0.2, position.z)
      scene.add(marker)
      const stationBuilding = new THREE.Mesh(new THREE.BoxGeometry(cute() ? 0.44 : 0.34, cute() ? 0.28 : 0.22, cute() ? 0.44 : 0.34), new THREE.MeshStandardMaterial({ color: cute() ? 0xfff2c6 : 0xe5edf4, roughness: cute() ? 0.55 : 0.7 }))
      stationBuilding.position.set(position.x, 0.12, position.z)
      scene.add(stationBuilding)
    })
  })
}

const createTrainMesh = (train) => {
  const color = props.lines.find((line) => line.id === train.lineId)?.color || '#ffffff'
  const group = new THREE.Group()
  const body = new THREE.Mesh(cute() ? new THREE.CapsuleGeometry(0.14, 0.42, 5, 12) : new THREE.BoxGeometry(0.62, 0.22, 0.2), new THREE.MeshStandardMaterial({ color: train.trainType === 'EXPRESS' ? (cute() ? 0xffb84d : 0xe5a83b) : (cute() ? new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.2) : color), metalness: cute() ? 0 : 0.25, roughness: cute() ? 0.65 : 0.35 }))
  if (cute()) body.rotation.z = Math.PI / 2
  body.position.y = cute() ? 0.34 : 0.28
  body.castShadow = true
  group.add(body)
  const roof = new THREE.Mesh(cute() ? new THREE.SphereGeometry(0.15, 12, 8) : new THREE.BoxGeometry(0.48, 0.06, 0.17), new THREE.MeshStandardMaterial({ color: 0xe7f4ff }))
  roof.position.y = 0.43
  group.add(roof)
  if (cute()) {
    for (const x of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0x26364b }))
      eye.position.set(0.15, 0.37, x)
      group.add(eye)
    }
  }
  for (const x of [-0.2, 0, 0.2]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.012), new THREE.MeshBasicMaterial({ color: 0x102238 }))
    window.position.set(x, 0.31, 0.107)
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
  })
  trainMeshes.forEach((mesh, id) => { if (!activeIds.has(id)) { scene.remove(mesh); trainMeshes.delete(id) } })
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
  camera.position.set(0, 13, 15)
  controls.target.set(0, 0, 0)
  controls.update()
}

onMounted(() => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b1929)
  camera = new THREE.PerspectiveCamera(42, viewport.value.clientWidth / viewport.value.clientHeight, 0.1, 100)
  camera.position.set(0, 13, 15)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight)
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
  scene.add(new THREE.HemisphereLight(0xb8dcff, 0x183047, 2.2))
  const sun = new THREE.DirectionalLight(0xffffff, 2.5)
  sun.position.set(-5, 12, 7)
  sun.castShadow = true
  scene.add(sun)
  addMapBase(); addRoutes(); syncTrains(); animate()
  window.addEventListener('resize', resize)
})
watch(() => props.trains, syncTrains, { deep: true })
watch(() => props.selectedTrain, syncTrains, { deep: true })
onBeforeUnmount(() => { cancelAnimationFrame(animationFrame); window.removeEventListener('resize', resize); renderer?.domElement.removeEventListener('click', pickTrain); renderer?.domElement.removeEventListener('pointermove', hoverTrain); controls?.dispose(); renderer?.dispose(); trainMeshes.clear() })
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
