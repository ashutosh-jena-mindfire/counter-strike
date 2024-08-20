import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

// Initialize renderer, scene, and camera
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 0); // Position the camera slightly above the ground


// Load a texture for the sky
const textureLoader = new THREE.TextureLoader();
const skyTexture = textureLoader.load('../public/208.jpg');

// Create a large sphere to act as the sky
const skyGeometry = new THREE.SphereGeometry(500, 60, 40);
const skyMaterial = new THREE.MeshBasicMaterial({
  map: skyTexture,
  side: THREE.BackSide // Render the inside of the sphere
});

const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

// Create a flat ground plane
const planeGeometry = new THREE.PlaneGeometry(100, 100);
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2; // Rotate plane to lie flat on the XZ plane
scene.add(plane);

// Add a grid helper for visual reference
const gridHelper = new THREE.GridHelper(100, 10);
scene.add(gridHelper);

// Setup first-person controls with pointer lock
const controls = new PointerLockControls(camera, document.body);

document.addEventListener('click', () => {
  controls.lock(); // Lock the pointer on click
});

controls.addEventListener('lock', () => {
  console.log('Pointer locked');
});

controls.addEventListener('unlock', () => {
  console.log('Pointer unlocked');
});

// Create a directional light to simulate sunlight
const sunLight = new THREE.DirectionalLight(0xffffff, 1); // White light, full intensity
sunLight.position.set(50, 100, -50); // Position the light to act like the sun
sunLight.castShadow = true; // Enable shadows

// Optional: Customize shadow properties
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;

// Add the light to the scene
scene.add(sunLight);

// Movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

const moveSpeed = 0.1; // Speed at which the camera moves

// Event listeners for keyboard input
document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'w':
      moveForward = true;
      break;
    case 's':
      moveBackward = true;
      break;
    case 'a':
      moveLeft = true;
      break;
    case 'd':
      moveRight = true;
      break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.key) {
    case 'w':
      moveForward = false;
      break;
    case 's':
      moveBackward = false;
      break;
    case 'a':
      moveLeft = false;
      break;
    case 'd':
      moveRight = false;
      break;
  }
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update camera movement based on key input
  if (moveForward) controls.moveForward(moveSpeed);
  if (moveBackward) controls.moveForward(-moveSpeed);
  if (moveLeft) controls.moveRight(-moveSpeed);
  if (moveRight) controls.moveRight(moveSpeed);

  renderer.render(scene, camera); // Render the scene from the camera's perspective
}

animate();
