import * as THREE from 'three';

// --- Core Variables ---
let scene, camera, renderer;
let playerCar, playerCarBoundingBox; // playerCar will now be a Group
let clock = new THREE.Clock();
let keys = {}; // Keyboard state
let score = 100; // Start score at 100
let gameState = 'running'; // 'running', 'gameOver'

// --- Game Constants ---
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

// --- UPDATED CONSTANTS ---
const PLAYER_SPEED = 0.3;
const TURN_SPEED = 0.03;
const SCORE_HIT_OBJECT = 15; // Points for hitting trash can OR mailbox
const SCORE_PENALTY_TRAFFIC = -20;
const SCORE_PENALTY_OFFROAD_PER_SEC = -10;
const NUM_DESTRUCTIBLES = 200; // Total number of trash cans + mailboxes
const NUM_TRAFFIC_CARS = 40; // Adjusted for grid size
const TRAFFIC_SPEED = 0.2;
const HOUSE_COUNT = 400; // Adjusted for grid size
const TREE_COUNT = 1000; // Adjusted for grid size
// --- END UPDATED CONSTANTS ---


// --- Game Objects ---
let ground;
let roadSegments = []; // Array to hold road segment data (group, dims, etc.)
let destructibles = []; // Holds both trash cans and mailboxes
let trafficCars = []; // Will hold AI car Groups
let houses = []; // Holds house groups
let trees = []; // Holds tree groups
let lights = {};


// --- UI Elements ---
const scoreDisplay = document.getElementById('score-display');
const gameOverDisplay = document.getElementById('game-over');
const restartButton = document.getElementById('restart-button');

// --- Materials (Define some reused materials with more visual interest) ---
const drivingLaneMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 }); // Darker grey for driving lane
const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 }); // Lighter grey for sidewalk base
const trashCanMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3, roughness: 0.6 }); // Grey trash cans
const mailboxBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3333dd, metalness: 0.4, roughness: 0.5 }); // Blue mailbox body
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
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    // Adjust fog based on new world size
    scene.fog = new THREE.Fog(0x87ceeb, WORLD_SIZE_X * 0.4, WORLD_SIZE_X * 1.2); // Adjust fog distances

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Adjust starting camera position for the new layout
    camera.position.set(0, 30, HALF_GRID_SPAN + 40); // Move camera back slightly more
    // camera.lookAt(0, 0, 0); // Will look at car later

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

    // Create Environment
    createGround();      // Adjust ground size
    createRoadNetwork(); // *** Creates roads WITH sidewalks ***
    createHouses();      // Creates multiple houses
    createTrees();       // Creates multiple trees

    // Create Player Car (Now a Group)
    createPlayerCar(); // Adjust starting position

    // Create Destructible Objects (Trash Cans and Mailboxes)
    createDestructibles(); // Placement logic updated for sidewalks

    // Create AI Traffic (Now Groups)
    createTraffic(); // Uses driving lane dimensions

    // Event Listeners
    setupEventListeners();

    // Start Animation Loop
    animate();
    console.log("Initialization complete.");
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
    // Geometry dimensions (width is X, length is Z BEFORE rotation)
    const baseGeometry = new THREE.BoxGeometry(totalWidth, 0.08, totalLength); // Slightly thicker base
    const baseMesh = new THREE.Mesh(baseGeometry, sidewalkMaterial);
    baseMesh.position.y = -0.01; // Position slightly below driving lane
    baseMesh.receiveShadow = true;
    roadGroup.add(baseMesh);

    // 2. Create Driving Lane (on top)
    // Geometry dimensions (width is X, length is Z BEFORE rotation)
    const drivingLaneGeometry = new THREE.BoxGeometry(drivingLaneWidth, 0.1, drivingLaneLength);
    const drivingLaneMesh = new THREE.Mesh(drivingLaneGeometry, drivingLaneMaterial);
    drivingLaneMesh.position.y = 0; // Position at y=0
    drivingLaneMesh.receiveShadow = true;
    roadGroup.add(drivingLaneMesh);

    // Position and rotate the whole group
    roadGroup.position.copy(position);
    roadGroup.rotation.y = rotationY;

    scene.add(roadGroup);

    // Store segment data including calculated *visual* dimensions for driving lane and total area
    let visualDrivingWidth, visualDrivingLength;
    let visualTotalWidth, visualTotalLength;

    if (Math.abs(rotationY) < 0.1) { // Vertical road (Rot 0)
        visualDrivingWidth = drivingLaneWidth;
        visualDrivingLength = drivingLaneLength;
        visualTotalWidth = totalWidth;
        visualTotalLength = totalLength;
    } else { // Horizontal road (Rot PI/2)
        visualDrivingWidth = drivingLaneLength; // Visual width (X) is geometry Z length
        visualDrivingLength = drivingLaneWidth;  // Visual length (Z) is geometry X width
        visualTotalWidth = totalLength;         // Visual total width (X) is base geometry Z length
        visualTotalLength = totalWidth;          // Visual total length (Z) is base geometry X width
    }

    roadSegments.push({
        group: roadGroup, // Store reference to the group if needed
        // Driving Lane dimensions (for AI traffic bounds)
        width: visualDrivingWidth,
        length: visualDrivingLength,
        // Total dimensions including sidewalks (for player off-road check)
        totalWidth: visualTotalWidth,
        totalLength: visualTotalLength,
        position: position.clone(),
        rotationY: rotationY
    });
    return roadGroup;
}


// *** ROAD LAYOUT FUNCTION for 5x5 Grid ***
function createRoadNetwork() {
    roadSegments = []; // Clear existing
    const roadY = 0;
    const drivingLaneW = ROAD_WIDTH; // Use driving lane width for geometry
    // Make roads long enough to span the grid area plus some extra
    const drivingLaneL = Math.max(WORLD_SIZE_X, WORLD_SIZE_Z) * 0.9; // Length based on world size

    console.log("Creating 5x5 road grid network with sidewalks...");

    // Calculate starting position for the grid (center-relative)
    const startOffset = -HALF_GRID_SPAN; // e.g., -2 * BLOCK_SIZE for 5x5

    // Create N-S Roads (Vertical)
    for (let i = 0; i < GRID_SIZE; i++) {
        const xPos = startOffset + i * BLOCK_SIZE;
        // Vertical roads: Geometry width = drivingLaneW, Geometry length = drivingLaneL
        createRoadSegment(drivingLaneW, drivingLaneL, new THREE.Vector3(xPos, roadY, 0), 0);
    }

    // Create E-W Roads (Horizontal)
    for (let i = 0; i < GRID_SIZE; i++) {
        const zPos = startOffset + i * BLOCK_SIZE;
        // Horizontal roads: Geometry width = drivingLaneW, Geometry length = drivingLaneL
        createRoadSegment(drivingLaneW, drivingLaneL, new THREE.Vector3(0, roadY, zPos), Math.PI / 2);
    }

    console.log(`Created ${roadSegments.length} road segments.`);
}

// Creates a single house mesh group
function createHouse(position, rotationY) {
    const baseWidth = 5 + Math.random() * 8;
    const baseDepth = 5 + Math.random() * 8;
    const baseHeight = 4 + Math.random() * 5;
    const roofHeight = baseHeight * (0.5 + Math.random() * 0.3);

    // Use slightly varied colors and material properties
    const baseColor = new THREE.Color(0xaaaaaa).lerp(new THREE.Color(0xdddddd), Math.random());
    const roofColor = new THREE.Color(0x8B4513).lerp(new THREE.Color(0x666666), Math.random());

    const houseGroup = new THREE.Group();

    // Base
    const baseGeometry = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.8 + Math.random() * 0.2, // Add some variation
        metalness: 0.1
     });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.name = "house_base"; // Name for easy reference
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    houseGroup.add(baseMesh);

    // Roof
    const roofRadius = Math.sqrt(baseWidth*baseWidth + baseDepth*baseDepth) / 2 * 1.1;
    const roofGeometry = new THREE.ConeGeometry(roofRadius, roofHeight, 4);
    const roofMaterial = new THREE.MeshStandardMaterial({
        color: roofColor,
        roughness: 0.7 + Math.random() * 0.2,
        metalness: 0.0
    });
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    roofMesh.position.y = baseHeight + roofHeight / 2;
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    houseGroup.add(roofMesh);

    // Position and rotate the whole group
    houseGroup.position.copy(position);
    houseGroup.rotation.y = rotationY;
    houseGroup.position.y = 0;

    // Add userData for collision
    houseGroup.userData = {
        type: 'house', // Identify object type
        // *** Use bounding box of the BASE MESH for tighter collision ***
        boundingBox: new THREE.Box3().setFromObject(baseMesh)
    };
    // Update bounding box after positioning the parent group
    houseGroup.updateMatrixWorld(true); // Ensure world matrix is updated
    // Recalculate box based on the base mesh's world matrix
    houseGroup.userData.boundingBox.setFromObject(baseMesh, true); // Use precise=true if available


    scene.add(houseGroup);
    return houseGroup;
}

// Creates multiple houses in valid locations (avoids roads+sidewalks)
function createHouses() {
    houses = []; // Clear existing
    console.log(`Attempting to place ${HOUSE_COUNT} houses...`);
    let placedCount = 0;
    for (let i = 0; i < HOUSE_COUNT; i++) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 30) {
            attempts++;
            // Place within the defined world area
            const x = (Math.random() - 0.5) * WORLD_SIZE_X;
            const z = (Math.random() - 0.5) * WORLD_SIZE_Z;
            const potentialPos = new THREE.Vector3(x, 0, z);

            // Check if the position is off the road AND sidewalks
            // Use a buffer slightly larger than half the total road width
            const checkBuffer = TOTAL_ROAD_WIDTH / 2 + 2.0; // House base should be > 2 units from road center line
            if (!isPositionOnRoad(potentialPos, checkBuffer)) {
                 const rotation = Math.random() * Math.PI * 2;
                 const newHouse = createHouse(potentialPos, rotation);
                 // Check collision with existing houses before adding
                 let houseCollision = false;
                 for(const existingHouse of houses) {
                     // Check if bounding boxes exist before intersecting
                     if (newHouse.userData.boundingBox && existingHouse.userData.boundingBox &&
                         newHouse.userData.boundingBox.intersectsBox(existingHouse.userData.boundingBox)) {
                         houseCollision = true;
                         break;
                     }
                 }
                 if (!houseCollision) {
                    houses.push(newHouse);
                    placed = true;
                    placedCount++;
                 } else {
                     // Optional: remove the temporary house from scene if collision detected
                     scene.remove(newHouse);
                 }
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
    // Vary trunk color slightly
    const trunkColor = new THREE.Color(0x8B4513).multiplyScalar(0.8 + Math.random() * 0.4);
    const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9, metalness: 0.0 });
    const trunkMesh = new THREE.Mesh(trunkGeom, trunkMat);
    trunkMesh.name = "tree_trunk"; // Name for easy reference
    trunkMesh.position.y = trunkHeight / 2;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // Leaves (Cone shape)
    const leavesGeom = new THREE.ConeGeometry(leavesRadius, leavesHeight, 8);
    // Vary leaves color slightly
    const leavesColor = new THREE.Color(0x228B22).multiplyScalar(0.7 + Math.random() * 0.6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: leavesColor, roughness: 0.9, metalness: 0.0 });
    const leavesMesh = new THREE.Mesh(leavesGeom, leavesMat);
    leavesMesh.position.y = trunkHeight + leavesHeight / 2 * 0.8;
    leavesMesh.castShadow = true;
    // leavesMesh.receiveShadow = true; // Leaves often don't need to receive shadows
    treeGroup.add(leavesMesh);

    treeGroup.position.copy(position);
    treeGroup.position.y = 0;

     // Add userData for collision
    treeGroup.userData = {
        type: 'tree', // Identify object type
        // *** Use bounding box of the TRUNK MESH for tighter collision ***
        boundingBox: new THREE.Box3().setFromObject(trunkMesh)
    };
    // Update bounding box after positioning the parent group
    treeGroup.updateMatrixWorld(true); // Ensure world matrix is updated
    // Recalculate box based on the trunk mesh's world matrix
    treeGroup.userData.boundingBox.setFromObject(trunkMesh, true); // Use precise=true if available


    scene.add(treeGroup);
    return treeGroup;
}

// Creates multiple trees in valid locations (avoids roads+sidewalks, houses, other trees)
function createTrees() {
    trees = []; // Clear existing
    console.log(`Attempting to place ${TREE_COUNT} trees...`);
    let placedCount = 0;
    for (let i = 0; i < TREE_COUNT; i++) {
         let placed = false;
         let attempts = 0;
         while (!placed && attempts < 30) {
             attempts++;
             // Place within the defined world area
             const x = (Math.random() - 0.5) * WORLD_SIZE_X;
             const z = (Math.random() - 0.5) * WORLD_SIZE_Z;
             const potentialPos = new THREE.Vector3(x, 0, z);

             // Check if the position is off road AND sidewalks
             const checkBuffer = TOTAL_ROAD_WIDTH / 2 + 1.0; // Tree base should be > 1 unit from road center line
             if (!isPositionOnRoad(potentialPos, checkBuffer)) {
                 let tooCloseToHouse = false;
                 for (const house of houses) {
                     if (potentialPos.distanceTo(house.position) < 8) { // Min distance from houses (center check)
                         tooCloseToHouse = true;
                         break;
                     }
                 }
                 let tooCloseToTree = false;
                 for (const tree of trees) {
                     if (potentialPos.distanceTo(tree.position) < 3.0) { // Min distance between trees
                         tooCloseToTree = true;
                         break;
                     }
                 }

                 if (!tooCloseToHouse && !tooCloseToTree) {
                     const newTree = createTree(potentialPos);
                     // Check collision with existing houses/trees using tighter box before adding
                     let staticCollision = false;
                     for(const existingHouse of houses) {
                         // Check bounding boxes exist
                         if (newTree.userData.boundingBox && existingHouse.userData.boundingBox &&
                             newTree.userData.boundingBox.intersectsBox(existingHouse.userData.boundingBox)) {
                             staticCollision = true; break;
                         }
                     }
                     if (!staticCollision) {
                         for(const existingTree of trees) {
                              // Check bounding boxes exist
                             if (newTree.userData.boundingBox && existingTree.userData.boundingBox &&
                                 newTree.userData.boundingBox.intersectsBox(existingTree.userData.boundingBox)) {
                                 staticCollision = true; break;
                             }
                         }
                     }

                     if (!staticCollision) {
                        trees.push(newTree);
                        placed = true;
                        placedCount++;
                     } else {
                         scene.remove(newTree); // Remove temporary tree
                     }
                 }
             }
         }
    }
    console.log(`Successfully placed ${placedCount} trees.`);
}

// Creates the player's controllable car (Refined Station Wagon style with SVG logo)
function createPlayerCar() {
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
    const rearHeight = 0.9;
    const rearLength = carLength - (cabinLength + (carLength * 0.5 + cabinOffsetZ)); // Calculate remaining length

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
    // --- End Volvo Logo SVG Decal ---


    // Set position and rotation for the whole group
    playerCar.position.set(0, 0.5, BLOCK_SIZE); // Start on road at X=0, Z=BLOCK_SIZE
    playerCar.rotation.y = 0; // Face South initially

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
    console.log("Player car created at:", playerCar.position);
}


// Creates destructible objects (bins and mailboxes) along road edges (on sidewalks)
function createDestructibles() {
    destructibles = []; // Clear existing
    console.log(`Attempting to place ${NUM_DESTRUCTIBLES} destructibles (Trash Cans & Mailboxes)...`);
    let placedCount = 0;

    for (let i = 0; i < NUM_DESTRUCTIBLES; i++) {
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
                 } else { // 40% chance of mailbox
                     obj = new THREE.Group(); // Mailbox is a group
                     const post = new THREE.Mesh(mailboxPostGeometry, mailboxPostMaterial);
                     const body = new THREE.Mesh(mailboxBodyGeometry, mailboxBodyMaterial);
                     post.position.y = 1.2 / 2; // Post base at y=0
                     body.position.y = 1.2 + (0.5 / 2); // Body sits on top of post
                     body.position.z = -0.1; // Slight offset if needed
                     obj.add(post);
                     obj.add(body);
                     obj.position.copy(potentialPos); // Position the group
                     obj.userData.type = 'mailbox';
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
    console.log(`Successfully placed ${placedCount} destructibles.`);
}


// Creates AI traffic cars (Groups with wheels) on road segments
function createTraffic() {
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
    trafficCars = [];

    console.log(`Attempting to place ${NUM_TRAFFIC_CARS} traffic cars...`);
    let carIndex = 0;
    // Distribute cars somewhat evenly across segments
    const carsPerSegment = Math.max(1, Math.floor(NUM_TRAFFIC_CARS / roadSegments.length));

    for (let i = 0; i < roadSegments.length && carIndex < NUM_TRAFFIC_CARS; i++) {
        const segment = roadSegments[i]; // Get segment data
        // Add a calculated number of cars to this segment
        for (let j = 0; j < carsPerSegment && carIndex < NUM_TRAFFIC_CARS; j++) {
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
                speed: TRAFFIC_SPEED * (0.8 + Math.random() * 0.4),
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
     while (carIndex < NUM_TRAFFIC_CARS && roadSegments.length > 0) {
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
         carGroup.userData = { segmentIndex: segmentIndex, direction: direction, speed: TRAFFIC_SPEED * (0.8 + Math.random() * 0.4), collisionCooldown: 0, boundingBox: new THREE.Box3().setFromObject(carGroup) };
         carGroup.updateMatrixWorld(true); carGroup.userData.boundingBox.setFromObject(carGroup);

         scene.add(carGroup); trafficCars.push(carGroup); carIndex++;
     }
     console.log(`Successfully created ${trafficCars.length} traffic cars.`);
}


// --- Event Handling ---
function setupEventListeners() {
    window.addEventListener('keydown', (event) => {
        keys[event.code] = true;
        if (gameState === 'gameOver' && event.code === 'Enter') {
            restartGame();
        }
    });
    window.addEventListener('keyup', (event) => {
        keys[event.code] = false;
    });
    window.addEventListener('resize', onWindowResize, false);
    restartButton.addEventListener('click', restartGame);
    console.log("Event listeners set up.");
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    if (gameState !== 'running') return;

    handlePlayerMovement(deltaTime); // Now includes static collision response
    handleTrafficMovement(deltaTime); // Uses driving lane bounds
    handleDestructibleMovement(deltaTime);
    checkCollisions(); // Checks dynamic collisions (traffic, destructibles)
    checkOffRoad(deltaTime); // Uses total road bounds + buffer
    updateCamera();
    updateScoreDisplay();

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

    if (keys['ArrowUp'] || keys['KeyW']) { moveDistance = PLAYER_SPEED * 100 * deltaTime; }
    if (keys['ArrowDown'] || keys['KeyS']) { moveDistance = -PLAYER_SPEED * 80 * deltaTime; }
    if (keys['ArrowLeft'] || keys['KeyA']) { rotationAmount = TURN_SPEED; }
    if (keys['ArrowRight'] || keys['KeyD']) { rotationAmount = -TURN_SPEED; }

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
            // Update obstacle bounding box based on its current world matrix before check
            // This is important if obstacles could potentially move (though they don't here)
            // obstacle.updateMatrixWorld(true); // Ensure world matrix is up-to-date
            // obstacle.userData.boundingBox.setFromObject(obstacle.getObjectByName(obstacle.userData.type === 'house' ? 'house_base' : 'tree_trunk'), true);

            // Simpler: Assume static obstacle bounding boxes calculated at creation are correct in world space
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
        // Check if object exists, is active, not flying, visible, and intersects
        // Ensure bounding box is updated if object is animated (though these aren't)
        if (obj && obj.userData && obj.userData.boundingBox && !obj.userData.boundingBox.isEmpty()) { // Add checks for userData and boundingBox validity
             // Bounding box for destructibles is calculated once at creation and should be okay unless they animate when not flying
             // obj.userData.boundingBox.setFromObject(obj); // Recalculate if needed
            if (obj.userData.isActive && !obj.userData.isFlying && obj.visible && playerCarBoundingBox.intersectsBox(obj.userData.boundingBox)) {
                // console.log("Hit Destructible:", obj.userData.type);
                score += SCORE_HIT_OBJECT; // Award points
                flashScore(false); // Flash score display (green/default)
                obj.userData.isActive = false; // Deactivate to prevent multiple hits
                obj.userData.isFlying = true;  // Start flying animation

                // Calculate fly-away physics properties
                const flyDir = new THREE.Vector3().subVectors(obj.position, playerCar.position).normalize();
                flyDir.y = 1.0 + Math.random() * 0.5; // Add upward component
                obj.userData.flyVelocity.copy(flyDir).multiplyScalar(15 + Math.random() * 10); // Set velocity
            }
        }
    });

    // Player vs Traffic
    trafficCars.forEach(car => { // car is a Group
        // Check cooldown and intersection using the car group's bounding box
        if (car.userData.collisionCooldown <= 0 && playerCarBoundingBox.intersectsBox(car.userData.boundingBox)) {
            // console.log("Hit Traffic!");
            score += SCORE_PENALTY_TRAFFIC; // Apply penalty
            car.userData.collisionCooldown = 1.0; // Start cooldown
            flashScore(true); // Flash score display (red)
            triggerScreenShake(); // *** Trigger screen shake on collision ***
        }
    });

    // Note: Static object collision (player vs house/tree) is now handled
    // directly within handlePlayerMovement for immediate response.
}

// Checks if the player is driving off the defined road network (including sidewalks)
function checkOffRoad(deltaTime) {
    // Use a positive buffer to be more lenient near edges/intersections
    const offRoadBuffer = 1.0; // Allow center to be this far outside the strict TOTAL bounds
    if (!isPositionOnRoad(playerCar.position, offRoadBuffer)) {
        const penalty = SCORE_PENALTY_OFFROAD_PER_SEC * deltaTime;
        score += penalty;
        // Only flash if score actually decreased (penalty is negative)
        if (penalty < 0) {
            flashScore(true);
        }
        // console.log("Off road! Score:", score);
    }
}

// Updates the camera position and look-at target to follow the player car
function updateCamera() {
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
    const shakeIntensity = 1;
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
function triggerGameOver() {
    if (gameState === 'gameOver') return; // Prevent multiple triggers
    console.log("Game Over!");
    gameState = 'gameOver';
    gameOverDisplay.style.display = 'block'; // Show UI
}

function restartGame() {
    console.log("Restarting Game...");
    score = 100; // Reset score to 100
    gameState = 'running';
    gameOverDisplay.style.display = 'none';
    keys = {};

    // Reset Player Position
    playerCar.position.set(0, 0.5, BLOCK_SIZE); // Reset to starting pos on road
    playerCar.rotation.y = 0; // Reset rotation
    playerCar.updateMatrixWorld();

    // Remove old dynamic objects
    destructibles.forEach(obj => { if (obj.parent) obj.parent.remove(obj); });
    destructibles = [];
    trafficCars.forEach(car => { if (car.parent) car.parent.remove(car); });
    trafficCars = [];

    // --- IMPORTANT: Also remove static objects if they are added directly to scene ---
    // If houses/trees arrays hold references to objects added to scene, remove them too before recreating
    // houses.forEach(house => { if (house.parent) house.parent.remove(house); });
    // trees.forEach(tree => { if (tree.parent) tree.parent.remove(tree); });
    // --- Then clear the arrays ---
    // houses = [];
    // trees = [];
    // --- And recreate them ---
    // createHouses(); // If static objects need reset/randomization
    // createTrees();

    // Recreate dynamic elements
    createDestructibles();
    createTraffic();

    // Reset Camera
    updateCamera();

    updateScoreDisplay();
    console.log("Game Restarted.");
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1); // Clamp delta time

    if (gameState === 'running') {
        updateGameLogic(deltaTime);
    }
    // Always render, even if game over, to show final state
    renderer.render(scene, camera);
}

// --- Start the game ---
init();
