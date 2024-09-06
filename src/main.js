// Import necessary modules for 3D graphics and physics
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import * as CANNON from 'cannon-es';

/** 
 * ============================
 * Constants for Configurations
 * ============================
 */

// Camera settings
const CAMERA_SETTINGS = {
  FOV: 75,
  NEAR: 0.1,
  FAR: 1000,
  START_POSITION: new THREE.Vector3(0, 5, 0) // Start position slightly above the ground
};

// Physics world settings
const PHYSICS_SETTINGS = {
  GRAVITY_Y: -9.82, // Earth's gravity in m/s²
  SOLVER_ITERATIONS: 10,
  TIME_STEP: 1 / 60 // 60 FPS
};

// Sky and ground settings
const SKY_SETTINGS = {
  RADIUS: 500,
  WIDTH_SEGMENTS: 60,
  HEIGHT_SEGMENTS: 40
};

const GROUND_SETTINGS = {
  SIZE: 100,
  TEXTURE_REPEAT: 10 // Texture tiling
};

// Player settings
const PLAYER_SETTINGS = {
  RADIUS: 1, // Player's collision sphere radius
  MASS: 1,   // Player's physics body mass
  VELOCITY: 10, // Movement speed
  CAMERA_INTERPOLATION_FACTOR: 0.2 // Smooth camera movement
};

// Projectile settings
const PROJECTILE_SETTINGS = {
  BULLET: {
    RADIUS: 0.2, // Increased size for better visibility
    MASS: 0.1,
    SPEED: 50,
    COLOR: 0xff0000 // Red color
  },
  BOMB: {
    RADIUS: 0.5,
    MASS: 1,
    SPEED: 30,
    COLOR: 0x000000 // Black color
  },
  MAX_DISTANCE: 500, // Max travel distance before removal
  SPAWN_OFFSET: 1.5   // Distance from player to spawn projectiles
};

// Building settings
const BUILDING_SETTINGS = {
  BASE_HEIGHT: 20,
  HEIGHT_VARIATION: 10,
  SIZE: 5,
  SPACING: 10,
  PROBABILITY: 0.8 // Probability of creating a building at a grid point
};

// Lighting settings
const LIGHT_SETTINGS = {
  SUN: {
    COLOR: 0xffffff,
    INTENSITY: 1,
    POSITION: new THREE.Vector3(50, 100, -50),
    SHADOW_MAP_SIZE: 1024,
    SHADOW_CAMERA_NEAR: 0.5,
    SHADOW_CAMERA_FAR: 500
  },
  AMBIENT: {
    COLOR: 0x404040,
    INTENSITY: 2
  }
};

/** 
 * ============================
 * Initialization of Scene, Camera, and Renderer
 * ============================
 */

// Initialize renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Initialize scene
const scene = new THREE.Scene();

// Initialize camera
const camera = new THREE.PerspectiveCamera(
  CAMERA_SETTINGS.FOV, 
  window.innerWidth / window.innerHeight, 
  CAMERA_SETTINGS.NEAR, 
  CAMERA_SETTINGS.FAR
);
camera.position.copy(CAMERA_SETTINGS.START_POSITION);

/** 
 * ============================
 * Setup Physics World using Cannon.js
 * ============================
 */

// Initialize physics world
const world = new CANNON.World();
world.gravity.set(0, PHYSICS_SETTINGS.GRAVITY_Y, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = PHYSICS_SETTINGS.SOLVER_ITERATIONS;

/** 
 * ============================
 * Utility Functions
 * ============================
 */

// Function to load a texture with error handling
function loadTexture(path) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      path,
      (texture) => resolve(texture),
      undefined,
      (error) => reject(`Failed to load texture: ${path} - ${error}`)
    );
  });
}

// Function to handle texture loading
async function loadTextures() {
  try {
    [skyTexture, groundTexture, cityTexture] = await Promise.all([
      loadTexture('sky.jpg'),
      loadTexture('ground.jpg'),
      loadTexture('/building.jpg'),
    ]);
    setupScene(); // Proceed with setting up the scene after textures are loaded
  } catch (error) {
    console.error(error);
  }
}

/** 
 * ============================
 * Scene Setup
 * ============================
 */

// Variables for textures
let skyTexture, groundTexture, cityTexture;

// Global variable for player physics body
let playerBody;

// Start loading textures
loadTextures();

// Function to set up the 3D scene after textures are loaded
function setupScene() {
  // Create sky sphere
  const skyGeometry = new THREE.SphereGeometry(
    SKY_SETTINGS.RADIUS, 
    SKY_SETTINGS.WIDTH_SEGMENTS, 
    SKY_SETTINGS.HEIGHT_SEGMENTS
  );
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide // Render the inside of the sphere
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);

  // Setup ground plane with texture tiling
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(GROUND_SETTINGS.TEXTURE_REPEAT, GROUND_SETTINGS.TEXTURE_REPEAT);
  
  const planeGeometry = new THREE.PlaneGeometry(GROUND_SETTINGS.SIZE, GROUND_SETTINGS.SIZE);
  const planeMaterial = new THREE.MeshBasicMaterial({ map: groundTexture, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2; // Lay the plane flat on the XZ plane
  scene.add(plane);

  // **Add ground plane to the physics world**
  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({
    mass: 0 // Static ground
  });
  groundBody.addShape(groundShape);
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate ground to be horizontal
  world.addBody(groundBody);

  // Add grid helper for visual reference
  const gridHelper = new THREE.GridHelper(GROUND_SETTINGS.SIZE, GROUND_SETTINGS.SIZE / 10);
  scene.add(gridHelper);

  // Set up first-person controls
  const controls = new PointerLockControls(camera, renderer.domElement);
  document.addEventListener('click', () => controls.lock());
  controls.addEventListener('lock', () => console.log('Pointer locked'));
  controls.addEventListener('unlock', () => console.log('Pointer unlocked'));

  // Add lighting to the scene
  addLighting();

  // Create physics-based player
  setupPlayerPhysics();

  // Create buildings in the scene
  createBuildings();

  // Start the animation loop
  animate();
}

// Function to add lights to the scene
function addLighting() {
  // Directional light to simulate sunlight
  const sunLight = new THREE.DirectionalLight(LIGHT_SETTINGS.SUN.COLOR, LIGHT_SETTINGS.SUN.INTENSITY);
  sunLight.position.copy(LIGHT_SETTINGS.SUN.POSITION);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = LIGHT_SETTINGS.SUN.SHADOW_MAP_SIZE;
  sunLight.shadow.mapSize.height = LIGHT_SETTINGS.SUN.SHADOW_MAP_SIZE;
  sunLight.shadow.camera.near = LIGHT_SETTINGS.SUN.SHADOW_CAMERA_NEAR;
  sunLight.shadow.camera.far = LIGHT_SETTINGS.SUN.SHADOW_CAMERA_FAR;
  scene.add(sunLight);

  // Ambient light for general illumination
  const ambientLight = new THREE.AmbientLight(LIGHT_SETTINGS.AMBIENT.COLOR, LIGHT_SETTINGS.AMBIENT.INTENSITY);
  scene.add(ambientLight);
}

// Function to set up player physics
function setupPlayerPhysics() {
  const playerShape = new CANNON.Sphere(PLAYER_SETTINGS.RADIUS);
  playerBody = new CANNON.Body({ mass: PLAYER_SETTINGS.MASS });
  playerBody.addShape(playerShape);
  playerBody.position.copy(camera.position);
  playerBody.fixedRotation = true; // Prevent player from rotating
  playerBody.updateMassProperties();
  world.addBody(playerBody);
}

// Function to create buildings in the scene
function createBuildings() {
  const buildingGeometry = new THREE.BoxGeometry(BUILDING_SETTINGS.SIZE, BUILDING_SETTINGS.BASE_HEIGHT, BUILDING_SETTINGS.SIZE);
  const buildingMaterial = new THREE.MeshLambertMaterial({ map: cityTexture });

  for (let x = -GROUND_SETTINGS.SIZE / 2; x <= GROUND_SETTINGS.SIZE / 2; x += BUILDING_SETTINGS.SPACING) {
    for (let z = -GROUND_SETTINGS.SIZE / 2; z <= GROUND_SETTINGS.SIZE / 2; z += BUILDING_SETTINGS.SPACING) {
      if (Math.random() < BUILDING_SETTINGS.PROBABILITY) {
        const buildingHeight = Math.random() * BUILDING_SETTINGS.HEIGHT_VARIATION + BUILDING_SETTINGS.BASE_HEIGHT;
        const building = new THREE.Mesh(buildingGeometry.clone(), buildingMaterial);
        building.scale.y = buildingHeight / BUILDING_SETTINGS.BASE_HEIGHT;
        building.position.set(x, buildingHeight / 2, z);
        scene.add(building);

        const buildingShape = new CANNON.Box(new CANNON.Vec3(BUILDING_SETTINGS.SIZE / 2, buildingHeight / 2, BUILDING_SETTINGS.SIZE / 2));
        const buildingBody = new CANNON.Body({
          mass: 0,
          position: new CANNON.Vec3(x, buildingHeight / 2, z),
        });
        buildingBody.addShape(buildingShape);
        buildingBody.threemesh = building;
        world.addBody(buildingBody);
      }
    }
  }
}

/** 
 * ============================
 * Player Movement and Controls
 * ============================
 */

let keyMap = { 'w': false, 's': false, 'a': false, 'd': false };

// Event listeners for player controls
document.addEventListener('keydown', (event) => {
  if (event.key in keyMap) keyMap[event.key] = true;
});

document.addEventListener('keyup', (event) => {
  if (event.key in keyMap) keyMap[event.key] = false;
});

// Update player's position based on input
function updatePlayer() {
  const moveVector = new THREE.Vector3(
    keyMap['a'] ? -1 : keyMap['d'] ? 1 : 0,
    0,
    keyMap['w'] ? -1 : keyMap['s'] ? 1 : 0
  ).normalize();

  moveVector.applyQuaternion(camera.quaternion);
  playerBody.velocity.set(moveVector.x * PLAYER_SETTINGS.VELOCITY, playerBody.velocity.y, moveVector.z * PLAYER_SETTINGS.VELOCITY);

  camera.position.copy(playerBody.position);
}

/** 
 * ============================
 * Projectile Mechanics
 * ============================
 */

const activeProjectiles = new Set();

// Function to spawn projectiles (bullets or bombs)
function spawnProjectile(type) {
  const { RADIUS, MASS, SPEED, COLOR} = PROJECTILE_SETTINGS[type.toUpperCase()];
  const geometry = new THREE.SphereGeometry(RADIUS, 16, 16);
  const material = new THREE.MeshPhongMaterial({ color: COLOR }); // Use Phong material for visibility with lighting
  const mesh = new THREE.Mesh(geometry, material);

  // **Spawn projectile slightly in front of the player**
  const spawnPosition = new THREE.Vector3();
  camera.getWorldDirection(spawnPosition);
  spawnPosition.multiplyScalar(PROJECTILE_SETTINGS.SPAWN_OFFSET).add(camera.position); // Offset from the player

  mesh.position.copy(spawnPosition);
  scene.add(mesh);

  const shape = new CANNON.Sphere(RADIUS);
  const body = new CANNON.Body({ mass: MASS, shape });
  body.position.copy(spawnPosition); // Use the offset position

  const velocity = new THREE.Vector3();
  camera.getWorldDirection(velocity);
  body.velocity.set(velocity.x * SPEED, velocity.y * SPEED, velocity.z * SPEED);

  body.threemesh = mesh;
  world.addBody(body);
  activeProjectiles.add(body);
}

// Update projectiles and remove if they exceed max distance
function updateProjectiles() {
  for (const projectile of activeProjectiles) {
    projectile.threemesh.position.copy(projectile.position);
    projectile.threemesh.quaternion.copy(projectile.quaternion);

    if (projectile.position.length() > PROJECTILE_SETTINGS.MAX_DISTANCE) {
      world.removeBody(projectile);
      scene.remove(projectile.threemesh);
      projectile.threemesh.geometry.dispose();
      projectile.threemesh.material.dispose();
      activeProjectiles.delete(projectile);
    }
  }
}

// Event listener for shooting bullets and throwing bombs
document.addEventListener('mousedown', (event) => {
  if (event.button === 0) spawnProjectile('bullet');
  if (event.button === 2) spawnProjectile('bomb');
});

/** 
 * ============================
 * Animation and Physics Update Loop
 * ============================
 */

// Update physics world and synchronize with graphics
function updatePhysics() {
  world.step(PHYSICS_SETTINGS.TIME_STEP);

  world.bodies.forEach((body) => {
    if (body.threemesh && body.velocity.lengthSquared() > 0) {
      body.threemesh.position.copy(body.position);
      body.threemesh.quaternion.copy(body.quaternion);
    }
  });
}

// Main animation loop
function animate() {
  requestAnimationFrame(animate);
  updatePlayer();
  updatePhysics();
  updateProjectiles();
  renderer.render(scene, camera);
}

// Cleanup function for removing event listeners (if needed)
function cleanup() {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  document.removeEventListener('mousedown', handleMouseDown);
}
