// Import necessary modules
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import * as CANNON from 'cannon-es';

// Initialize renderer, scene, and camera
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 0); // Position the camera slightly above the ground

// Initialize Cannon.js world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Earth's gravity in m/s²
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Create a ground material and body for physics
const groundMaterial = new CANNON.Material();
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({
  mass: 0, // static
  material: groundMaterial,
});
groundBody.addShape(groundShape);
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Load a texture for the sky
const textureLoader = new THREE.TextureLoader();
const skyTexture = textureLoader.load('sky.jpg');

// Create a large sphere to act as the sky
const skyGeometry = new THREE.SphereGeometry(500, 60, 40);
const skyMaterial = new THREE.MeshBasicMaterial({
  map: skyTexture,
  side: THREE.BackSide // Render the inside of the sphere
});

const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

// Load a texture for the ground
const groundTexture = textureLoader.load('ground.jpg');
groundTexture.wrapS = THREE.RepeatWrapping;
groundTexture.wrapT = THREE.RepeatWrapping;
groundTexture.repeat.set(10, 10); // Repeat the texture

// Create a flat ground plane with the texture
const planeGeometry = new THREE.PlaneGeometry(100, 100);
const planeMaterial = new THREE.MeshBasicMaterial({ map: groundTexture, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2; // Rotate plane to lie flat on the XZ plane
scene.add(plane);

// Add a grid helper for visual reference
const gridHelper = new THREE.GridHelper(100, 10);
scene.add(gridHelper);

// Setup first-person controls with pointer lock
const controls = new PointerLockControls(camera, renderer.domElement);

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

// Add ambient light for softer shadows
const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
scene.add(ambientLight);

// Create a physics body for the player (camera)
const playerShape = new CANNON.Sphere(1); // Radius of the player collision sphere
const playerBody = new CANNON.Body({ mass: 1 });
playerBody.addShape(playerShape);
playerBody.position.copy(camera.position); // Sync initial position with the camera
world.addBody(playerBody);

// Function to create buildings
function createBuildings(scene, world) {
  const cityTexture = textureLoader.load('/building.jpg');
  for (let i = -40; i <= 40; i += 10) {
    for (let j = -40; j <= 40; j += 10) {
      if (Math.random() > 0.2) {
        const buildingHeight = Math.random() * 20 + 10;
        const buildingGeometry = new THREE.BoxGeometry(5, buildingHeight, 5);
        const buildingMaterial = new THREE.MeshLambertMaterial({ map: cityTexture});
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.set(i, buildingHeight / 2, j);
        scene.add(building);

        const buildingShape = new CANNON.Box(new CANNON.Vec3(2.5, buildingHeight / 2, 2.5));
        const buildingBody = new CANNON.Body({
          mass: 0,
          position: new CANNON.Vec3(i, buildingHeight / 2, j),
        });
        buildingBody.addShape(buildingShape);
        buildingBody.threemesh = building;
        world.addBody(buildingBody);
      }
    }
  }
}

// Create buildings and add them to the scene and physics world
createBuildings(scene, world);

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

// Update the player's position with physics
function updatePlayer() {
  const velocity = 10; // Movement speed
  const moveVector = new THREE.Vector3();

  if (moveForward) moveVector.z -= 1;
  if (moveBackward) moveVector.z += 1;
  if (moveLeft) moveVector.x -= 1;
  if (moveRight) moveVector.x += 1;

  moveVector.normalize(); // Prevent faster diagonal movement
  moveVector.applyQuaternion(camera.quaternion); // Align movement with camera direction

  playerBody.velocity.set(moveVector.x * velocity, playerBody.velocity.y, moveVector.z * velocity);

  // Sync the camera position with the physics body
  camera.position.copy(playerBody.position);
}

// Synchronize Three.js objects with Cannon.js bodies
function updatePhysics() {
  world.step(1 / 60); // Step the physics world at a fixed rate

  // Iterate over all Cannon.js bodies and update corresponding Three.js meshes
  world.bodies.forEach((body) => {
    if (body.threemesh) {
      body.threemesh.position.copy(body.position);
      body.threemesh.quaternion.copy(body.quaternion);
    }
  });
}

// Function to handle shooting and bomb throwing
const bullets = [];
const bombs = [];

function shootBullet() {
  const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
  bulletMesh.position.copy(camera.position);
  scene.add(bulletMesh);

  const bulletShape = new CANNON.Sphere(0.1);
  const bulletBody = new CANNON.Body({ mass: 0.1, shape: bulletShape });
  bulletBody.position.copy(camera.position);
  
  const bulletVelocity = new THREE.Vector3();
  camera.getWorldDirection(bulletVelocity);
  bulletBody.velocity.set(bulletVelocity.x * 50, bulletVelocity.y * 50, bulletVelocity.z * 50);

  bulletBody.threemesh = bulletMesh;
  world.addBody(bulletBody);
  bullets.push(bulletBody);
}

function throwBomb() {
  const bombGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const bombMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const bombMesh = new THREE.Mesh(bombGeometry, bombMaterial);
  bombMesh.position.copy(camera.position);
  scene.add(bombMesh);

  const bombShape = new CANNON.Sphere(0.5);
  const bombBody = new CANNON.Body({ mass: 1, shape: bombShape });
  bombBody.position.copy(camera.position);
  
  const bombVelocity = new THREE.Vector3();
  camera.getWorldDirection(bombVelocity);
  bombBody.velocity.set(bombVelocity.x * 30, bombVelocity.y * 30, bombVelocity.z * 30);

  bombBody.threemesh = bombMesh

  bombBody.threemesh = bombMesh;
  world.addBody(bombBody);
  bombs.push(bombBody);
}

// Event listener for shooting bullets and throwing bombs
document.addEventListener('mousedown', (event) => {
  if (event.button === 0) { // Left mouse button
    shootBullet();
  } else if (event.button === 2) { // Right mouse button
    throwBomb();
  }
});

// Update projectiles
function updateProjectiles() {
  bullets.forEach((bullet, index) => {
    bullet.threemesh.position.copy(bullet.position);
    bullet.threemesh.quaternion.copy(bullet.quaternion);
    if (bullet.position.length() > 500) {
      world.removeBody(bullet);
      scene.remove(bullet.threemesh);
      bullets.splice(index, 1);
    }
  });

  bombs.forEach((bomb, index) => {
    bomb.threemesh.position.copy(bomb.position);
    bomb.threemesh.quaternion.copy(bomb.quaternion);
    if (bomb.position.length() > 500) {
      world.removeBody(bomb);
      scene.remove(bomb.threemesh);
      bombs.splice(index, 1);
    }
  });
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  updatePlayer(); // Update player movement and collisions
  updatePhysics(); // Update physics world
  updateProjectiles(); // Update bullets and bombs

  renderer.render(scene, camera); // Render the scene from the camera's perspective
}

animate();
