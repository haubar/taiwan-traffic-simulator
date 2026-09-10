<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps({ lines: Array, trains: Array })
const viewport = ref(null)
let renderer, animationFrame, scene, camera
const trainMeshes = new Map()
const world = (x, y) => new THREE.Vector3((x - 620) / 55, 0, (y - 260) / 55)

function addMapBase() {
  const ground = new THREE.Mesh(new THREE.BoxGeometry(23, 0.25, 11), new THREE.MeshStandardMaterial({ color: 0x172d43, roughness: 0.9 }))
  ground.position.y = -0.35
  scene.add(ground)
  const grid = new THREE.GridHelper(23, 23, 0x4f7791, 0x29485f)
  grid.position.y = -0.2
  grid.material.transparent = true
  grid.material.opacity = 0.35
  scene.add(grid)
  for (let i = 0; i < 18; i += 1) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.7 + (i % 4) * 0.35, 0.3 + (i % 4) * 0.18, 0.45 + (i % 3) * 0.25), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x274761 : 0x315975 }))
    block.position.set(-10 + (i * 3.1) % 20, block.geometry.parameters.height / 2 - 0.2, -4.3 + (i * 1.7) % 8)
    scene.add(block)
  }
}

function addRoutes() {
  props.lines.forEach((line) => {
    const points = line.stations.map((station) => world(station.x, station.y).setY(0.08))
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: line.color })))
    line.stations.forEach((station) => {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 12), new THREE.MeshStandardMaterial({ color: line.color, emissive: line.color, emissiveIntensity: 0.25 }))
      const position = world(station.x, station.y)
      marker.position.set(position.x, 0.2, position.z)
      scene.add(marker)
    })
  })
}

function createTrainMesh(train) {
  const color = props.lines.find((line) => line.id === train.lineId)?.color || '#ffffff'
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.2), new THREE.MeshStandardMaterial({ color: train.trainType === 'EXPRESS' ? 0xe5a83b : color, metalness: 0.25, roughness: 0.35 }))
  body.position.y = 0.28
  body.castShadow = true
  group.add(body)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.17), new THREE.MeshStandardMaterial({ color: 0xe7f4ff }))
  roof.position.y = 0.43
  group.add(roof)
  for (const x of [-0.2, 0, 0.2]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.012), new THREE.MeshBasicMaterial({ color: 0x102238 }))
    window.position.set(x, 0.31, 0.107)
    group.add(window)
  }
  return group
}

function syncTrains() {
  const activeIds = new Set(props.trains.map((train) => train.id))
  props.trains.forEach((train) => {
    let mesh = trainMeshes.get(train.id)
    if (!mesh) { mesh = createTrainMesh(train); scene.add(mesh); trainMeshes.set(train.id, mesh) }
    mesh.userData.target = world(train.x, train.y)
    mesh.userData.direction = train.direction
  })
  trainMeshes.forEach((mesh, id) => { if (!activeIds.has(id)) { scene.remove(mesh); trainMeshes.delete(id) } })
}

function animate() {
  animationFrame = requestAnimationFrame(animate)
  trainMeshes.forEach((mesh) => {
    if (!mesh.userData.target) return
    mesh.position.lerp(mesh.userData.target, 0.16)
    mesh.rotation.y = mesh.userData.direction === 1 ? Math.PI : 0
    mesh.position.y = 0.05 + Math.sin(performance.now() / 170 + mesh.position.x) * 0.015
  })
  const time = performance.now() * 0.00008
  camera.position.x = Math.sin(time) * 15
  camera.position.z = 13 + Math.cos(time) * 2
  camera.lookAt(0, 0, 0)
  renderer.render(scene, camera)
}

function resize() {
  if (!viewport.value || !renderer) return
  camera.aspect = viewport.value.clientWidth / viewport.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight)
}

onMounted(() => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b1929)
  camera = new THREE.PerspectiveCamera(42, viewport.value.clientWidth / viewport.value.clientHeight, 0.1, 100)
  camera.position.set(0, 13, 13)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight)
  renderer.shadowMap.enabled = true
  viewport.value.appendChild(renderer.domElement)
  scene.add(new THREE.HemisphereLight(0xb8dcff, 0x183047, 2.2))
  const sun = new THREE.DirectionalLight(0xffffff, 2.5)
  sun.position.set(-5, 12, 7)
  sun.castShadow = true
  scene.add(sun)
  addMapBase(); addRoutes(); syncTrains(); animate()
  window.addEventListener('resize', resize)
})
watch(() => props.trains, syncTrains, { deep: true })
onBeforeUnmount(() => { cancelAnimationFrame(animationFrame); window.removeEventListener('resize', resize); renderer?.dispose(); trainMeshes.clear() })
</script>

<template>
  <div class="three-map-wrap"><div class="map-caption"><span>3D 地圖模擬</span><small>WebGL · 車輛平滑行駛</small></div><div ref="viewport" class="three-viewport"></div></div>
</template>

<style scoped>
.three-map-wrap { overflow: hidden; background: #0b1929; border: 1px solid #29425e; border-radius: 18px; }
.map-caption { display: flex; justify-content: space-between; padding: 10px 14px; color: #d7e5f5; font-weight: 700; }
.map-caption small { color: #7790ad; font-weight: 400; }
.three-viewport { height: 520px; cursor: grab; }
.three-viewport:active { cursor: grabbing; }
@media (max-width: 700px) { .three-viewport { height: 400px; } }
</style>
