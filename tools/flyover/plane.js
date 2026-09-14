// Renders the site's aircraft straight down for the Study fly-over (see plane.html).
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const q = new URLSearchParams(location.search)
const WIDTH = Number(q.get('w') || 4000)
const EXPOSURE = Number(q.get('exp') || 1)
const ENV = Number(q.get('env') || 0.8)
const KEY = Number(q.get('key') || 2.2)
const AMB = Number(q.get('amb') || 0.25)

const status = document.getElementById('status')

async function run() {
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync('/models/aircraft.glb')

  // same orientation as Aircraft.jsx: nose to +x, then turned top-up to the camera
  const root = gltf.scene
  root.updateMatrixWorld(true)
  const size0 = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
  if (size0.z > size0.x) root.rotation.y = -Math.PI / 2
  const wrapper = new THREE.Group()
  wrapper.add(root)
  wrapper.rotation.set(0, Math.PI, 0)
  const top = new THREE.Group()
  top.add(wrapper)
  top.rotation.set(Math.PI / 2, 0, 0)

  const scene = new THREE.Scene()
  scene.add(top)
  top.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(top)
  const size = box.getSize(new THREE.Vector3())
  top.position.sub(box.getCenter(new THREE.Vector3()))

  // orthographic, so the aircraft reads as a plan view with no perspective
  const halfW = (size.x / 2) * 1.03
  const halfH = (size.y / 2) * 1.03
  const HEIGHT = Math.round((WIDTH * halfH) / halfW)
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 200)
  cam.position.set(0, 0, 80)
  cam.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = EXPOSURE
  renderer.setClearColor(0x000000, 0)
  document.body.appendChild(renderer.domElement)

  // offline, so the real studio environment is affordable here
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = ENV
  scene.add(new THREE.AmbientLight(0xffffff, AMB))
  const key = new THREE.DirectionalLight(0xfffaf0, KEY)
  key.position.set(-4, 5, 9)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xe4ece8, 0.5)
  fill.position.set(5, -4, 6)
  scene.add(fill)

  renderer.render(scene, cam)
  const plane = renderer.domElement.toDataURL('image/png')

  // the silhouette the shadow is blurred from
  scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setSize(Math.round(WIDTH / 4), Math.round(HEIGHT / 4), false)
  renderer.render(scene, cam)
  const sil = renderer.domElement.toDataURL('image/png')

  // for scripted capture, and links for saving by hand
  window.__result = { images: { 'plane-raw': plane, 'sil-raw': sil }, meta: { WIDTH, HEIGHT } }
  status.innerHTML = ''
  for (const [name, url] of Object.entries(window.__result.images)) {
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.png`
    a.textContent = `Save ${name}.png`
    status.appendChild(a)
  }
}

run().catch((e) => {
  window.__error = String((e && e.stack) || e)
  status.textContent = window.__error
})
