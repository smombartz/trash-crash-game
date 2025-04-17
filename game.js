import * as THREE from 'three';

// --- Core Variables ---
let scene, camera, renderer;
let playerCar, playerCarBoundingBox; // playerCar will now be a Group
let clock = new THREE.Clock();
let keys = {}; // Keyboard state
let score = 100; // Start score at 100
let gameState = 'intro'; // Initial state: 'intro', 'running', 'gameOver', 'win'
let trashCansRemaining = 0; // Counter for win condition
let mailboxesRemaining = 0; // Counter for display

// --- Default Game Constants (Used for initial load & reset if needed) ---
const ROAD_WIDTH = 10; // Width of the driving lane
const SIDEWALK_WIDTH = 3; // Width of the sidewalk on EACH side
const TOTAL_ROAD_WIDTH = ROAD_WIDTH + 2 * SIDEWALK_WIDTH; // Full width including sidewalks
const BLOCK_SIZE = 60; // Distance between the center of parallel roads
const GRID_SIZE = 5; // 5x5 grid
// Calculate world size based on grid
const HALF_GRID_SPAN = (GRID_SIZE - 1) / 2 * BLOCK_SIZE; // Distance from center to outermost road center
// World size needs to accommodate the grid and some margin
const WORLD_SIZE_X = HALF_GRID_SPAN * 2 + TOTAL_ROAD_WIDTH + BLOCK_SIZE * 1.5; // Increased margin
const WORLD_SIZE_Z = HALF_GRID_SPAN * 2 + TOTAL_ROAD_WIDTH + BLOCK_SIZE * 1.5; // Increased margin

const DEFAULT_PLAYER_SPEED = 0.3;
const DEFAULT_TURN_SPEED = 0.03;
const DEFAULT_SCORE_HIT_OBJECT = 15; // Points for hitting trash can OR mailbox
const DEFAULT_SCORE_PENALTY_TRAFFIC = -20;
const DEFAULT_SCORE_PENALTY_OFFROAD_PER_SEC = -10;
const DEFAULT_NUM_DESTRUCTIBLES = 200; // Total number of trash cans + mailboxes
const DEFAULT_NUM_TRAFFIC_CARS = 60; // Adjusted for grid size
const DEFAULT_TRAFFIC_SPEED = 0.2;
const DEFAULT_HOUSE_COUNT = 400; // Adjusted for grid size
const DEFAULT_TREE_COUNT = 1000; // Adjusted for grid size

// --- Current Game Settings (Mutable) ---
let currentGameSettings = {
    playerSpeed: DEFAULT_PLAYER_SPEED,
    turnSpeed: DEFAULT_TURN_SPEED,
    scoreHitObject: DEFAULT_SCORE_HIT_OBJECT,
    scorePenaltyTraffic: DEFAULT_SCORE_PENALTY_TRAFFIC,
    scorePenaltyOffroadPerSec: DEFAULT_SCORE_PENALTY_OFFROAD_PER_SEC,
    numDestructibles: DEFAULT_NUM_DESTRUCTIBLES,
    numTrafficCars: DEFAULT_NUM_TRAFFIC_CARS,
    trafficSpeed: DEFAULT_TRAFFIC_SPEED,
    houseCount: DEFAULT_HOUSE_COUNT,
    treeCount: DEFAULT_TREE_COUNT
};

// --- House Color Palette ---
const houseColorPairs = [
    { house: '#DFD3C6', roof: '#5C5E59' },
    { house: '#DBB883', roof: '#5E706A' },
    { house: '#9B634C', roof: '#A44A4A' },
    { house: '#B8B8B4', roof: '#000000' },
    { house: '#F2DFB4', roof: '#9D6055' },
    { house: '#E4D8B2', roof: '#693A1E' },
    { house: '#506D74', roof: '#BCB09E' },
    { house: '#F0EEE7', roof: '#45423F' },
    { house: '#E8C8C8', roof: '#5C6167' },
    { house: '#F2C968', roof: '#656868' },
    { house: '#2E4057', roof: '#C1440E' },
    { house: '#8A0303', roof: '#F4EBD0' },
    { house: '#3B3B98', roof: '#FF9F1C' },
    { house: '#006E51', roof: '#F7C59F' },
    { house: '#70163C', roof: '#D3D3D3' },
    { house: '#FF6F61', roof: '#2C2C2C' },
    { house: '#D7263D', roof: '#FFD23F' },
    { house: '#4A1C40', roof: '#A29BFE' }
];


// --- Game Objects ---
let ground;
let roadSegments = []; // Array to hold road segment data (group, dims, etc.)
let destructibles = []; // Holds both trash cans and mailboxes
let trafficCars = []; // Will hold AI car Groups
let houses = []; // Holds house groups
let trees = []; // Holds tree groups
let lights = {};


// --- UI Elements ---
const uiContainer = document.getElementById('ui-container');
const scoreDisplay = document.getElementById('score-display');
const trashCounterDisplay = document.getElementById('trash-counter'); // Counter element
const mailboxCounterDisplay = document.getElementById('mailbox-counter'); // Counter element
const startScreen = document.getElementById('start-screen');
const startTitle = document.getElementById('start-title');
const startButton = document.getElementById('start-button');

// --- Settings UI Elements ---
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const settingsSaveButton = document.getElementById('settings-save-button');
const settingsCancelButton = document.getElementById('settings-cancel-button');
// --- Settings Input Fields ---
const inputPlayerSpeed = document.getElementById('setting-player-speed');
const inputTurnSpeed = document.getElementById('setting-turn-speed');
const inputTrafficSpeed = document.getElementById('setting-traffic-speed');
const inputNumTraffic = document.getElementById('setting-num-traffic');
const inputNumDestructibles = document.getElementById('setting-num-destructibles');
const inputNumHouses = document.getElementById('setting-num-houses');
const inputNumTrees = document.getElementById('setting-num-trees');


// --- Materials (Define some reused materials with more visual interest) ---
const drivingLaneMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 }); // Darker grey for driving lane
const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 }); // Lighter grey for sidewalk base
const trashCanMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3, roughness: 0.6 }); // Grey trash cans
const mailboxBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3333dd, metalness: 0.4, roughness: 0.5 }); // Default Blue mailbox body (will be cloned)
const mailboxPostMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6, roughness: 0.4 }); // Dark grey post
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, side: THREE.DoubleSide }); // Dark grey for wheels
const playerCarBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.7, roughness: 0.3 }); // Silver player car
const playerCarCabinMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7, roughness: 0.3 }); // Lighter Silver cabin/windows area
const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffcc }); // Pale yellow headlights
const grilleMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.2, roughness: 0.7 }); // Dark grey grille

// --- Geometries (Define some reused geometries) ---
const trashCanGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
const mailboxBodyGeometry = new THREE.BoxGeometry(0.6, 0.5, 1.0);
const mailboxPostGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6);
const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16); // Radius, height, segments


// --- Initialization ---
function init() {
    console.log("Initializing game...");
    gameState = 'intro'; // Start in intro state
    score = 100; // Reset score for fresh start

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    // Adjust fog based on new world size
    scene.fog = new THREE.Fog(0x87ceeb, WORLD_SIZE_X * 0.4, WORLD_SIZE_X * 1.2); // Adjust fog distances

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Initial camera position for intro screen
    setupIntroCamera();

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Clock
    clock = new THREE.Clock();

    // Lighting
    lights.ambient = new THREE.AmbientLight(0xffffff, 0.8); // Slightly brighter ambient
    scene.add(lights.ambient);

    lights.directional = new THREE.DirectionalLight(0xffffff, 1.2); // Slightly stronger directional
    lights.directional.position.set(WORLD_SIZE_X * 0.4, 100, WORLD_SIZE_Z * 0.4); // Adjust light position
    lights.directional.castShadow = true;
    lights.directional.shadow.mapSize.width = 2048;
    lights.directional.shadow.mapSize.height = 2048;
    lights.directional.shadow.camera.near = 0.5;
    lights.directional.shadow.camera.far = 500;
    // Adjust shadow camera bounds to cover the new world size
    const shadowCamSize = Math.max(WORLD_SIZE_X, WORLD_SIZE_Z) * 0.7; // Increase shadow coverage slightly
    lights.directional.shadow.camera.left = -shadowCamSize;
    lights.directional.shadow.camera.right = shadowCamSize;
    lights.directional.shadow.camera.top = shadowCamSize;
    lights.directional.shadow.camera.bottom = -shadowCamSize;
    lights.directional.shadow.camera.updateProjectionMatrix();
    scene.add(lights.directional);
    // const shadowHelper = new THREE.CameraHelper(lights.directional.shadow.camera); // DEBUG
    // scene.add(shadowHelper); // DEBUG

    // Create Player Car (but position for intro)
    createPlayerCar();
    if (playerCar) {
        playerCar.position.set(0, 1, 0); // Center for intro display
        playerCar.rotation.y = Math.PI * 0.8; // Start rotated slightly
    }


    // Initially hide game UI, show start screen
    uiContainer.style.display = 'none';
    startScreen.style.display = 'flex'; // Show start screen
    startTitle.innerText = "Trash Crash";
    startButton.innerText = "Let's Crash!";


    // Event Listeners (Setup once)
    setupEventListeners();

    // Start Animation Loop
    animate();
    console.log("Initialization complete, waiting for start.");
}

// --- Camera Setup ---
function setupIntroCamera() {
    camera.position.set(0, 4, 10); // Position to view the rotating car
    camera.lookAt(0, 1, 0);    // Look at the car's approximate center
}

function setupGameCamera() {
    // Initial position for gameplay (will be updated by updateCamera)
     playerCar.position.set(0, 0.5, BLOCK_SIZE); // Place on road
     playerCar.rotation.y = 0; // Face South
     playerCarBoundingBox.setFromObject(playerCar); // Update box after moving
     updateCamera(); // Set initial game camera position based on car
}


// --- Object Creation Functions ---

function createGround() {
    // Make ground larger based on world size constants
    const groundSize = Math.max(WORLD_SIZE_X, WORLD_SIZE_Z) * 1.3; // Make ground comfortably larger than world size
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
    // Give ground a bit more texture variation (though still flat color)
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x55aa55, roughness: 0.95, metalness: 0.1, side: THREE.DoubleSide });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05; // Ensure roads/sidewalks are slightly above ground
    ground.receiveShadow = true;
    scene.add(ground);
}

// Creates one road segment group (sidewalk base + driving lane) and stores its data
function createRoadSegment(drivingLaneWidth, drivingLaneLength, position, rotationY = 0) {
    const roadGroup = new THREE.Group();

    // Calculate total dimensions including sidewalks
    const totalWidth = drivingLaneWidth + 2 * SIDEWALK_WIDTH;
    const totalLength = drivingLaneLength; // Length remains the same

    // 1. Create Sidewalk Base (slightly lower)
    const baseGeometry = new THREE.BoxGeometry(totalWidth, 0.08, totalLength);
    const baseMesh = new THREE.Mesh(baseGeometry, sidewalkMaterial);
    baseMesh.position.y = -0.01;
    baseMesh.receiveShadow = true;
    roadGroup.add(baseMesh);

    // 2. Create Driving Lane (on top)
    const drivingLaneGeometry = new THREE.BoxGeometry(drivingLaneWidth, 0.1, drivingLaneLength);
    const drivingLaneMesh = new THREE.Mesh(drivingLaneGeometry, drivingLaneMaterial);
    drivingLaneMesh.position.y = 0;
    drivingLaneMesh.receiveShadow = true;
    roadGroup.add(drivingLaneMesh);

    // Position and rotate the whole group
    roadGroup.position.copy(position);
    roadGroup.rotation.y = rotationY;

    scene.add(roadGroup);

    // Store segment data
    let visualDrivingWidth, visualDrivingLength;
    let visualTotalWidth, visualTotalLength;

    if (Math.abs(rotationY) < 0.1) { // Vertical road
        visualDrivingWidth = drivingLaneWidth;
        visualDrivingLength = drivingLaneLength;
        visualTotalWidth = totalWidth;
        visualTotalLength = totalLength;
    } else { // Horizontal road
        visualDrivingWidth = drivingLaneLength;
        visualDrivingLength = drivingLaneWidth;
        visualTotalWidth = totalLength;
        visualTotalLength = totalWidth;
    }

    roadSegments.push({
        group: roadGroup,
        width: visualDrivingWidth,
        length: visualDrivingLength,
        totalWidth: visualTotalWidth,
        totalLength: visualTotalLength,
        position: position.clone(),
        rotationY: rotationY
    });
    return roadGroup;
}


// *** ROAD LAYOUT FUNCTION for 5x5 Grid ***
function createRoadNetwork() {
    // Clear existing road groups from scene and array
    roadSegments.forEach(segment => scene.remove(segment.group));
    roadSegments = [];

    const roadY = 0;
    const drivingLaneW = ROAD_WIDTH;
    const drivingLaneL = Math.max(WORLD_SIZE_X, WORLD_SIZE_Z) * 0.9;

    console.log("Creating 5x5 road grid network with sidewalks...");
    const startOffset = -HALF_GRID_SPAN;

    // Create N-S Roads
    for (let i = 0; i < GRID_SIZE; i++) {
        const xPos = startOffset + i * BLOCK_SIZE;
        createRoadSegment(drivingLaneW, drivingLaneL, new THREE.Vector3(xPos, roadY, 0), 0);
    }
    // Create E-W Roads
    for (let i = 0; i < GRID_SIZE; i++) {
        const zPos = startOffset + i * BLOCK_SIZE;
        createRoadSegment(drivingLaneW, drivingLaneL, new THREE.Vector3(0, roadY, zPos), Math.PI / 2);
    }
    console.log(`Created ${roadSegments.length} road segments.`);
}

// Creates a single house mesh group with randomized colors
function createHouse(position, rotationY) {
    const baseWidth = 5 + Math.random() * 8;
    const baseDepth = 5 + Math.random() * 8;
    const baseHeight = 4 + Math.random() * 5;
    const roofHeight = baseHeight * (0.5 + Math.random() * 0.3);

    // Randomly select color pair
    const colorPair = houseColorPairs[Math.floor(Math.random() * houseColorPairs.length)];

    const houseGroup = new THREE.Group();

    // Base
    const baseGeometry = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorPair.house), // Use selected house color
        roughness: 0.8 + Math.random() * 0.2,
        metalness: 0.1
     });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.name = "house_base";
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    houseGroup.add(baseMesh);

    // Roof
    const roofRadius = Math.sqrt(baseWidth*baseWidth + baseDepth*baseDepth) / 2 * 1.1;
    const roofGeometry = new THREE.ConeGeometry(roofRadius, roofHeight, 4);
    const roofMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorPair.roof), // Use selected roof color
        roughness: 0.7 + Math.random() * 0.2,
        metalness: 0.0
    });
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    roofMesh.position.y = baseHeight + roofHeight / 2;
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    houseGroup.add(roofMesh);

    // Position/Rotate Group
    houseGroup.position.copy(position);
    houseGroup.rotation.y = rotationY;
    houseGroup.position.y = 0;

    // UserData
    houseGroup.userData = { type: 'house', boundingBox: new THREE.Box3().setFromObject(baseMesh) };
    houseGroup.updateMatrixWorld(true);
    houseGroup.userData.boundingBox.setFromObject(baseMesh, true);

    scene.add(houseGroup);
    return houseGroup;
}

// Creates multiple houses
function createHouses() {
    // Clear existing objects from scene and array
    houses.forEach(house => scene.remove(house));
    houses = [];

    console.log(`Attempting to place ${currentGameSettings.houseCount} houses...`);
    let placedCount = 0;
    for (let i = 0; i < currentGameSettings.houseCount; i++) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 30) {
            attempts++;
            const x = (Math.random() - 0.5) * WORLD_SIZE_X;
            const z = (Math.random() - 0.5) * WORLD_SIZE_Z;
            const potentialPos = new THREE.Vector3(x, 0, z);
            const checkBuffer = TOTAL_ROAD_WIDTH / 2 + 2.0;

            if (!isPositionOnRoad(potentialPos, checkBuffer)) {
                 const rotation = Math.random() * Math.PI * 2;
                 const newHouse = createHouse(potentialPos, rotation);
                 let houseCollision = false;
                 for(const existingHouse of houses) {
                     if (newHouse.userData.boundingBox && existingHouse.userData.boundingBox &&
                         newHouse.userData.boundingBox.intersectsBox(existingHouse.userData.boundingBox)) {
                         houseCollision = true; break;
                     }
                 }
                 if (!houseCollision) { houses.push(newHouse); placed = true; placedCount++; }
                 else { scene.remove(newHouse); }
            }
        }
    }
     console.log(`Successfully placed ${placedCount} houses.`);
}

// Creates a single tree mesh group
function createTree(position) {
    const trunkHeight = 3 + Math.random() * 4;
    const trunkRadius = 0.3 + Math.random() * 0.4;
    const leavesHeight = 4 + Math.random() * 5;
    const leavesRadius = 1.5 + Math.random() * 2;

    const treeGroup = new THREE.Group();

    // Trunk
    const trunkGeom = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 8);
    const trunkColor = new THREE.Color(0x8B4513).multiplyScalar(0.8 + Math.random() * 0.4);
    const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9, metalness: 0.0 });
    const trunkMesh = new THREE.Mesh(trunkGeom, trunkMat);
    trunkMesh.name = "tree_trunk";
    trunkMesh.position.y = trunkHeight / 2;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // Leaves
    const leavesGeom = new THREE.ConeGeometry(leavesRadius, leavesHeight, 8);
    const leavesColor = new THREE.Color(0x228B22).multiplyScalar(0.7 + Math.random() * 0.6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: leavesColor, roughness: 0.9, metalness: 0.0 });
    const leavesMesh = new THREE.Mesh(leavesGeom, leavesMat);
    leavesMesh.position.y = trunkHeight + leavesHeight / 2 * 0.8;
    leavesMesh.castShadow = true;
    treeGroup.add(leavesMesh);

    // Position Group
    treeGroup.position.copy(position);
    treeGroup.position.y = 0;

    // UserData
    treeGroup.userData = { type: 'tree', boundingBox: new THREE.Box3().setFromObject(trunkMesh) };
    treeGroup.updateMatrixWorld(true);
    treeGroup.userData.boundingBox.setFromObject(trunkMesh, true);

    scene.add(treeGroup);
    return treeGroup;
}

// Creates multiple trees
function createTrees() {
    // Clear existing objects from scene and array
    trees.forEach(tree => scene.remove(tree));
    trees = [];

    console.log(`Attempting to place ${currentGameSettings.treeCount} trees...`);
    let placedCount = 0;
    for (let i = 0; i < currentGameSettings.treeCount; i++) {
         let placed = false;
         let attempts = 0;
         while (!placed && attempts < 30) {
             attempts++;
             const x = (Math.random() - 0.5) * WORLD_SIZE_X;
             const z = (Math.random() - 0.5) * WORLD_SIZE_Z;
             const potentialPos = new THREE.Vector3(x, 0, z);
             const checkBuffer = TOTAL_ROAD_WIDTH / 2 + 1.0;

             if (!isPositionOnRoad(potentialPos, checkBuffer)) {
                 let tooCloseToHouse = false;
                 for (const house of houses) { if (potentialPos.distanceTo(house.position) < 8) { tooCloseToHouse = true; break; } }
                 let tooCloseToTree = false;
                 for (const tree of trees) { if (potentialPos.distanceTo(tree.position) < 3.0) { tooCloseToTree = true; break; } }

                 if (!tooCloseToHouse && !tooCloseToTree) {
                     const newTree = createTree(potentialPos);
                     let staticCollision = false;
                     for(const h of houses) { if (newTree.userData.boundingBox?.intersectsBox(h.userData.boundingBox)) { staticCollision = true; break; } }
                     if (!staticCollision) { for(const t of trees) { if (newTree.userData.boundingBox?.intersectsBox(t.userData.boundingBox)) { staticCollision = true; break; } } }

                     if (!staticCollision) { trees.push(newTree); placed = true; placedCount++; }
                     else { scene.remove(newTree); }
                 }
             }
         }
    }
    console.log(`Successfully placed ${placedCount} trees.`);
}

// Creates the player's controllable car (Refined Station Wagon style with SVG logo)
function createPlayerCar() {
    // If car already exists (e.g., during restart), remove it first
    if (playerCar) {
        scene.remove(playerCar);
        playerCar = null; // Clear reference
    }

    playerCar = new THREE.Group(); // Use a group
    playerCar.name = "PlayerCarGroup"; // Name the group

    // Dimensions
    const carWidth = 2.2;
    const carLength = 5.0;
    const mainBodyHeight = 0.8;
    const cabinHeight = 0.7;
    const cabinWidth = carWidth * 0.9;
    const cabinLength = carLength * 0.45; // Cabin occupies middle part
    const cabinOffsetZ = -carLength * 0.05; // Move cabin slightly back from true center

    const wheelRadius = 0.4;
    const wheelThickness = 0.3;
    const wheelOffsetZ = (carLength / 2) * 0.7; // Position wheels along length
    const wheelOffsetX = (carWidth / 2) * 0.95; // Position wheels width-wise
    const wheelY = wheelRadius * 0.8; // Position wheels slightly below center

    // Main Body (Lower part - full length)
    const bodyGeom = new THREE.BoxGeometry(carWidth, mainBodyHeight, carLength);
    const bodyMesh = new THREE.Mesh(bodyGeom, playerCarBodyMaterial);
    bodyMesh.position.y = mainBodyHeight / 2; // Base at y=0
    playerCar.add(bodyMesh);

    // Cabin (Sits on top)
    const cabinGeom = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength);
    const cabinMesh = new THREE.Mesh(cabinGeom, playerCarCabinMaterial);
    cabinMesh.position.y = mainBodyHeight + cabinHeight / 2;
    cabinMesh.position.z = cabinOffsetZ; // Position cabin
    playerCar.add(cabinMesh);

    // --- Front End Details ---
    const grilleHeight = mainBodyHeight * 0.6;
    const grilleWidth = carWidth * 0.5;
    const grilleDepth = 0.2;
    const grilleGeom = new THREE.BoxGeometry(grilleWidth, grilleHeight, grilleDepth);
    const grilleMesh = new THREE.Mesh(grilleGeom, grilleMaterial);
    grilleMesh.position.set(0, grilleHeight / 2, carLength / 2 - grilleDepth / 2 + 0.01); // Slightly recessed
    playerCar.add(grilleMesh);

    const headlightSize = grilleHeight * 0.8;
    const headlightWidth = carWidth * 0.15;
    const headlightGeom = new THREE.BoxGeometry(headlightWidth, headlightSize, grilleDepth);
    const headlightMeshL = new THREE.Mesh(headlightGeom, headlightMaterial);
    const headlightMeshR = new THREE.Mesh(headlightGeom, headlightMaterial);
    headlightMeshL.position.set(- (grilleWidth / 2 + headlightWidth / 2 + 0.1), headlightSize / 2, carLength / 2 - grilleDepth / 2 + 0.01);
    headlightMeshR.position.set( (grilleWidth / 2 + headlightWidth / 2 + 0.1), headlightSize / 2, carLength / 2 - grilleDepth / 2 + 0.01);
    playerCar.add(headlightMeshL);
    playerCar.add(headlightMeshR);
    // --- End Front End ---


    // Wheels
    const wheelPositions = [
        new THREE.Vector3(wheelOffsetX, wheelY, wheelOffsetZ),  // Front Right
        new THREE.Vector3(-wheelOffsetX, wheelY, wheelOffsetZ), // Front Left
        new THREE.Vector3(wheelOffsetX, wheelY, -wheelOffsetZ), // Rear Right
        new THREE.Vector3(-wheelOffsetX, wheelY, -wheelOffsetZ)  // Rear Left
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2; // Rotate cylinder to look like a wheel
        wheel.position.copy(pos);
        playerCar.add(wheel);
    });

    // --- Volvo Logo SVG Decal ---
    try {
        const svgString = `<svg fill="#ffffff" width="100px" height="100px" viewBox="0 0 24 24" role="img" xmlns="http://www.w3.org/2000/svg"><title>Volvo icon</title><path d="M11.269 11.225h-.522v-.343h2.072v.343h-.516v1.55h.479c.443 0 .734-.292.734-.69h.342v1.038h-3.11v-.347h.522zm2.533.001h-.515v-.344h2.248v.344h-.544l.758 1.383.749-1.383h-.448v-.344h1.55v.344h-.516l-1.027 1.9-1.21-.001zm5.181-.392c1.041 0 1.6.52 1.6 1.171 0 .66-.527 1.187-1.594 1.187-1.067 0-1.599-.526-1.599-1.187 0-.651.553-1.17 1.593-1.17zM5.781 12.61l.748-1.383h-.447v-.344H7.63v.344h-.515l-1.028 1.9-1.21-.001-1.045-1.899h-.514v-.344h2.247v.344h-.543zm3.237-1.775c1.041 0 1.6.52 1.6 1.171 0 .66-.527 1.187-1.594 1.187-1.067 0-1.599-.526-1.599-1.187 0-.651.552-1.17 1.593-1.17zm-.551 1.157c.007-.432.214-.809.57-.803.356.007.544.39.537.823-.008.407-.176.831-.567.824-.38-.007-.547-.427-.54-.844zm9.965 0c.007-.432.214-.809.57-.803.356.007.544.39.537.823-.008.407-.176.831-.567.824-.38-.007-.547-.427-.54-.844zM3.226 9.83C4.198 5.887 7.757 2.963 12 2.963c4.243 0 7.802 2.924 8.774 6.866zm17.548 4.342c-.972 3.942-4.531 6.866-8.774 6.866-4.243 0-7.802-2.924-8.774-6.866zm.849-9.341l.568-.569c.404.532.769 1.096 1.087 1.688h.449V.283H18.06v.444c.589.317 1.15.68 1.678 1.082l-.569.568A11.947 11.947 0 0 0 12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12c0-2.688-.884-5.17-2.377-7.17Z"/></svg>`;
        const logoSize = 0.4; // Size of the decal plane
        const logoPlane = new THREE.PlaneGeometry(logoSize, logoSize);

        // Create canvas to draw SVG
        const canvas = document.createElement('canvas');
        const canvasSize = 128; // Texture resolution
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        let logoTexture = null; // Declare texture variable outside onload

        img.onload = function() {
            // Draw SVG onto canvas when loaded
            ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
            // Update the texture if it exists
            if (logoTexture) {
                logoTexture.needsUpdate = true;
            }
        };
        // Use base64 encoding for the SVG data URL
        img.onerror = function() { console.error("Failed to load SVG image for logo."); }; // Add error handling
        img.src = 'data:image/svg+xml;base64,' + btoa(svgString);

        // Create texture from canvas
        logoTexture = new THREE.CanvasTexture(canvas);
        logoTexture.colorSpace = THREE.SRGBColorSpace; // Ensure correct colorspace

        const logoMaterial = new THREE.MeshStandardMaterial({
            map: logoTexture,
            transparent: true, // Use transparency
            alphaTest: 0.1,    // Adjust alpha test if needed for cleaner edges
            metalness: 0.1,
            roughness: 0.6,
            side: THREE.DoubleSide // Render both sides
        });

        const logoDecal = new THREE.Mesh(logoPlane, logoMaterial);
        // Position slightly in front of the grille mesh
        logoDecal.position.set(0, grilleHeight / 2, carLength / 2 + 0.02); // Position relative to car origin
        playerCar.add(logoDecal);
    } catch (error) {
        console.error("Error creating SVG logo:", error);
        // Fallback: add a simple colored square if SVG fails
        const logoGeom = new THREE.BoxGeometry(0.3, 0.3, 0.1);
        const fallbackLogoMat = new THREE.MeshBasicMaterial({ color: 0x4444ff });
        const logoMesh = new THREE.Mesh(logoGeom, fallbackLogoMat);
        logoMesh.position.set(0, grilleHeight / 2, carLength / 2 + 0.01);
        playerCar.add(logoMesh);
    }
    // --- End Volvo Logo SVG Decal ---


    // Set position and rotation for the whole group (Initial position for intro)
    playerCar.position.set(0, 1, 0); // Center for intro/game over display
    playerCar.rotation.y = Math.PI * 0.8; // Start rotated slightly

    // Enable shadows for all parts
    playerCar.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true; // Car parts can receive shadows from other parts
        }
    });

    scene.add(playerCar);

    // Bounding Box for the Group
    playerCarBoundingBox = new THREE.Box3().setFromObject(playerCar);
    console.log("Player car created.");
}


// Creates destructible objects (bins and mailboxes) along road edges (on sidewalks)
function createDestructibles() {
    // Clear existing objects from scene and array
    destructibles.forEach(obj => { if (obj.parent) obj.parent.remove(obj); });
    destructibles = [];
    trashCansRemaining = 0; // Reset counter
    mailboxesRemaining = 0; // Reset counter

    console.log(`Attempting to place ${currentGameSettings.numDestructibles} destructibles...`); // Use setting
    let placedCount = 0;

    for (let i = 0; i < currentGameSettings.numDestructibles; i++) { // Use setting
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 50) {
             attempts++;
            if (roadSegments.length === 0) break;
            const segmentIndex = Math.floor(Math.random() * roadSegments.length);
            const segment = roadSegments[segmentIndex]; // Get segment data

            // --- Place consistently in the MIDDLE of the sidewalk strip ---
            const drivingLaneHalfWidth = segment.width / 2; // Visual driving lane half-width
            // Calculate offset to the center of the sidewalk strip
            const offsetMagnitude = drivingLaneHalfWidth + SIDEWALK_WIDTH / 2;
            const sideSign = (Math.random() < 0.5 ? 1 : -1); // Randomly pick left or right side
            const sideOffset = offsetMagnitude * sideSign;

            // Position along the length of the segment
            const lengthPos = (Math.random() - 0.5) * segment.length * 0.95; // Place along 95% of length

            let x, z;
            // Determine position based on segment orientation (using rotationY)
            if (Math.abs(segment.rotationY) < 0.1) { // Vertical road
                x = segment.position.x + sideOffset; // Offset along X
                z = segment.position.z + lengthPos;  // Position along Z
            } else { // Horizontal road
                x = segment.position.x + lengthPos;   // Position along X
                z = segment.position.z + sideOffset;  // Offset along Z
            }
            const potentialPos = new THREE.Vector3(x, 0, z); // Base position at y=0
            // --- END UPDATED PLACEMENT LOGIC ---


            // Basic check: Ensure it's not too close to another destructible
            let tooClose = false;
             for (const other of destructibles) {
                 if (potentialPos.distanceTo(other.position) < 2.0) { // Adjusted spacing
                     tooClose = true;
                     break;
                 }
             }

            if (!tooClose) {
                 let obj;
                 // Randomly choose between trash can and mailbox
                 if (Math.random() < 0.6) { // 60% chance of trash can
                     obj = new THREE.Mesh(trashCanGeometry, trashCanMaterial);
                     obj.position.copy(potentialPos);
                     obj.position.y = 1; // Center trash can vertically
                     obj.userData.type = 'trashcan';
                     trashCansRemaining++; // Increment counter
                 } else { // 40% chance of mailbox
                     obj = new THREE.Group(); // Mailbox is a group
                     const post = new THREE.Mesh(mailboxPostGeometry, mailboxPostMaterial);
                     const body = new THREE.Mesh(mailboxBodyGeometry.clone(), mailboxBodyMaterial.clone()); // Clone geometry and material

                     // Assign random house color to mailbox body
                     const randomColorPair = houseColorPairs[Math.floor(Math.random() * houseColorPairs.length)];
                     body.material.color.set(randomColorPair.house);

                     post.position.y = 1.2 / 2; // Post base at y=0
                     body.position.y = 1.2 + (0.5 / 2); // Body sits on top of post
                     body.position.z = -0.1; // Slight offset if needed
                     obj.add(post);
                     obj.add(body);
                     obj.position.copy(potentialPos); // Position the group
                     obj.userData.type = 'mailbox';
                     mailboxesRemaining++; // Increment counter
                 }

                 obj.castShadow = true;
                 obj.receiveShadow = true; // Apply to group or mesh

                 // Ensure children inherit shadow properties if it's a group
                 obj.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                 });

                 // Common userData for destructibles
                 obj.userData.isActive = true;
                 obj.userData.isFlying = false;
                 obj.userData.flyVelocity = new THREE.Vector3();
                 obj.userData.flyRotationAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                 obj.userData.flyRotationSpeed = (Math.random() - 0.5) * 0.2;
                 // Calculate bounding box AFTER adding children and positioning group
                 obj.updateMatrixWorld(true);
                 obj.userData.boundingBox = new THREE.Box3().setFromObject(obj); // Bounding box for the whole object/group

                 scene.add(obj);
                 destructibles.push(obj);
                 placed = true;
                 placedCount++;
            }
        }
    }
    updateCountersDisplay(); // Update UI after creating all objects
    console.log(`Successfully placed ${placedCount} destructibles (${trashCansRemaining} trash, ${mailboxesRemaining} mailboxes).`);
}


// Creates AI traffic cars (Groups with wheels) on road segments
function createTraffic() {
    // Clear existing objects from scene and array
    trafficCars.forEach(car => { if (car.parent) car.parent.remove(car); });
    trafficCars = [];

    // AI Car dimensions
    const aiBodyWidth = 2.0;
    const aiBodyHeight = 0.7;
    const aiBodyLength = 4.0;
    const aiCabinHeight = 0.6;
    const aiCabinLength = 1.8;
    const aiWheelRadius = 0.35;
    const aiWheelThickness = 0.25;
    const aiWheelOffsetZ = (aiBodyLength / 2) * 0.75;
    const aiWheelOffsetX = (aiBodyWidth / 2) * 0.9;
    const aiWheelY = aiWheelRadius * 0.8;

    const trafficCarColors = [0x0000ff, 0xffff00, 0x00ffff, 0xff00ff, 0xffffff, 0xaaaaaa, 0x444444, 0xcc4444, 0x44cc44];

    console.log(`Attempting to place ${currentGameSettings.numTrafficCars} traffic cars...`); // Use setting
    let carIndex = 0;
    // Distribute cars somewhat evenly across segments
    const numSegments = roadSegments.length > 0 ? roadSegments.length : 1; // Avoid division by zero
    const carsPerSegment = Math.max(1, Math.floor(currentGameSettings.numTrafficCars / numSegments)); // Use setting

    for (let i = 0; i < roadSegments.length && carIndex < currentGameSettings.numTrafficCars; i++) { // Use setting
        const segment = roadSegments[i]; // Get segment data
        // Add a calculated number of cars to this segment
        for (let j = 0; j < carsPerSegment && carIndex < currentGameSettings.numTrafficCars; j++) { // Use setting
             const carColor = trafficCarColors[carIndex % trafficCarColors.length];
             // Use slightly varied material properties for AI cars
             const bodyMaterial = new THREE.MeshStandardMaterial({
                 color: carColor,
                 metalness: 0.5 + Math.random() * 0.3, // More varied metalness
                 roughness: 0.4 + Math.random() * 0.3 // More varied roughness
             });
             const cabinMaterial = new THREE.MeshStandardMaterial({
                 color: new THREE.Color(carColor).multiplyScalar(0.8), // Slightly darker cabin
                 metalness: bodyMaterial.metalness * 0.8, // Cabin slightly less metallic
                 roughness: bodyMaterial.roughness * 1.1 // Cabin slightly rougher
              });

             const carGroup = new THREE.Group();

             // AI Car Body
             const bodyGeom = new THREE.BoxGeometry(aiBodyWidth, aiBodyHeight, aiBodyLength);
             const bodyMesh = new THREE.Mesh(bodyGeom, bodyMaterial);
             bodyMesh.position.y = aiBodyHeight / 2;
             carGroup.add(bodyMesh);

             // AI Car Cabin
             const cabinGeom = new THREE.BoxGeometry(aiBodyWidth * 0.85, aiCabinHeight, aiCabinLength);
             const cabinMesh = new THREE.Mesh(cabinGeom, cabinMaterial);
             cabinMesh.position.y = aiBodyHeight + aiCabinHeight / 2;
             cabinMesh.position.z = (aiBodyLength / 2) - aiCabinLength; // Position cabin towards the back slightly
             carGroup.add(cabinMesh);

             // AI Car Wheels
             const aiWheelPositions = [
                 new THREE.Vector3(aiWheelOffsetX, aiWheelY, aiWheelOffsetZ),
                 new THREE.Vector3(-aiWheelOffsetX, aiWheelY, aiWheelOffsetZ),
                 new THREE.Vector3(aiWheelOffsetX, aiWheelY, -aiWheelOffsetZ),
                 new THREE.Vector3(-aiWheelOffsetX, aiWheelY, -aiWheelOffsetZ)
             ];
             aiWheelPositions.forEach(pos => {
                 const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial); // Use shared wheel geometry/material
                 wheel.rotation.z = Math.PI / 2;
                 wheel.position.copy(pos);
                 carGroup.add(wheel);
             });


            // --- POSITIONING LOGIC using DRIVING LANE dimensions ---
            let x, z, rotationY, direction;
            // Determine lane offset sign based on j (alternating for cars on same segment)
            const laneSign = (j % 2 === 0 ? 1 : -1);

             if (Math.abs(segment.rotationY) < 0.1) { // Vertical road (Segment runs along Z)
                 const laneOffset = (segment.width / 4) * laneSign;
                 const startPosOffset = (segment.length / 2 * 0.8) * (Math.random() - 0.5);
                 x = segment.position.x + laneOffset;
                 z = segment.position.z + startPosOffset;
                 direction = new THREE.Vector3(0, 0, laneOffset > 0 ? -1 : 1);
                 rotationY = direction.z > 0 ? 0 : Math.PI;
             } else { // Horizontal road (Segment runs along X)
                 const laneOffset = (segment.length / 4) * laneSign;
                 const startPosOffset = (segment.width / 2 * 0.8) * (Math.random() - 0.5);
                 x = segment.position.x + startPosOffset;
                 z = segment.position.z + laneOffset;
                 direction = new THREE.Vector3(laneOffset > 0 ? -1 : 1, 0, 0);
                 rotationY = direction.x > 0 ? -Math.PI / 2 : Math.PI / 2;
             }
            // --- END POSITIONING LOGIC ---

            carGroup.position.set(x, 0.5, z); // Set position for the group
            carGroup.rotation.y = rotationY; // Set rotation for the group

            // Enable shadows for all parts
            carGroup.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Store necessary data in userData
            carGroup.userData = {
                segmentIndex: i,
                direction: direction, // Store the determined direction
                speed: currentGameSettings.trafficSpeed * (0.8 + Math.random() * 0.4), // Use setting
                collisionCooldown: 0,
                boundingBox: new THREE.Box3().setFromObject(carGroup) // Bounding box for the whole car group
            };
            // Update bounding box after positioning
            carGroup.updateMatrixWorld(true);
            carGroup.userData.boundingBox.setFromObject(carGroup);


            scene.add(carGroup);
            trafficCars.push(carGroup); // Add the group to the array
            carIndex++;
        }
    }
     // Add remaining cars randomly if budget not met (using the same corrected lane logic)
     while (carIndex < currentGameSettings.numTrafficCars && roadSegments.length > 0) { // Use setting
         const segmentIndex = Math.floor(Math.random() * roadSegments.length);
         const segment = roadSegments[segmentIndex];
         const carColor = trafficCarColors[carIndex % trafficCarColors.length];
         const bodyMaterial = new THREE.MeshStandardMaterial({ color: carColor, metalness: 0.5 + Math.random() * 0.3, roughness: 0.4 + Math.random() * 0.3 });
         const cabinMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(carColor).multiplyScalar(0.8), metalness: bodyMaterial.metalness * 0.8, roughness: bodyMaterial.roughness * 1.1 });
         const carGroup = new THREE.Group();
         // Body
         const bodyGeom = new THREE.BoxGeometry(aiBodyWidth, aiBodyHeight, aiBodyLength);
         const bodyMesh = new THREE.Mesh(bodyGeom, bodyMaterial); bodyMesh.position.y = aiBodyHeight / 2; carGroup.add(bodyMesh);
         // Cabin
         const cabinGeom = new THREE.BoxGeometry(aiBodyWidth * 0.85, aiCabinHeight, aiCabinLength);
         const cabinMesh = new THREE.Mesh(cabinGeom, cabinMaterial); cabinMesh.position.y = aiBodyHeight + aiCabinHeight / 2; cabinMesh.position.z = (aiBodyLength / 2) - aiCabinLength; carGroup.add(cabinMesh);
         // Wheels
         const aiWheelPositions = [ new THREE.Vector3(aiWheelOffsetX, aiWheelY, aiWheelOffsetZ), new THREE.Vector3(-aiWheelOffsetX, aiWheelY, aiWheelOffsetZ), new THREE.Vector3(aiWheelOffsetX, aiWheelY, -aiWheelOffsetZ), new THREE.Vector3(-aiWheelOffsetX, aiWheelY, -aiWheelOffsetZ) ];
         aiWheelPositions.forEach(pos => { const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial); wheel.rotation.z = Math.PI / 2; wheel.position.copy(pos); carGroup.add(wheel); });

         // Position/Rotation/Direction
         const laneSign = (Math.random() < 0.5 ? 1 : -1);
         let x, z, rotationY, direction;
         if (Math.abs(segment.rotationY) < 0.1) { // Vertical
             const laneOffset = (segment.width / 4) * laneSign; const startPosOffset = (segment.length / 2 * 0.8) * (Math.random() - 0.5);
             x = segment.position.x + laneOffset; z = segment.position.z + startPosOffset;
             direction = new THREE.Vector3(0, 0, laneOffset > 0 ? -1 : 1); rotationY = direction.z > 0 ? 0 : Math.PI;
         } else { // Horizontal
             const laneOffset = (segment.length / 4) * laneSign; const startPosOffset = (segment.width / 2 * 0.8) * (Math.random() - 0.5);
             x = segment.position.x + startPosOffset; z = segment.position.z + laneOffset;
             direction = new THREE.Vector3(laneOffset > 0 ? -1 : 1, 0, 0); rotationY = direction.x > 0 ? -Math.PI / 2 : Math.PI / 2;
         }
         carGroup.position.set(x, 0.5, z); carGroup.rotation.y = rotationY;
         // Shadows
         carGroup.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
         // UserData
         carGroup.userData = { segmentIndex: segmentIndex, direction: direction, speed: currentGameSettings.trafficSpeed * (0.8 + Math.random() * 0.4), collisionCooldown: 0, boundingBox: new THREE.Box3().setFromObject(carGroup) }; // Use setting
         carGroup.updateMatrixWorld(true); carGroup.userData.boundingBox.setFromObject(carGroup);

         scene.add(carGroup); trafficCars.push(carGroup); carIndex++;
     }
     console.log(`Successfully created ${trafficCars.length} traffic cars.`);
}


// --- Event Handling ---
function setupEventListeners() {
    // Keyboard listeners
    window.addEventListener('keydown', (event) => {
        keys[event.code] = true;
        // Allow restart via Enter only when game is over or won (start screen is shown)
        if ((gameState === 'gameOver' || gameState === 'win') && event.code === 'Enter') {
            startGame(); // Reuse start logic
        }
    });
    window.addEventListener('keyup', (event) => {
        keys[event.code] = false;
    });

    // Resize listener
    window.addEventListener('resize', onWindowResize, false);

    // Game Over restart button (Now the main start button)
    // restartButton.addEventListener('click', restartGame); // Remove old listener if any

    // --- Start Screen Button ---
    startButton.addEventListener('click', startGame);

    // --- Settings Modal Listeners ---
    settingsButton.addEventListener('click', openSettingsModal);
    settingsCancelButton.addEventListener('click', closeSettingsModal);
    settingsSaveButton.addEventListener('click', saveSettingsAndRestart);

    console.log("Event listeners set up.");
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Settings Modal Functions ---
function openSettingsModal() {
    // Populate inputs with current settings
    inputPlayerSpeed.value = currentGameSettings.playerSpeed;
    inputTurnSpeed.value = currentGameSettings.turnSpeed;
    inputTrafficSpeed.value = currentGameSettings.trafficSpeed;
    inputNumTraffic.value = currentGameSettings.numTrafficCars;
    inputNumDestructibles.value = currentGameSettings.numDestructibles;
    inputNumHouses.value = currentGameSettings.houseCount;
    inputNumTrees.value = currentGameSettings.treeCount;

    // Show the modal
    settingsModal.style.display = 'block';
    // Optional: Pause game loop while settings are open?
    // gameState = 'paused'; // Needs handling in animate loop
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
    // Optional: Resume game if paused
    // if (gameState === 'paused') gameState = 'running';
}

function saveSettingsAndRestart() {
    console.log("Saving settings and restarting...");
    // Read values, parse as numbers, provide defaults if invalid
    const newPlayerSpeed = parseFloat(inputPlayerSpeed.value) || DEFAULT_PLAYER_SPEED;
    const newTurnSpeed = parseFloat(inputTurnSpeed.value) || DEFAULT_TURN_SPEED;
    const newTrafficSpeed = parseFloat(inputTrafficSpeed.value) || DEFAULT_TRAFFIC_SPEED;
    const newNumTraffic = parseInt(inputNumTraffic.value, 10);
    const newNumDestructibles = parseInt(inputNumDestructibles.value, 10);
    const newNumHouses = parseInt(inputNumHouses.value, 10);
    const newNumTrees = parseInt(inputNumTrees.value, 10);

    // Update current settings object (with validation/clamping if desired)
    currentGameSettings.playerSpeed = Math.max(0.1, newPlayerSpeed); // Min speed 0.1
    currentGameSettings.turnSpeed = Math.max(0.01, newTurnSpeed); // Min turn 0.01
    currentGameSettings.trafficSpeed = Math.max(0, newTrafficSpeed); // Min speed 0
    currentGameSettings.numTrafficCars = isNaN(newNumTraffic) || newNumTraffic < 0 ? DEFAULT_NUM_TRAFFIC_CARS : newNumTraffic;
    currentGameSettings.numDestructibles = isNaN(newNumDestructibles) || newNumDestructibles < 0 ? DEFAULT_NUM_DESTRUCTIBLES : newNumDestructibles;
    currentGameSettings.houseCount = isNaN(newNumHouses) || newNumHouses < 0 ? DEFAULT_HOUSE_COUNT : newNumHouses;
    currentGameSettings.treeCount = isNaN(newNumTrees) || newNumTrees < 0 ? DEFAULT_TREE_COUNT : newNumTrees;


    closeSettingsModal();
    // Restart game fully to apply new counts etc.
    fullGameReset();
    startGame(); // Go back to intro screen after reset
}


// --- Helper Functions ---

// Checks if a 3D position vector is within the bounds of any road segment's TOTAL area (road + sidewalks)
function isPositionOnRoad(position, buffer = 0) {
    for (const segment of roadSegments) {
        const segPos = segment.position;
        // Use the TOTAL visual width & length for the check
        const visualTotalWidth = segment.totalWidth + buffer;
        const visualTotalLength = segment.totalLength + buffer;

        // Calculate bounds based on segment center and its TOTAL visual dimensions in world space
        const minX = segPos.x - visualTotalWidth / 2;
        const maxX = segPos.x + visualTotalWidth / 2;
        const minZ = segPos.z - visualTotalLength / 2;
        const maxZ = segPos.z + visualTotalLength / 2;

        // Check if the point is within these world-axis-aligned bounds
        if (position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ) {
            return true; // Is on this segment (including sidewalk)
        }
    }
    return false; // Not on any segment
}


// --- Game Logic Update ---
function updateGameLogic(deltaTime) {
    // This function only runs when gameState is 'running'
    if (gameState !== 'running') return;

    handlePlayerMovement(deltaTime); // Now includes static collision response
    handleTrafficMovement(deltaTime); // Uses driving lane bounds
    handleDestructibleMovement(deltaTime);
    checkCollisions(); // Checks dynamic collisions (traffic, destructibles)
    checkOffRoad(deltaTime); // Uses total road bounds + buffer
    updateCamera(); // Only update camera to follow car in running state
    updateScoreDisplay();
    updateCountersDisplay(); // Update counters display

    // Check score AFTER penalties/bonuses are applied in checkCollisions/checkOffRoad
    if (score <= 0 && gameState === 'running') { // Ensure game over only triggers once if score hits 0 or less
        triggerGameOver();
    }
}

// Handles player input and updates car position/rotation
function handlePlayerMovement(deltaTime) {
    // Store position before movement for collision response
    const previousPosition = playerCar.position.clone();

    let moveDistance = 0;
    let rotationAmount = 0;

    // Use current settings for speed
    if (keys['ArrowUp'] || keys['KeyW']) { moveDistance = currentGameSettings.playerSpeed * 100 * deltaTime; }
    if (keys['ArrowDown'] || keys['KeyS']) { moveDistance = -currentGameSettings.playerSpeed * 80 * deltaTime; } // Use setting
    if (keys['ArrowLeft'] || keys['KeyA']) { rotationAmount = currentGameSettings.turnSpeed; } // Use setting
    if (keys['ArrowRight'] || keys['KeyD']) { rotationAmount = -currentGameSettings.turnSpeed; } // Use setting

    playerCar.rotation.y += rotationAmount;

    const moveX = Math.sin(playerCar.rotation.y) * moveDistance;
    const moveZ = Math.cos(playerCar.rotation.y) * moveDistance;
    playerCar.position.x -= moveX;
    playerCar.position.z -= moveZ;

    // Update bounding box after preliminary movement
    playerCarBoundingBox.setFromObject(playerCar);

    // --- Collision Response for Static Objects ---
    // Check AFTER moving, and revert if needed
    let collisionOccurred = false;
    const staticObstacles = [...houses, ...trees]; // Combine houses and trees
    for (const obstacle of staticObstacles) {
        // Check if obstacle and its bounding box exist and are valid
        // Use the tighter bounding box stored in userData (base/trunk)
        if (obstacle.userData && obstacle.userData.boundingBox && !obstacle.userData.boundingBox.isEmpty()) {
            // Update obstacle bounding box based on its current world matrix before check?
            // For truly static objects, this isn't strictly necessary after initial creation.
            // obstacle.updateMatrixWorld(true);
            // obstacle.userData.boundingBox.setFromObject(obstacle.getObjectByName(obstacle.userData.type === 'house' ? 'house_base' : 'tree_trunk'), true);

            if (playerCarBoundingBox.intersectsBox(obstacle.userData.boundingBox)) {
                // console.log("Hit static object:", obstacle.userData.type);
                collisionOccurred = true;
                break; // Handle one collision at a time
            }
        }
    }

    // If collision with static object, revert to previous position
    if (collisionOccurred) {
        playerCar.position.copy(previousPosition);
        // Update bounding box again after reverting position
        playerCarBoundingBox.setFromObject(playerCar);
        // Optional: Add a small bounce or stop momentum here if desired
    }
}

// Moves AI traffic cars along their assigned segments
function handleTrafficMovement(deltaTime) {
    trafficCars.forEach(car => { // car is now a Group
        // Safety check in case segment doesn't exist (e.g., during restart)
        if (!roadSegments[car.userData.segmentIndex]) return;

        const segment = roadSegments[car.userData.segmentIndex]; // Get segment data
        // Use current traffic speed setting from userData
        const moveStep = car.userData.direction.clone().multiplyScalar(car.userData.speed * 100 * deltaTime);
        car.position.add(moveStep); // Move the group

        const segPos = segment.position;
        // Use DRIVING LANE dimensions for boundary checks
        const halfDrivingWidth = segment.width / 2;   // Visual width of driving lane (X extent for vertical, Z extent for horizontal)
        const halfDrivingLength = segment.length / 2; // Visual length of driving lane (Z extent for vertical, X extent for horizontal)


        let needsReverse = false;

         // Check bounds based on segment orientation and direction
         if (Math.abs(segment.rotationY) < 0.1) { // Vertical segment (moves along Z)
             // Use driving lane length (segment.length) for Z bounds check
             if ((car.userData.direction.z > 0 && car.position.z > segPos.z + halfDrivingLength) || // Moving North past top edge
                 (car.userData.direction.z < 0 && car.position.z < segPos.z - halfDrivingLength)) { // Moving South past bottom edge
                 car.position.z = THREE.MathUtils.clamp(car.position.z, segPos.z - halfDrivingLength, segPos.z + halfDrivingLength); // Clamp
                 needsReverse = true;
             }
         } else { // Horizontal segment (moves along X)
             // Use driving lane width (segment.width) for X bounds check
             if ((car.userData.direction.x > 0 && car.position.x > segPos.x + halfDrivingWidth) || // Moving East past right edge
                 (car.userData.direction.x < 0 && car.position.x < segPos.x - halfDrivingWidth)) { // Moving West past left edge
                 car.position.x = THREE.MathUtils.clamp(car.position.x, segPos.x - halfDrivingWidth, segPos.x + halfDrivingWidth); // Clamp
                 needsReverse = true;
             }
         }


        if (needsReverse) {
            car.userData.direction.negate();
            car.rotation.y += Math.PI; // Turn 180 degrees
             // Normalize rotation if needed: car.rotation.y %= (2 * Math.PI);
        }

        // Update the bounding box for the moving car group
        car.userData.boundingBox.setFromObject(car);

        if (car.userData.collisionCooldown > 0) {
             car.userData.collisionCooldown -= deltaTime;
        }
    });
}

// Handles the "fly away" physics for hit destructible objects
function handleDestructibleMovement(deltaTime) {
     destructibles.forEach(obj => {
        if (obj.userData.isFlying && obj.visible) {
            obj.position.addScaledVector(obj.userData.flyVelocity, deltaTime);
            obj.rotateOnAxis(obj.userData.flyRotationAxis, obj.userData.flyRotationSpeed);
            obj.userData.flyVelocity.y -= 9.8 * deltaTime * 2; // Gravity

            if (obj.position.y < -5) { // When it falls below ground
                 obj.visible = false; // Hide it
                 obj.userData.isFlying = false; // Stop processing
            }
        }
     });
}

// Checks for collisions between player and other objects (dynamic only now)
function checkCollisions() {
    // Player vs Destructibles (Trash Cans / Mailboxes)
    destructibles.forEach(obj => {
        if (obj && obj.userData && obj.userData.boundingBox && !obj.userData.boundingBox.isEmpty()) {
            if (obj.userData.isActive && !obj.userData.isFlying && obj.visible && playerCarBoundingBox.intersectsBox(obj.userData.boundingBox)) {
                score += currentGameSettings.scoreHitObject; // Use setting
                flashScore(false);
                obj.userData.isActive = false;
                obj.userData.isFlying = true;

                // Decrement appropriate counter
                if (obj.userData.type === 'trashcan') {
                    trashCansRemaining--;
                    console.log("Trash cans remaining:", trashCansRemaining); // Debug log
                } else if (obj.userData.type === 'mailbox') {
                    mailboxesRemaining--;
                }
                updateCountersDisplay(); // Update UI

                // Check for win condition (only after hitting a trash can)
                if (obj.userData.type === 'trashcan' && trashCansRemaining <= 0) {
                    triggerWin();
                }

                // Calculate fly-away physics properties
                const flyDir = new THREE.Vector3().subVectors(obj.position, playerCar.position).normalize();
                flyDir.y = 1.0 + Math.random() * 0.5;
                obj.userData.flyVelocity.copy(flyDir).multiplyScalar(15 + Math.random() * 10);
            }
        }
    });

    // Player vs Traffic
    trafficCars.forEach(car => {
        if (car.userData.collisionCooldown <= 0 && playerCarBoundingBox.intersectsBox(car.userData.boundingBox)) {
            score += currentGameSettings.scorePenaltyTraffic; // Use setting
            car.userData.collisionCooldown = 1.0;
            flashScore(true);
            triggerScreenShake();
        }
    });
}

// Checks if the player is driving off the defined road network (including sidewalks)
function checkOffRoad(deltaTime) {
    // Use a positive buffer to be more lenient near edges/intersections
    const offRoadBuffer = 1.0; // Allow center to be this far outside the strict TOTAL bounds
    if (!isPositionOnRoad(playerCar.position, offRoadBuffer)) {
        const penalty = currentGameSettings.scorePenaltyOffroadPerSec * deltaTime; // Use setting
        score += penalty;
        // Only flash if score actually decreased (penalty is negative)
        if (penalty < 0) {
            flashScore(true);
        }
    }
}

// Updates the camera position and look-at target to follow the player car
function updateCamera() {
    // Only update camera to follow car if game is running
    if (gameState !== 'running' || !playerCar) return;

    const cameraOffset = new THREE.Vector3(0, 6, 12);
    const offsetRotated = cameraOffset.clone().applyQuaternion(playerCar.quaternion);
    const cameraTargetPosition = playerCar.position.clone().add(offsetRotated);
    camera.position.lerp(cameraTargetPosition, 0.15); // Smooth camera movement

    const lookAtTarget = playerCar.position.clone();
    const lookAheadDistance = 5.0;
    const lookAheadVector = new THREE.Vector3(0, 0, -lookAheadDistance); // Vector pointing forward locally
    lookAheadVector.applyQuaternion(playerCar.quaternion); // Rotate to world space
    lookAtTarget.add(lookAheadVector); // Add to car position
    camera.lookAt(lookAtTarget);
}


// --- UI and Feedback ---
function updateScoreDisplay() {
    // Ensure score doesn't visually go below 0 if game over condition is slightly different
    scoreDisplay.innerText = `Score: ${Math.max(0, Math.floor(score))}`;
}

// Update counter display
function updateCountersDisplay() {
    if (trashCounterDisplay) {
        trashCounterDisplay.innerText = `Trash Cans: ${trashCansRemaining}`;
    }
    if (mailboxCounterDisplay) {
        mailboxCounterDisplay.innerText = `Mailboxes: ${mailboxesRemaining}`;
    }
}


function flashScore(isPenalty) {
    // Use red flash for penalties, could add a green/neutral flash otherwise
    if (isPenalty) {
        scoreDisplay.classList.add('score-flash-red');
        setTimeout(() => {
            scoreDisplay.classList.remove('score-flash-red');
        }, 150);
    }
    // Add else block here for non-penalty flash if desired
}

function triggerScreenShake() {
    const shakeIntensity = 10;
    const shakeDuration = 120;
    const startTime = Date.now();
    const originalLookAt = new THREE.Vector3();

    function shake() {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < shakeDuration && gameState === 'running') {
            const currentLookAt = camera.getWorldDirection(originalLookAt).multiplyScalar(10).add(camera.position);
            const shakeX = (Math.random() - 0.5) * shakeIntensity;
            const shakeY = (Math.random() - 0.5) * shakeIntensity;
            camera.position.x += shakeX;
            camera.position.y += shakeY;
            camera.lookAt(currentLookAt.x + shakeX * 2, currentLookAt.y + shakeY * 2, currentLookAt.z);
            requestAnimationFrame(shake);
        } else if (gameState === 'running') {
             updateCamera(); // Restore smooth camera movement
        }
    }
    shake();
}


// --- Game State Management ---

// Function to start the actual game (called by button)
function startGame() {
    console.log("Starting game...");
    startScreen.style.display = 'none'; // Hide start screen
    uiContainer.style.display = 'flex'; // Show game UI

    // Perform a full reset to create game elements based on current settings
    fullGameReset(); // Calls create functions

    // Set initial game state AFTER reset
    gameState = 'running';
    score = 100; // Start score for a new game
    keys = {}; // Clear any keys pressed during intro
    updateScoreDisplay(); // Show initial score
    updateCountersDisplay(); // Show initial counters

    // Set camera for gameplay
    setupGameCamera();
}

function triggerGameOver() {
    if (gameState === 'gameOver' || gameState === 'win') return; // Prevent triggering if already over/won
    console.log("Game Over!");
    gameState = 'gameOver';

    // Show start/game over screen
    startScreen.style.display = 'flex';
    // Update text for game over
    startTitle.innerText = 'Game Over!';
    startButton.innerText = 'Crash Again?';

    // Hide game UI
    uiContainer.style.display = 'none';

    // Position car for display
    if(playerCar) {
        playerCar.position.set(0, 1, 0);
        playerCar.rotation.y = Math.PI * 0.8; // Rotate slightly
    }
    // Position camera for display
    setupIntroCamera();
}

// --- Trigger Win State ---
function triggerWin() {
    if (gameState === 'win' || gameState === 'gameOver') return; // Prevent triggering if already won/over
    console.log("You Win!");
    gameState = 'win';

    // Show start/win screen
    startScreen.style.display = 'flex';
    // Update text for win
    startTitle.innerText = 'You Win!';
    startButton.innerText = 'Play Again?';

    // Hide game UI
    uiContainer.style.display = 'none';

    // Position car for display
    if(playerCar) {
        playerCar.position.set(0, 1, 0);
        playerCar.rotation.y = Math.PI * 0.8; // Rotate slightly
    }
    // Position camera for display
    setupIntroCamera();
}


// Renamed restartGame to fullGameReset for clarity when settings change
function fullGameReset() {
    console.log("Performing full game reset...");

    // Reset counters (will be repopulated by createDestructibles)
    trashCansRemaining = 0;
    mailboxesRemaining = 0;

    // Remove ALL generated objects from the scene
    // Dispose of geometries/materials if necessary (optional)

    // Remove road segments
    roadSegments.forEach(segment => scene.remove(segment.group));
    roadSegments = [];

    // Remove houses
    houses.forEach(house => scene.remove(house));
    houses = [];

    // Remove trees
    trees.forEach(tree => scene.remove(tree));
    trees = [];

    // Remove destructibles
    destructibles.forEach(obj => scene.remove(obj));
    destructibles = [];

    // Remove traffic cars
    trafficCars.forEach(car => scene.remove(car));
    trafficCars = [];

    // Remove player car (it will be recreated)
    if (playerCar) scene.remove(playerCar);
    playerCar = null; // Clear reference

    // Recreate everything based on potentially new settings
    // Ground is usually static, but recreate if needed
    // if (ground) scene.remove(ground); createGround();

    createRoadNetwork(); // Uses constants, assumed not changed by user
    createHouses();      // Uses currentGameSettings.houseCount
    createTrees();       // Uses currentGameSettings.treeCount
    createPlayerCar();   // Recreates player car
    createDestructibles(); // Uses currentGameSettings.numDestructibles & updates counters
    createTraffic();     // Uses currentGameSettings.numTrafficCars & trafficSpeed

    console.log("Full reset complete.");
}

// Standard restart (e.g., after game over, no settings changed)
// Kept separate in case we want different behavior later, but currently calls fullGameReset
function restartGame() {
    console.log("Restarting game (standard)...");
    // For now, a standard restart does the same as a full reset via startGame
    // to ensure consistency, especially if game state got weird.
    // If performance becomes an issue, optimize this to only reset dynamic elements.
    startGame(); // startGame now handles the reset and state changes
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1); // Clamp delta time

    // Handle logic based on game state
    switch (gameState) {
        case 'intro':
        case 'gameOver':
        case 'win':
            // Rotate the player car for display
            if (playerCar) {
                playerCar.rotation.y += 0.005; // Slow rotation
            }
            // Ensure intro camera is set (might be needed if coming from game over/win)
            // setupIntroCamera(); // Usually not needed every frame unless camera moves
            break;
        case 'running':
            updateGameLogic(deltaTime); // Update game physics, collisions, etc.
            break;
        // case 'paused': // Example if pause state is added
        //     // Do nothing or only render
        //     break;
    }

    // Always render the scene
    renderer.render(scene, camera);
}

// --- Start the game ---
init(); // Initialize and show intro screen
