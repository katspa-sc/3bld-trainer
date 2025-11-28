// Indices for standard facelet order (U R F D L B)
const CORNER_FACELET_INDICES = [0, 2, 6, 8, 9, 11, 15, 17, 18, 20, 24, 26, 27, 29, 33, 35, 36, 38, 42, 44, 45, 47, 51, 53];
const EDGE_FACELET_INDICES = [1, 3, 5, 7, 10, 12, 14, 16, 19, 21, 23, 25, 28, 30, 32, 34, 37, 39, 41, 43, 46, 48, 50, 52];

let previousScramble = "";
let previousCycle = "";
let sessionQueue = [];
let upcomingAlgTest = null;

function tryNotify() {
    const options = isHypeMode ? hypeDrillOptions : regularDrillOptions; // Use hype or regular options
    const text = options[Math.floor(Math.random() * options.length)];
    const rate = isHypeMode ? 1.3 : 1.5; // Faster rate for hype mode
    speakText(text, rate, false, isHypeMode);
}

function getStorageKey(baseKey) {
    return `${currentMode}_${baseKey}`; // Prefix the key with the current mode (e.g., "corner_fetchedAlgs")
}

var PROXY_URL = "";

const hypeModeCheckbox = document.getElementById("hypeModeCheckbox");

// Default to "false" if no mode is saved in localStorage
const savedHypeMode = localStorage.getItem("hypeMode") === "true";
let isHypeMode = savedHypeMode;

// Set the initial state of the checkbox
hypeModeCheckbox.checked = isHypeMode;

// Add an event listener to handle checkbox changes
hypeModeCheckbox.addEventListener("change", function () {
    isHypeMode = this.checked; // Update the mode
    localStorage.setItem("hypeMode", isHypeMode); // Save the mode to localStorage

    console.log(`Hype Mode switched to: ${isHypeMode ? "enabled" : "disabled"}`);
});

let drillingPairs = [];
let currentDrillingPair = null;
let isSecondInPair = false;
let totalDrillPairs = 0;

let isFirstDrillRun = true;  // To fix the initial jingle problem
let shouldReadDrillTTS = true; // To control TTS readouts during drills

function initializeDrillingPairs(algsFromTextarea) {
    console.log("Initializing drilling session from textbox content...");
    
    // Create a map of the *full* alg set (comm -> key) to find inverses.
    const fullAlgMap = new Map(fetchedAlgs.map(item => [item.value.trim(), item.key.trim()]));
    
    // Create a map of (key -> inverseKey) for quick lookup
    const inverseKeyMap = new Map();
    fetchedAlgs.forEach(item => {
        const inverseKey = item.key[1] + item.key[0];
        inverseKeyMap.set(item.key, inverseKey);
    });

    // Create a map of (key -> comm) to find the inverse commutator
    const keyToCommMap = new Map(fetchedAlgs.map(item => [item.key.trim(), item.value.trim()]));

    const processed = new Set();
    drillingPairs = [];
    const missingPairs = []; // Track commutators missing their inverse

    for (const alg of algsFromTextarea) {
        const trimmedAlg = alg.trim();
        if (processed.has(trimmedAlg)) {
            continue;
        }

        const key = fullAlgMap.get(trimmedAlg);
        if (!key) continue; // Alg not found in master list, skip it.

        const inverseKey = inverseKeyMap.get(key);
        const inverseAlg = keyToCommMap.get(inverseKey);
        
        // Check if the inverse alg is also present in the user's provided list
        if (inverseAlg && algsFromTextarea.map(a => a.trim()).includes(inverseAlg.trim())) {
            drillingPairs.push([trimmedAlg, inverseAlg]);
            processed.add(trimmedAlg);
            processed.add(inverseAlg.trim());
        } else {
            // If the inverse is missing, add to the missingPairs list
            missingPairs.push(`${trimmedAlg} (${key})`); // Display the commutator and its associated letters
        }
    }

    if (drillingPairs.length === 0) {
        alert("No valid algorithm pairs found for Drilling mode based on the content of the textbox. Please check your algorithms.");
        return;
    }

    // Shuffle the pairs
    for (let i = drillingPairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [drillingPairs[i], drillingPairs[j]] = [drillingPairs[j], drillingPairs[i]];
    }

    totalDrillPairs = drillingPairs.length;
    console.log(`Found and shuffled ${totalDrillPairs} pairs for drilling.`);
    isSecondInPair = false;
    shouldReadDrillTTS = true;

    // Inform the user about missing pairs
    if (missingPairs.length > 0) {
        alert(`The following commutators were valid but had no corresponding inverse:\n${missingPairs.join("\n")}`);
        console.log("Missing pairs:", missingPairs);
    }
}

function initializeSession() {
    sessionQueue = []; // Clear the queue at the start of a new session
    upcomingAlgTest = null; // Clear any stored upcoming test

    if (isDrillingMode) {
        const boxAlgs = document.getElementById("userDefinedAlgs").value;
        const cleanedAlgs = boxAlgs.split("\n").filter(alg => alg.trim() !== "");

        if (cleanedAlgs.length === 0) {
            alert("The algorithm box is empty. Please add algorithms before starting a session.");
            return;
        }

        initializeDrillingPairs(cleanedAlgs); // This populates the global `drillingPairs` array
        sessionQueue = drillingPairs.flat(); // Flatten the pairs into a single, ordered queue
        isFirstDrillRun = true;
    } else {
        const algList = createAlgList();
        // Shuffle the list of algorithms to create a random, but sequential, order
        for (let i = algList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [algList[i], algList[j]] = [algList[j], algList[i]];
        }
        sessionQueue = algList; // This is now our session's queue
        isFirstRun = true;
    }

    repetitionCounter = 0;
    localStorage.setItem("repetitionCounter", repetitionCounter);
    document.getElementById("repetitionCounter").innerText = `${repetitionCounter}`;
    document.getElementById("progressDisplay").innerText = "Progress: 0/0";

    nextScramble();
    console.log("Session initialized. Starting a new practice session.");
}

// The "Start Session" button listener
document.getElementById("resetSessionButton").addEventListener("click", function () {
 initializeSession();
});

// This function will be called on a successful solve in drilling mode
function retryDrill() {
    const lastTest = algorithmHistory[algorithmHistory.length - 1];
    if (!lastTest) return;

    // Reset the cube to the same scramble
    cube.resetCube();
    doAlg(lastTest.scramble, false);
    updateVirtualCube();

    // Reset the timer
    document.getElementById("timer").innerHTML = "0.00";

    tryNotify();

    // Disable TTS for the next automatic scramble generation
    shouldReadDrillTTS = false;

    console.log("Drilling same algorithm:", lastTest.rawAlgs[0]);
    startTimer();
}

// This function will be called by the L4 gesture
function advanceDrill() {
    if (!isDrillingMode) return;

    console.log("L4 gesture: Advancing to next drill case...");
    stopTimer(false); // Stop any active timer

    // Enable TTS for the *new* algorithm that's about to be generated
    shouldReadDrillTTS = true;

    // Get the next algorithm in the sequence
    nextScramble();
}

const modeToggle = document.getElementById("modeToggle");
const modeToggleLabel = document.getElementById("modeToggleLabel");

// Default to "Corner" mode if no mode is saved in localStorage
const savedMode = localStorage.getItem("mode") || "corner";
let currentMode = savedMode;

// Set the initial state of the toggle and label
modeToggle.checked = currentMode === "edge";
modeToggleLabel.textContent = currentMode === "edge" ? "Edge" : "Corner";

// Add an event listener to handle toggle changes
modeToggle.addEventListener("change", function () {
    currentMode = this.checked ? "edge" : "corner"; // Update the mode
    localStorage.setItem("mode", currentMode); // Save the mode to localStorage
    modeToggleLabel.textContent = currentMode === "edge" ? "Edge" : "Corner"; // Update the label text
    updateProxyUrl(); // Update the URL for fetching algorithms

    // Load data for the selected mode
    loadFetchedAlgs();
    loadSelectedSets();
    loadStickerState();

    // Update the userDefinedAlgs textbox based on the loaded data
    updateUserDefinedAlgs();

    console.log(`Mode switched to: ${currentMode}`);
});

// Update the PROXY_URL based on the current mode
function updateProxyUrl() {
    if (currentMode === "corner") {
        PROXY_URL = 'https://commexportproxy.vercel.app/api/algs?sheet=corners';
    } else if (currentMode === "edge") {
        PROXY_URL = 'https://commexportproxy.vercel.app/api/algs?sheet=edges';
    }
  //  console.log(`PROXY_URL updated to: ${PROXY_URL}`);
}

// Call this function on page load to set the initial URL
updateProxyUrl();

const moveHistory = [];
const MAX_HISTORY_LENGTH = 10; // Limit the history to the last 10 moves

var currentRotation = "";
var currentAlgorithm = ""; //After an alg gets tested for the first time, it becomes the currentAlgorithm.
var currentScramble = "";
var algArr; //This is the array of alternatives to currentAlgorithm

var cube = new RubiksCube();
const canvas = document.getElementById("cube");
const ctx = canvas.getContext("2d");
const VIRTUAL_CUBE_SIZE = 400;
var vc = new VisualCube(1200, 1200, VIRTUAL_CUBE_SIZE, -0.523598, -0.209439, 0, 3, 0.08);
var stickerSize = canvas.width / 5;
var currentAlgIndex = 0;
var algorithmHistory = [];
var shouldRecalculateStatistics = true;

let utterance = null;
let selectedVoice = null;
let toggleFeedbackUsed = false; // Flag to track if the button has been used

// Load available voices and select a specific one
function loadVoices() {
    var voices = window.speechSynthesis.getVoices();
    var filteredVoices = voices.filter(voice => voice.lang.startsWith('pl'));

    selectedVoice = filteredVoices[0];
}

let repetitionCounter = parseInt(localStorage.getItem("repetitionCounter")) || 0;
document.getElementById("repetitionCounter").innerText = `${repetitionCounter}`;

if (localStorage.getItem("enableTTS") === null) {
    localStorage.setItem("enableTTS", "true"); // Default to enabled
}

// Ensure voices are loaded (some browsers load them asynchronously)
if (typeof speechSynthesis !== "undefined" && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
} else {
    loadVoices();
}

//Cube.initSolver();

const holdingOrientation = document.getElementById('holdingOrientation');
let currentPreorientation = "";
const initialMask = document.getElementById('initialMask');
const finalMask = document.getElementById('finalMask');

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById('version-label').textContent = `Version: ${APP_VERSION}`;
    handleOrientation();
    handleInitialMask();
    handleFinalMask();
    enableTtsOnStartup();
});

const uSideIndices = new Set([9, 10, 11, 18, 19, 20, 36, 37, 38, 45, 46, 47]);

function handleFinalMask() {
    const savedValue = localStorage.getItem('finalMask');
    if (savedValue !== null) {
        finalMask.value = savedValue;
    }
    finalMask.addEventListener('input', function () {
        localStorage.setItem('finalMask', finalMask.value);
    });
}

function handleInitialMask() {
    const savedValue = localStorage.getItem('initialMask');
    if (savedValue !== null) {
        initialMask.value = savedValue;
    }
    initialMask.addEventListener('input', function () {
        localStorage.setItem('initialMask', initialMask.value);
    });
}

function handleOrientation() {
    const savedValue = localStorage.getItem('holdingOrientation');
    if (savedValue !== null) {
        holdingOrientation.value = savedValue;
    }
    holdingOrientation.addEventListener('input', function () {
        localStorage.setItem('holdingOrientation', holdingOrientation.value);
    });

    cube.resetCube();
    updateVirtualCube();
}

// find a non-center sticker that does not move for the entire alg
function findPivot(alg) {
    let cube = new RubiksCube();
    let moves = alg.split(" ");
    let states = [];

    for (let move of moves) {
        cube.doAlgorithm(move);
        states.push(cube.getMaskValues());
    }

    // console.log(states.map(state => state.join(",")).join("\n"));

    for (let i = 0; i < 54; ++i) {
        // skip centers
        if (i % 9 == 4) continue;

        // skip U layer
        if (i < 9) continue;
        if (uSideIndices.has(i)) continue;

        let stateSet = new Set();
        for (let state of states) {
            stateSet.add(state[i]);
        }

        if (stateSet.size == 1) {
            return i;
        }
    }

    return -1;
}

// move the pivot so that it is back in its starting place
// brute force all combination of 2 rotations
function findRotationToFixPivot(pivotIndex) {
    const rotations = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"];

    for (let i = 0; i < rotations.length; ++i) {
        for (let j = 0; j < rotations.length; ++j) {
            let rotation = rotations[i] + ' ' + rotations[j];
            rotation = rotation.trim();

            // console.log(rotation);

            cube.doAlgorithm(rotation);
            if (cube.cubestate[pivotIndex][1] == pivotIndex) {
                cube.doAlgorithm(alg.cube.invert(rotation));
                return rotation;
            }

            cube.doAlgorithm(alg.cube.invert(rotation));
        }
    }

    return "rotation not found";
}

function simplifyRotation(move, rotation) {
    const rotationMap = {
        "x": { "B": "U", "F": "D", "U": "F", "D": "B", "L": "L", "R": "R" },
        "x'": { "F": "U", "B": "D", "U": "B", "D": "F", "L": "L", "R": "R" },
        "y": { "L": "F", "R": "B", "F": "R", "B": "L", "U": "U", "D": "D" },
        "y'": { "F": "L", "B": "R", "L": "B", "R": "F", "U": "U", "D": "D" },
        "z": { "U": "L", "D": "R", "L": "D", "R": "U", "F": "F", "B": "B" },
        "z'": { "U": "R", "D": "L", "L": "U", "R": "D", "F": "F", "B": "B" }
    };

    move = move.trim();
    rotation = rotation.trim();

    if (rotation in rotationMap && move[0] in rotationMap[rotation]) {
        return rotationMap[rotation][move[0]] + move.slice(1);
    }

    return move; // Return unchanged if no transformation is needed
}

function applyMoves(moves) {
    let ori = cube.wcaOrient();
    doAlg(alg.cube.invert(ori), false);
    let startingRotation = ori;
  //  console.log("starting rotation: ", startingRotation);


    let fixPivotRotation = "";

    if (algorithmHistory.length > 0) {
        var lastTest = algorithmHistory[algorithmHistory.length - 1];
        if (lastTest == undefined) {
            return;
        }


        tmp = startingRotation + " " + moves + " " + alg.cube.invert(startingRotation);
        cube.doAlgorithm(tmp);

        let pivotIndex = findPivot(commToMoves(lastTest.solutions[0]));

        if (pivotIndex != -1) {
            fixPivotRotation = findRotationToFixPivot(pivotIndex);
            // if (fixPivotRotation.length > 0) {
            //     console.log(lastTest.solutions[0], "pivot at", pivotIndex, "fix with rotation", fixPivotRotation);


            // }
        }

        cube.doAlgorithm(alg.cube.invert(tmp));

        console.log("doing alg: ", lastTest.solutions[0]);
    }

    let simplifiedMove = moves;
    for (rotation of startingRotation.split(" ")) {
        simplifiedMove = simplifyRotation(simplifiedMove, rotation);
    }

    moveHistory.push(moves);
    if (moveHistory.length > MAX_HISTORY_LENGTH) {
        moveHistory.shift(); // Remove the oldest move if history exceeds the limit
    }

    cube.doAlgorithm(
        startingRotation
        + " " +
        alg.cube.invert(holdingOrientation.value)
        + " " +
        moves
        + " " +
        holdingOrientation.value
        + " " +
        alg.cube.invert(startingRotation)
        + " " +
        fixPivotRotation
        // alg.cube.invert(fixPivotRotation)

    );

    if (fixPivotRotation.length > 0)
        console.log("need to do fpr", fixPivotRotation);


    doAlg("U U'", true);

    updateVirtualCube();

    checkForSpecialSequences();
}

let conn = null;

var connectSmartCubeElement = document.getElementById("connectSmartCube");
connectSmartCubeElement.addEventListener('click', async () => {
    await connectSmartCube();
});

// todo actually reset
var resetSessionElement = document.getElementById("resetSession");
resetSessionElement.addEventListener('click', async () => {
    await connectSmartCube();
});


// buttons

function adjustButtonWidths() {
    minButtonWidth = 100;
    var buttonGrids = document.querySelectorAll('.button-grid');
    buttonGrids.forEach(function (grid) {
        var buttons = grid.querySelectorAll('.cube-select-button');
        var containerWidth = window.innerWidth;
        var packSize = buttons.length;

        var buttonWidth = Math.min(100, ((containerWidth - 2 * 20 - (packSize + 1)) / packSize));
        buttonWidth = Math.max(30, buttonWidth);
        minButtonWidth = Math.min(buttonWidth, minButtonWidth);

        buttons.forEach(function (button) {
            button.style.width = minButtonWidth + 'px';
            button.style.height = minButtonWidth * 0.85 + 'px'; // Set height equal to width
        });
    });
}

window.addEventListener('resize', adjustButtonWidths);

function handleButtonClick(event) {
    console.log("Button clicked:", event.target.textContent);
    doAlg(event.target.textContent);
    updateVirtualCube();
}

var numCubes = 36;
var packSize = 9;
var numFullPacks = Math.floor(numCubes / packSize);
var lastPackSize = numCubes % packSize;

var container = document.getElementById("cubeSelectButtons");

document.getElementById("loader").style.display = "none";
var myVar = setTimeout(showPage, 1);
function showPage() {
    document.getElementById("page").style.display = "block";
}

for (var setting in defaults) {
    // If no previous setting exists, use default and update localStorage. Otherwise, set to previous setting
    if (typeof (defaults[setting]) === "boolean") {
        var previousSetting = localStorage.getItem(setting);
        if (previousSetting == null) {
            document.getElementById(setting).checked = defaults[setting];
            localStorage.setItem(setting, defaults[setting]);
        }
        else {
            document.getElementById(setting).checked = previousSetting == "true" ? true : false;
        }
    }
    else {
        var previousSetting = localStorage.getItem(setting);
        if (previousSetting == null) {
            var element = document.getElementById(setting)
            if (element != null) {
                element.value = defaults[setting];
            }
            localStorage.setItem(setting, defaults[setting]);
        }
        else {
            var element = document.getElementById(setting)
            if (element != null) {
                element.value = previousSetting;
            }
        }
    }
}

setTimerDisplay(!document.getElementById("hideTimer").checked);
// if (document.getElementById("userDefined").checked){
document.getElementById("userDefinedAlgs").style.display = "block";
// }

setVirtualCube(document.getElementById("useVirtual").checked);
updateVirtualCube();

var useVirtual = document.getElementById("useVirtual");
useVirtual.addEventListener("click", function () {
    setVirtualCube(this.checked);
    localStorage.setItem("useVirtual", this.checked);
    stopTimer(false);
    document.getElementById("timer").innerHTML = "0.00";
});

var hideTimer = document.getElementById("hideTimer");
hideTimer.addEventListener("click", function () {
    setTimerDisplay(!this.checked);
    localStorage.setItem("hideTimer", this.checked);
    stopTimer(false);
    document.getElementById("timer").innerHTML = "0.00";
});

var includeRecognitionTime = document.getElementById("includeRecognitionTime");
var isIncludeRecognitionTime = localStorage.getItem("includeRecognitionTime") === "true";
includeRecognitionTime.addEventListener("click", function () {
    localStorage.setItem("includeRecognitionTime", this.checked);
    isIncludeRecognitionTime = includeRecognitionTime.checked;
});

var visualCube = document.getElementById("visualcube");
visualCube.addEventListener("click", function () {
    var currentView = localStorage.getItem("visualCubeView")
    var newView = currentView == "" ? "plan" : "";
    localStorage.setItem("visualCubeView", newView);
    var algTest = algorithmHistory[historyIndex];
});


var showScramble = document.getElementById("showScramble");
showScramble.addEventListener("click", function () {
    localStorage.setItem("showScramble", this.checked);
});

var realScrambles = document.getElementById("realScrambles");
realScrambles.addEventListener("click", function () {
    localStorage.setItem("realScrambles", this.checked);
});

var randAUF = document.getElementById("randAUF");
randAUF.addEventListener("click", function () {
    localStorage.setItem("randAUF", this.checked);
});

var prescramble = document.getElementById("prescramble");
prescramble.addEventListener("click", function () {
    localStorage.setItem("prescramble", this.checked);
});

var randomizeSMirror = document.getElementById("randomizeSMirror");
randomizeSMirror.addEventListener("click", function () {
    localStorage.setItem("randomizeSMirror", this.checked);
});

var randomizeMMirror = document.getElementById("randomizeMMirror");
randomizeMMirror.addEventListener("click", function () {
    localStorage.setItem("randomizeMMirror", this.checked);
});

var goInOrder = document.getElementById("goInOrder");
goInOrder.addEventListener("click", function () {
    localStorage.setItem("goInOrder", this.checked);
    currentAlgIndex = 0;
});

var goToNextCase = document.getElementById("goToNextCase");
goToNextCase.addEventListener("click", function () {
    if (isUsingVirtualCube()) {
        alert("Note: This option has no effect when using the virtual cube.")
    }
    localStorage.setItem("goToNextCase", this.checked);
});

var mirrorAllAlgs = document.getElementById("mirrorAllAlgs");
mirrorAllAlgs.addEventListener("click", function () {
    localStorage.setItem("mirrorAllAlgs", this.checked);
});

var mirrorAllAlgsAcrossS = document.getElementById("mirrorAllAlgsAcrossS");
mirrorAllAlgsAcrossS.addEventListener("click", function () {
    localStorage.setItem("mirrorAllAlgsAcrossS", this.checked);
});

// var userDefined = document.getElementById("userDefined");
// userDefined.addEventListener("click", function(){
//     document.getElementById("userDefinedAlgs").style.display = this.checked? "block":"none";
//     localStorage.setItem("userDefined", this.checked);
// });

var fullCN = document.getElementById("fullCN");
fullCN.addEventListener("click", function () {
    localStorage.setItem("fullCN", this.checked);
});

// var algsetpicker = document.getElementById("algsetpicker");
// algsetpicker.addEventListener("change", function(){
//     createCheckboxes();
// 	shouldRecalculateStatistics = true;
//     localStorage.setItem("algsetpicker", this.value);
// });

var clearTimes = document.getElementById("clearTimes");
clearTimes.addEventListener("click", function () {

    if (confirm("Clear all times?")) {
        timeArray = [];
        updateTimeList();
        updateStats();
    }

});

var deleteLast = document.getElementById("deleteLast");
deleteLast.addEventListener("click", function () {
    timeArray.pop();
    algorithmHistory.pop();
    decrementReps()
    updateTimeList();
    updateStats();
});

// var addSelected = document.getElementById("addSelected");
// addSelected.addEventListener("click", function(){

//     var algList = createAlgList(true);
//     for (let i = 0; i < algList.length; i++){
//         algList[i] = algList[i].split("/")[0]
//     }
//     document.getElementById("userDefinedAlgs").value += "\n" + algList.join("\n");
// });

try { // only for mobile
    const leftPopUpButton = document.getElementById("left_popup_button");
    const rightPopUpButton = document.getElementById("right_popup_button");
    leftPopUpButton.addEventListener("click", function () {

        const leftPopUp = document.getElementById("left_popup");
        const rightPopUp = document.getElementById("right_popup");
        if (leftPopUp.style.display == "block") {
            leftPopUp.style.display = "none";
        }
        else {
            leftPopUp.style.display = "block";
            rightPopUp.style.display = "none";
        }
    });

    rightPopUpButton.addEventListener("click", function () {

        const leftPopUp = document.getElementById("left_popup");
        const rightPopUp = document.getElementById("right_popup");
        if (rightPopUp.style.display == "block") {
            rightPopUp.style.display = "none";
        }
        else {
            rightPopUp.style.display = "block";
            leftPopUp.style.display = "none";
        }
    });
} catch (error) {

}

function getRotationMap(moves) {
    let rotationMap = {};

    let rotationCube = new RubiksCube();
   // console.log('moves: ', moves);
    rotationCube.doAlgorithm(moves);
    // let rotationCubeString = rotationCube.toString();
    // console.log(rotationCubeString);

    let faces = "URFDLB";
    for (let i = 0; i < 6; ++i) {
        rotationMap[faces[i]] = faces[rotationCube.cubestate[9 * i + 5][0] - 1];
    }

    return rotationMap;
}

function updateVirtualCube(initialRotations = holdingOrientation.value + ' ' + currentPreorientation) {
    //console.log("preorientation: ", currentPreorientation);
    vc.cubeString = cube.toString();
    let initialMaskedCubeString = cube.toInitialMaskedString(initialMask.value);
    // console.log(initialMaskedCubeString);
    // console.log(vc.cubeString);

    let rotationMap = getRotationMap(initialRotations);
    // console.log(rotationMap);

    for (let k = 0; k < 54; ++k) {
        if (vc[k] != 'x') {
            // console.log(vc.cubeString[k]);
            // console.log(rotationMap[vc.cubeString[k]]);
            vc.cubeString = setCharAt(vc.cubeString, k, rotationMap[vc.cubeString[k]]);
        }

        if (initialMaskedCubeString[k] == 'x' || finalMask.value[k] == 'x') {
            vc.cubeString = setCharAt(vc.cubeString, k, 'x');
        }
    }

    vc.drawCube(ctx);
}

let timerIsRunning = false;

function doAlg(algorithm, updateTimer = false) {
    cube.doAlgorithm(algorithm);

    if (isUsingVirtualCube() && !isIncludeRecognitionTime && updateTimer) {
        if (!timerIsRunning) {
            startTimer();
        }
    }

    // Check if the cube is solved while the timer is running
    if (timerIsRunning && cube.isSolved(initialMask.value) && isUsingVirtualCube()) {
        if (updateTimer) {
            stopTimer(); // Log the time
            markCurrentCommAsGood();
            showSuccessFeedback();

            if (isDrillingMode) {
                retryDrill();
            } else {
                nextScramble();
            }
        } else {
            markCurrentCommAsGood();
            stopTimer();
            showSuccessFeedback();
        }
    }
}

function getRandAuf(letter) {
    var rand = Math.floor(Math.random() * 4);//pick 0,1,2 or 3
    var aufs = [letter + " ", letter + "' ", letter + "2 ", ""];
    return aufs[rand];
}

// Returns a random sequence of quarter turns of the specified length. Quarter turns are used to break OLL. Two consecutive moves may not b on the same axis.
function getPremoves(length) {
    var previous = "U"; // prevents first move from being U or D
    var moveset = ['U', 'R', 'F', 'D', 'L', 'B'];
    var amts = [" ", "' "];
    var randmove = "";
    var sequence = "";
    for (let i = 0; i < length; i++) {
        do {
            randmove = moveset[Math.floor(Math.random() * moveset.length)];
        } while (previous != "" && (randmove === previous || Math.abs(moveset.indexOf(randmove) - moveset.indexOf(previous)) === 3))
        previous = randmove;
        sequence += randmove;
        sequence += amts[Math.floor(Math.random() * amts.length)];
    }
    return sequence;
}

function obfuscate(algorithm, numPremoves = 3, minLength = 16) {

    return algorithm;

    //Cube.initSolver();
    var premoves = getPremoves(numPremoves);
    var rc = new RubiksCube();
    rc.doAlgorithm(alg.cube.invert(premoves) + algorithm);
    var orient = alg.cube.invert(rc.wcaOrient());
    var solution = alg.cube.simplify(premoves + (alg.cube.invert(rc.solution())) + orient).replace(/2'/g, "2");
    return solution.split(" ").length >= minLength ? solution : obfuscate(algorithm, numPremoves + 1, minLength);

}

function addAUFs(algArr) {

    var rand1 = getRandAuf("U");
    var rand2 = getRandAuf("U");
    //algorithm = getRandAuf() + algorithm + " " +  getRandAuf()
    var i = 0;
    for (; i < algArr.length; i++) {
        algArr[i] = alg.cube.simplify(rand1 + algArr[i] + " " + rand2);
    }
    return algArr;
}

function generateAlgScramble(raw_alg, obfuscateAlg, shouldPrescramble) {
    const scramble = !obfuscateAlg
        ? alg.cube.invert(raw_alg)
        : obfuscate(alg.cube.invert(raw_alg));

    cube.resetCube();
    cube.doAlgorithm(scramble);

    const edgeBufferPosition = 7; // UF sticker index
    const cornerBufferPosition = 8; // UFR sticker index

    const cycleMapping = cube.getThreeCycleMapping(edgeBufferPosition, cornerBufferPosition);
    if (!cycleMapping) {
        return ["", scramble]; // Return empty cycle letters if not a valid 3-cycle
    }

    const bufferPosition = cycleMapping.includes(edgeBufferPosition) ? edgeBufferPosition : cornerBufferPosition;
    const bufferIndex = cycleMapping.indexOf(bufferPosition);
    const rearrangedCycle = [...cycleMapping.slice(bufferIndex), ...cycleMapping.slice(0, bufferIndex)];

    const filteredCycle = rearrangedCycle.filter(pos => pos !== bufferPosition);
    let letters = filteredCycle.map(pos => POSITION_TO_LETTER_MAP[pos]);

    // THE TTS CALL HAS BEEN REMOVED FROM HERE

    const cycleLetters = letters.join('');

    return [cycleLetters, scramble];
}


function generatePreScramble(raw_alg, generator, times, obfuscateAlg, premoves = "") {

    var genArray = generator.split(",");

    var scramble = premoves;
    var i = 0;

    for (; i < times; i++) {
        var rand = Math.floor(Math.random() * genArray.length);
        scramble += genArray[rand];
    }
    scramble += alg.cube.invert(raw_alg);

    if (obfuscateAlg) {
        return obfuscate(scramble);
    }
    else {
        return scramble;
    }

}

class AlgTest {
    constructor(cycleLetters, rawAlgs, scramble, solutions, preorientation, solveTime, time, visualCubeView, orientRandPart) {
        this.cycleLetters = cycleLetters
        this.rawAlgs = rawAlgs;
        this.scramble = scramble;
        this.solutions = solutions;
        this.preorientation = alg.cube.simplify(preorientation);
        currentPreorientation = this.preorientation;
        this.solveTime = solveTime;
        this.time = time;
        // this.set = set;
        this.visualCubeView = visualCubeView;
        this.orientRandPart = orientRandPart;
    }
}

// Adds extra rotations to the end of an alg to reorient
function correctRotation(alg) {
    var rc = new RubiksCube();
    rc.doAlgorithm(alg);
    var ori = rc.wcaOrient();

    return alg + " " + ori;
}

function generateAlgTest(rawAlgStr) {
    if (!rawAlgStr) {
        return null; // Return null if no algorithm string is provided
    }

    var obfuscateAlg = document.getElementById("realScrambles").checked;
    var shouldPrescramble = document.getElementById("prescramble").checked;
    var randAUF = document.getElementById("randAUF").checked;

    var rawAlgs = rawAlgStr.split("!");
    rawAlgs = fixAlgorithms(rawAlgs);

    //Do non-randomized mirroring first.
    if (mirrorAllAlgs.checked && !randomizeMMirror.checked) {
        rawAlgs = mirrorAlgsAcrossAxis(rawAlgs, axis = "M");
    }
    if (mirrorAllAlgsAcrossS.checked && !randomizeSMirror.checked) {
        rawAlgs = mirrorAlgsAcrossAxis(rawAlgs, axis = "S");
    }
    if (mirrorAllAlgs.checked && randomizeMMirror.checked) {
        if (Math.random() > 0.5) {
            rawAlgs = mirrorAlgsAcrossAxis(rawAlgs, axis = "M");
        }
    }
    if (mirrorAllAlgsAcrossS.checked && randomizeSMirror.checked) {
        if (Math.random() > 0.5) {
            rawAlgs = mirrorAlgsAcrossAxis(rawAlgs, axis = "S");
        }
    }


    var solutions;
    if (randAUF) {
        solutions = addAUFs(rawAlgs);
    } else {
        solutions = rawAlgs;
    }

    var [cycleLetters, scramble] = generateAlgScramble(correctRotation(commToMoves(solutions[0])), obfuscateAlg, shouldPrescramble);

    var [preorientation, orientRandPart] = ["", ""];
    orientRandPart = alg.cube.simplify(orientRandPart);

    var solveTime = null;
    var time = Date.now();
    var visualCubeView = "plan";

    var algTest = new AlgTest(cycleLetters, rawAlgs, scramble, solutions, preorientation, solveTime, time, visualCubeView, orientRandPart);
    return algTest;
}

function testAlg(algTest, addToHistory = true) {

    var scramble = document.getElementById("scramble");

    if (document.getElementById("showScramble").checked) {
        scramble.innerHTML = "<span>" + algTest.orientRandPart + "</span>" + " " + algTest.rawAlgs[0];
    } else {
        scramble.innerHTML = "&nbsp;";
    }

    var cycleLettersElement = document.getElementById("cycle");
    cycleLettersElement.innerHTML = algTest.cycleLetters;

    // document.getElementById("algdisp").innerHTML = "";

    cube.resetCube();
    doAlg(algTest.scramble, false);
    updateVirtualCube();

    if (addToHistory) {
        algorithmHistory.push(algTest);
    }
    //  console.log(algTest);

}

function updateAlgsetStatistics(algList) {
    const totalTime = timeArray.reduce((sum, solveTime) => sum + solveTime.timeValue(), 0).toFixed(2);

    const stats = {
        "STM": averageMovecount(algList, "btm", false).toFixed(3),
        "SQTM": averageMovecount(algList, "bqtm", false).toFixed(3),
        "STM (including AUF)": averageMovecount(algList, "btm", true).toFixed(3),
        "SQTM (including AUF)": averageMovecount(algList, "bqtm", true).toFixed(3),
        "Number of algs": algList.length,
        "Total Time (seconds)": totalTime // Add total time to statistics
    };

    const table = document.getElementById("algsetStatistics");
    table.innerHTML = "";
    const th = document.createElement("th");
    th.appendChild(document.createTextNode("Algset Statistics"));
    table.appendChild(th);
    for (const key in stats) {
        const tr = document.createElement("tr");
        const description = document.createElement("td");
        const value = document.createElement("td");
        description.appendChild(document.createTextNode(key));
        value.appendChild(document.createTextNode(stats[key]));
        tr.appendChild(description);
        tr.appendChild(value);
        table.appendChild(tr);
    }
}

function reTestAlg() {
    var lastTest = algorithmHistory[algorithmHistory.length - 1];
    //  console.log(lastTest);
    if (lastTest == undefined) {
        return;
    }
    cube.resetCube();
    doAlg(lastTest.scramble, false);
    //  console.log("ok");
    updateVirtualCube();

}

function updateTrainer(scramble, solutions, algorithm, timer) {
    if (scramble != null) {
        document.getElementById("scramble").innerHTML = scramble;
    }
    // if (solutions != null) {
    //     document.getElementById("algdisp").innerHTML = solutions;
    // }

    if (algorithm != null) {
        cube.resetCube();
        doAlg(algorithm, false);
    }

    if (timer != null) {
        document.getElementById("timer").innerHTML = timer;
    }
}

function fixAlgorithms(algorithms) {
    //for now this just removes brackets
    var i = 0;
    for (; i < algorithms.length; i++) {
        // console.log(algorithms[i]);
        let currAlg = algorithms[i].replace(/\[|\]|\)|\(/g, "");
        // currAlg = commToMoves(currAlg);
        // console.log(currAlg);

        // don't simplifify for now
        // if (!isCommutator(currAlg)) {
        //     algorithms[i] = alg.cube.simplify(currAlg);
        // }

    }
    return algorithms;
    //TODO Allow commutators

}

function validTextColour(stringToTest) {
    if (stringToTest === "") { return false; }
    if (stringToTest === "inherit") { return false; }
    if (stringToTest === "transparent") { return false; }

    var visualCubeColoursArray = ['black', 'dgrey', 'grey', 'silver', 'white', 'yellow',
        'red', 'orange', 'blue', 'green', 'purple', 'pink'];

    if (stringToTest[0] !== '#') {
        return visualCubeColoursArray.indexOf(stringToTest) > -1;
    } else {
        return /^#[0-9A-F]{6}$/i.test(stringToTest)
    }
}

function stripLeadingHashtag(colour) {
    if (colour[0] == '#') {
        return colour.substring(1);
    }

    return colour;
}


function displayAlgorithm(algTest, reTest = true) {
    //If reTest is true, the scramble will also b setup on the virtual cube
    if (reTest) {
        reTestAlg();
    }

    updateTrainer(algTest.scramble, algTest.solutions.join("<br><br>"), null, null);
}

function displayAlgorithmFromHistory(index) {

    var algTest = algorithmHistory[index];

    //  console.log( algTest );

    var timerText;
    if (algTest.solveTime == null) {
        timerText = 'n/a'
    } else {
        timerText = algTest.solveTime.toString()
    }

    updateTrainer(
        "<span>" + algTest.orientRandPart + "</span>" + " " + algTest.scramble,
        algTest.solutions.join("<br><br>"),
        algTest.preorientation + algTest.scramble,
        timerText
    );

}

function displayAlgorithmForPreviousTest(reTest = true, showSolution = true) {//not a great name

    var lastTest = algorithmHistory[algorithmHistory.length - 1];
    if (lastTest == undefined) {
        return;
    }
    //If reTest is true, the scramble will also b setup on the virtual cube
    if (reTest) {
        reTestAlg();
    }

    if (showSolution) {
        updateTrainer("<span>" + lastTest.orientRandPart + "</span>" + " " + lastTest.scramble, lastTest.solutions.join("<br><br>"), null, null);
    } else {
        updateTrainer(null, null, null, null);
    }
}

let lastSelectedAlgorithm = null;

let remainingAlgs = []; // Stores the remaining algorithms for the current cycle
let isFirstRun = true; // Flag to track the first run

function getNextAlgFromSession() {
    // Check if the queue is empty and repopulate if needed
    if (sessionQueue.length === 0) {
        if (isDrillingMode) {
            if (!isFirstDrillRun) {
                const jingle = document.getElementById("completionJingle");
                jingle.volume = 0.5;
                jingle.play();
            }
            isFirstDrillRun = false;
            // Re-initialize and flatten drilling pairs to restart the cycle
            const boxAlgs = document.getElementById("userDefinedAlgs").value.split("\n").filter(alg => alg.trim() !== "");
            initializeDrillingPairs(boxAlgs);
            sessionQueue = drillingPairs.flat();
            if (sessionQueue.length === 0) return null;
        } else { // Regular Mode
            if (!isFirstRun) {
                const jingle = document.getElementById("completionJingle");
                jingle.volume = 0.5;
                jingle.play();
            }
            isFirstRun = false;
            // Re-initialize and re-shuffle the list to restart the cycle
            const algList = createAlgList();
            if (algList.length === 0) return null;
            for (let i = algList.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [algList[i], algList[j]] = [algList[j], algList[i]];
            }
            sessionQueue = algList;
        }
    }

    // Update progress display based on the mode
    if (isDrillingMode) {
         const completedPairs = totalDrillPairs - Math.ceil(sessionQueue.length / 2);
         document.getElementById("progressDisplay").innerText = `Progress: ${completedPairs}/${totalDrillPairs}`;
    } else {
        const totalAlgs = createAlgList().length;
        const currentIndex = totalAlgs - sessionQueue.length;
        document.getElementById("progressDisplay").innerText = `Progress: ${currentIndex}/${totalAlgs}`;
    }

    // Return the next item from the queue, removing it
    return sessionQueue.shift();
}

var timeArray = [];

function getMean(timeArray) {
    var i;
    var total = 0;
    for (i = 0; i < timeArray.length; i++) {
        total += timeArray[i].timeValue();
    }

    return total / timeArray.length;
}

function updateStats() {
    var statistics = document.getElementById("statistics");

    statistics.innerHTML = "&nbsp";

    if (timeArray.length != 0) {
        statistics.innerHTML += "Mean of " + timeArray.length + ": " + getMean(timeArray).toFixed(2) + "<br>";
    }

}

function startTimer() {

    if (timerIsRunning) {
        return;
    }

    if (document.getElementById("timer").style.display == 'none') {
        //don't do anything if timer is hidden
        return;
    }
    starttime = Date.now();
    timerUpdateInterval = setInterval(updateTimer, 1);
    timerIsRunning = true;
}

function stopTimer(logTime = true) {
    if (!timerIsRunning) {
        return;
    }

    if (document.getElementById("timer").style.display == 'none') {
        // Don't do anything if the timer is hidden
        return;
    }

    clearInterval(timerUpdateInterval);
    timerIsRunning = false;

    var time = parseFloat(document.getElementById("timer").innerHTML);
    if (isNaN(time)) {
        return NaN;
    }

    if (logTime) {
        var lastTest = algorithmHistory[algorithmHistory.length - 1];
        var cycleLetters = lastTest ? lastTest.cycleLetters : ""; // Get the 3-cycle letters
        var solveTime = new SolveTime(time, '', cycleLetters); // Include cycle letters
        lastTest.solveTime = solveTime;
        timeArray.push(solveTime);
        console.log(timeArray);

        // Increment the repetition counter
        incrementReps();

        updateTimeList();
    }

    updateStats();
    return time;
}

function incrementReps() {
    repetitionCounter++;
    localStorage.setItem("repetitionCounter", repetitionCounter);
    document.getElementById("repetitionCounter").innerText = `${repetitionCounter}`;
}

function decrementReps() {
    repetitionCounter--;
    localStorage.setItem("repetitionCounter", repetitionCounter);
    document.getElementById("repetitionCounter").innerText = `${repetitionCounter}`;
}

function updateTimer() {
    document.getElementById("timer").innerHTML = ((Date.now() - starttime) / 1000).toFixed(2);
}

function updateTimeList() {
    var timeList = document.getElementById("timeList");
    var scrollTimes = document.getElementById("scrollTimes");
    timeList.innerHTML = "&nbsp";

    for (let i = 0; i < timeArray.length; i++) {
        timeList.innerHTML += timeArray[i].toString(); // Includes cycle letters
        timeList.innerHTML += " ";
    }

    scrollTimes.scrollTop = scrollTimes.scrollHeight;
}

//Create Checkboxes for each subset
//Each subset has id of subset name, and is followed by text of subset name.

// function createAlgsetPicker(){
//     var algsetPicker = document.getElementById("algsetpicker")
//     for (var set in window.algs){
//         var option = document.createElement("option")
//         option.text = set;
//         algsetPicker.add(option);

//     }
//     //algsetPicker.size = Object.keys(window.algs).length
// }



// function createCheckboxes(){

//     var set = document.getElementById("algsetpicker").value;


//     var full_set = window.algs[set];

//     if (!full_set){
//         set = document.getElementById("algsetpicker").options[0].value;
//         document.getElementById("algsetpicker").value = set;
//         full_set = window.algs[set]
//     }
//     var subsets = Object.keys(full_set);

//     var myDiv = document.getElementById("cboxes");

//     myDiv.innerHTML = "";

//     for (var i = 0; i < subsets.length; i++) {
//         var checkBox = document.createElement("input");
//         var label = document.createElement("label");
//         checkBox.type = "checkbox";
//         checkBox.value = subsets[i];
//         checkBox.onclick = function(){
//             currentAlgIndex = 0;
//             shouldRecalculateStatistics=true; 
//             //Every time a checkbox is pressed, the algset statistics should b updated.

//             var checkboxes = document.querySelectorAll('#cboxes input[type="checkbox"]');
//             const anyUnchecked = Array.from(checkboxes).some(checkbox => !checkbox.checked);
//             toggleAlgsetSelectAll.textContent = anyUnchecked ? 'Select All' : 'Unselect All';
//         }
//         checkBox.setAttribute("id", set.toLowerCase() +  subsets[i]);

//         myDiv.appendChild(checkBox);
//         myDiv.appendChild(label);
//         label.appendChild(document.createTextNode(subsets[i]));
//     }
// }

// var toggleAlgsetSelectAll = document.getElementById("toggleAlgsetSelectAll");
// toggleAlgsetSelectAll.addEventListener('click', () => {
//     var checkboxes = document.querySelectorAll('#cboxes input[type="checkbox"]');
//     const anyUnchecked = Array.from(checkboxes).some(checkbox => !checkbox.checked);
//     checkboxes.forEach(checkbox => checkbox.checked = anyUnchecked);
//     toggleAlgsetSelectAll.textContent = !anyUnchecked ? 'Select All' : 'Unselect All';
// });

function clearSelectedAlgsets() {
    var elements = document.getElementById("algsetpicker").options;
    for (var i = 0; i < elements.length; i++) {
        elements[i].selected = false;
    }
}

function findMistakesInUserAlgs(userAlgs) {
    var errorMessage = "";
    var newList = [];
    var newListDisplay = []; // contains all valid algs + commented algs

    for (var i = 0; i < userAlgs.length; i++) {
        let alg = userAlgs[i].trim();

        // Remove leading asterisks (*) or minus signs (-) and trim spaces
        alg = alg.replace(/^[\*\-]+/, "").trim();

        // Replace apostrophe-like characters with a standard single quote
        alg = alg.replace(/[\u2018\u0060\u2019\u00B4]/g, "'").replace(/"/g, "");

        let algWithParenthesis = alg;

        // Remove comments in parentheses and trim
        alg = alg.replace(/\([^)]*\)/g, "").trim();

        if (!isCommutator(alg)) {
            try {
                alg.cube.simplify(alg);
                if (alg !== "") {
                    newList.push(alg);
                    newListDisplay.push(algWithParenthesis);
                }
            } catch (err) {
                // attempt to get the cycle anyway
                cube.resetCube();
                cube.doAlgorithm(alg);
                const edgeBufferPosition = 7; // UF sticker index
                const cornerBufferPosition = 8; // UFR sticker index

                const cycleMapping = cube.getThreeCycleMapping(edgeBufferPosition, cornerBufferPosition);
                cube.resetCube();

                if (cycleMapping) {
                    //console.log("Alg is not a commutator, but is still a valid 3 cycle:", cycleMapping);
                    newList.push(alg);
                    newListDisplay.push(algWithParenthesis);
                } else {
                    if (alg !== "") {
                        errorMessage += `"${userAlgs[i]}" is an invalid alg and has been removed\n`;
                    }
                }
            }
        } else {
            // TODO: Check valid commutators
            newList.push(alg);
            newListDisplay.push(algWithParenthesis);
        }
    }

    if (errorMessage !== "") {
        alert(errorMessage);
    }

    document.getElementById("userDefinedAlgs").value = newListDisplay.join("\n");
    localStorage.setItem("userDefinedAlgs", newListDisplay.join("\n"));
    return newList;
}

function createAlgList() {
    algList = findMistakesInUserAlgs(document.getElementById("userDefinedAlgs").value.split("\n"));
    if (algList.length == 0) {
        alert("Please enter some algs into the User Defined Algs box.");
    }
    return algList;
}

function mirrorAlgsAcrossAxis(algList, axis = "M") {
    algList = fixAlgorithms(algList);
    if (axis == "M") {
        return algList.map(x => alg.cube.mirrorAcrossM(x));
    }
    else {
        return algList.map(x => alg.cube.mirrorAcrossS(x));
    }
}

function averageMovecount(algList, metric, includeAUF) {

    var totalmoves = 0;
    var i = 0;
    for (; i < algList.length; i++) {
        var topAlg = algList[i].split("!")[0];
        topAlg = topAlg.replace(/\[|\]|\)|\(/g, "");
        // convert to moves if in comm notation
        // console.log(topAlg);
        topAlg = commToMoves(topAlg);
        // console.log(topAlg);

        var moves = alg.cube.simplify(alg.cube.expand(alg.cube.fromString(topAlg)));

        if (!includeAUF) {
            while (moves[0].base === "U" || moves[0].base === "y") {
                moves.splice(0, 1)
            }
            while (moves[moves.length - 1].base === "U" || moves[moves.length - 1].base === "y") {
                moves.splice(moves.length - 1)
            }
        }
        totalmoves += alg.cube.countMoves(moves, { "metric": metric });
    }

    return totalmoves / algList.length;
}

function toggleVirtualCube() {
    var sim = document.getElementById("simcube");

    if (sim.style.display == 'none') {
        sim.style.display = 'block';
    }
    else {
        sim.style.display = 'none';
    }
}

function setVirtualCube(setting) {
    var sim = document.getElementById("simcube");
    if (setting) {
        sim.style.display = 'block';
    } else {
        sim.style.display = 'none';
        document.getElementById("timer").style.display = 'block'; //timer has to b shown when simulator cube is not used
        document.getElementById("hideTimer").checked = false;
    }
}

function setTimerDisplay(setting) {
    var timer = document.getElementById("timer");
    if (!isUsingVirtualCube()) {
        alert("The timer can only b hidden when using the simulator cube.");
        document.getElementById("hideTimer").checked = false;
    }
    else if (setting) {
        timer.style.display = 'block';
    } else {
        timer.style.display = 'none';
    }
}

function isUsingVirtualCube() {
    var sim = document.getElementById("simcube")

    if (sim.style.display == 'none') {
        return false;
    }
    else {
        return true;
    }
}


var listener = new Listener();

var lastKeyMap = null;

var historyIndex;

function nextScramble(displayReady = true) {
    moveHistory.length = 0;
    stopTimer(false);

    if (displayReady) {
        document.getElementById("timer").innerHTML = 'Ready';
    }

    updateLastCycleInfo();
    hideScramble();

    // On the first run, upcomingAlgTest will be null, so we generate the first one.
    if (!upcomingAlgTest) {
        upcomingAlgTest = generateAlgTest(getNextAlgFromSession());
    }

    // The "upcoming" test from the last turn now becomes the "current" one.
    const currentAlgTest = upcomingAlgTest;

    // If there is no current test, it means the session is empty or complete.
    if (!currentAlgTest) {
        document.getElementById("scramble").innerHTML = "Session Complete!";
        document.getElementById("cycle").innerHTML = "";
        document.getElementById("upcoming_cycle").innerHTML = "";
        return;
    }

    // Speak the cycle letters for the CURRENT test that is about to be displayed.
    if (shouldReadDrillTTS && currentAlgTest.cycleLetters) {
        speakText(parseLettersForTTS(currentAlgTest.cycleLetters.split("")));
    }

    // Now, we generate the *next* upcoming test to be ready for the next scramble.
    upcomingAlgTest = generateAlgTest(getNextAlgFromSession());

    // Update the DOM to show the current and upcoming cycle letters.
    document.getElementById("cycle").innerHTML = currentAlgTest.cycleLetters;
    const upcomingCycleElement = document.getElementById("upcoming_cycle");

    if (upcomingAlgTest) {
        upcomingCycleElement.innerHTML = upcomingAlgTest.cycleLetters;
    } else {
        // This is the last algorithm in the cycle.
        upcomingCycleElement.innerHTML = "End";
    }

    // Run the test for the current algorithm, which updates the cube and history.
    testAlg(currentAlgTest);

    if (isUsingVirtualCube()) {
        if (isIncludeRecognitionTime) {
            startTimer();
        }
    }

    historyIndex = algorithmHistory.length - 1;
    toggleFeedbackUsed = false;
}

function handleLeftButton() {
    if (algorithmHistory.length <= 1 || timerIsRunning) {
        return;
    }
    historyIndex--;

    if (historyIndex < 0) {
        alert('Reached end of solve log');
        historyIndex = 0;
    }
    displayAlgorithmFromHistory(historyIndex);
}

function handleRightButton() {
    if (timerIsRunning) {
        return;
    }
    historyIndex++;
    if (historyIndex >= algorithmHistory.length) {
        nextScramble();
        doNothingNextTimeSpaceIsPressed = false;
        return;
    }

    displayAlgorithmFromHistory(historyIndex);
}

try { //only for mobile
    document.getElementById("onscreenLeft").addEventListener("click", handleLeftButton);
    document.getElementById("onscreenRight").addEventListener("click", handleRightButton);
} catch (error) {

}

function updateControls() {
    let keymaps = getKeyMaps();

    if (JSON.stringify(keymaps) === JSON.stringify(lastKeyMap)) {
        return false;
    }

    lastKeyMap = keymaps;

    listener.reset();

    keymaps.forEach(function (keymap) {
        listener.register(keymap[0], function () { doAlg(keymap[1], true) });
    });
    listener.register(new KeyCombo("Backspace"), function () { displayAlgorithmForPreviousTest(true, true); });
    listener.register(new KeyCombo("Escape"), function () {
        if (isUsingVirtualCube()) {
            stopTimer(false);
        }
        reTestAlg();
        document.getElementById("scramble").innerHTML = "&nbsp;";
        // document.getElementById("algdisp").innerHTML = "";
    });
    listener.register(new KeyCombo("Enter"), function () {
        nextScramble();
        doNothingNextTimeSpaceIsPressed = false;
    });
    listener.register(new KeyCombo("Tab"), function () {
        nextScramble();
        doNothingNextTimeSpaceIsPressed = false;
    });
    listener.register(new KeyCombo("ArrowLeft"), handleLeftButton);
    listener.register(new KeyCombo("ArrowRight"), handleRightButton);
}

setInterval(updateControls, 300);


function release(event) {
    if (event.key == " " || event.type == "touchend") { //space
        if (document.activeElement.type == "text") {
            return;
        }
        if (document.activeElement.type == "textarea") {
            return;
        }

        document.getElementById("timer").style.color = "white"; //Timer should never b any color other than white when space is not pressed down
        // if (!isUsingVirtualCube()) {
        //     if (document.getElementById("algdisp").innerHTML == "") {
        //         //Right after a new scramble is displayed, space starts the timer


        //         if (doNothingNextTimeSpaceIsPressed) {
        //             doNothingNextTimeSpaceIsPressed = false;
        //         }
        //         else {
        //             startTimer();
        //         }
        //     }
        // }
    }
};
document.onkeyup = release
try { //only for mobile
    document.getElementById("touchStartArea").addEventListener("touchend", release);
} catch (error) {

}

var doNothingNextTimeSpaceIsPressed = true;
function press(event) { //Stops the screen from scrolling down when you press space

    if (event.key == " " || event.type == "touchstart") { //space
        if (document.activeElement.type == "text") {
            return;
        }

        if (document.activeElement.type == "textarea") {
            return;
        }

        event.preventDefault();
        if (!event.repeat) {
            if (isUsingVirtualCube()) {
                if (timerIsRunning) {
                    stopTimer();
                    displayAlgorithmForPreviousTest(true, false);//put false here if you don't want the cube to retest.
                    //window.setTimeout(function (){reTestAlg();}, 250);
                }
                else {
                    displayAlgorithmForPreviousTest(true, false);
                }

            }
            else { //If not using virtual cube
                if (timerIsRunning) {//If timer is running, stop timer
                    var time = stopTimer();
                    doNothingNextTimeSpaceIsPressed = true;
                    if (document.getElementById("goToNextCase").checked) {
                        nextScramble(false);

                        //document.getElementById("timer").innerHTML = time;
                    } else {
                        displayAlgorithmForPreviousTest(true, false);
                    }

                }
                // else if (document.getElementById("algdisp").innerHTML != "") {
                //     nextScramble(); //If the solutions are currently displayed, space should test on the next alg.

                //     doNothingNextTimeSpaceIsPressed = true;
                // }

                else if (document.getElementById("timer").innerHTML == "Ready") {
                    document.getElementById("timer").style.color = "green";
                }
            }
        }
    }

};
document.onkeydown = press;
try { //only for mobile
    document.getElementById("touchStartArea").addEventListener("touchstart", press);
} catch (error) {

}


class SolveTime {
    constructor(time, cycleLetters = "") {
        this.time = time;
        this.cycleLetters = cycleLetters; // Add cycle letters
    }

    toString(decimals = 2) {
        var timeString = this.time.toFixed(decimals);
        return `${timeString} ${this.cycleLetters}`;
    }

    timeValue() {
        return this.time;
    }
}


const nextScrambleButton = document.querySelector('button[name="nextScrambleButton"]');
if (nextScrambleButton)
    nextScrambleButton.addEventListener('click', nextScramble);

const showSolutionButton = document.querySelector('button[name="showSolutionButton"]');
if (showSolutionButton)
    showSolutionButton.addEventListener('click', displayAlgorithmForPreviousTest);

//CUBE OBJECT
function RubiksCube() {
    this.cubestate = [
        [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8],
        [2, 9], [2, 10], [2, 11], [2, 12], [2, 13], [2, 14], [2, 15], [2, 16], [2, 17],
        [3, 18], [3, 19], [3, 20], [3, 21], [3, 22], [3, 23], [3, 24], [3, 25], [3, 26],
        [4, 27], [4, 28], [4, 29], [4, 30], [4, 31], [4, 32], [4, 33], [4, 34], [4, 35],
        [5, 36], [5, 37], [5, 38], [5, 39], [5, 40], [5, 41], [5, 42], [5, 43], [5, 44],
        [6, 45], [6, 46], [6, 47], [6, 48], [6, 49], [6, 50], [6, 51], [6, 52], [6, 53]
    ];

    this.resetCube = function () {
        this.cubestate = [
            [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8],
            [2, 9], [2, 10], [2, 11], [2, 12], [2, 13], [2, 14], [2, 15], [2, 16], [2, 17],
            [3, 18], [3, 19], [3, 20], [3, 21], [3, 22], [3, 23], [3, 24], [3, 25], [3, 26],
            [4, 27], [4, 28], [4, 29], [4, 30], [4, 31], [4, 32], [4, 33], [4, 34], [4, 35],
            [5, 36], [5, 37], [5, 38], [5, 39], [5, 40], [5, 41], [5, 42], [5, 43], [5, 44],
            [6, 45], [6, 46], [6, 47], [6, 48], [6, 49], [6, 50], [6, 51], [6, 52], [6, 53]
        ];
    }

    this.resetCubestate = function () {
        var face = 1;
        for (var i = 0; i < 6; ++i) {
            for (var j = 0; j < 9; ++j) {
                this.cubestate[9 * i + j][0] = face;
            }

            ++face;
        }
    }

    this.resetMask = function () {
        var face = 1;
        for (var i = 0; i < 6; ++i) {
            for (var j = 0; j < 9; ++j) {
                this.cubestate[9 * i + j][1] = 9 * i + j;
            }

            ++face;
        }
    }

    this.getMaskValues = function () {
        return this.cubestate.map(facelet => facelet[1]);
    }

    this.solution = function () {
        var gcube = Cube.fromString(this.toString());
        return gcube.solve();
    }

    this.isSolved = function (initialMask = "") {
        for (var i = 0; i < 6; i++) {
            let uniqueColorsOnFace = new Set();

            for (var j = 0; j < 9; j++) {
                // console.log(this.toString());
                // console.log(initialMask);
                if (initialMask.length == 54 && initialMask[this.cubestate[9 * i + j][1]] == 'x') {
                    continue;
                }
                uniqueColorsOnFace.add(this.cubestate[9 * i + j][0]);
            }

            if (uniqueColorsOnFace.size > 1) {
                return false;
            }
        }
        return true;
    }
    this.wcaOrient = function () {
        // u-r--f--d--l--b
        // 4 13 22 31 40 49
        //
        var moves = "";

        if (this.cubestate[13][0] == 1) {//R face
            this.doAlgorithm("z'");
            moves += "z'";
        } else if (this.cubestate[22][0] == 1) {//on F face
            this.doAlgorithm("x");
            moves += "x";
        } else if (this.cubestate[31][0] == 1) {//on D face
            this.doAlgorithm("x2");
            moves += "x2";
        } else if (this.cubestate[40][0] == 1) {//on L face
            this.doAlgorithm("z");
            moves += "z";
        } else if (this.cubestate[49][0] == 1) {//on B face
            this.doAlgorithm("x'");
            moves += "x'";
        }

        if (this.cubestate[13][0] == 3) {//R face
            this.doAlgorithm("y");
            moves += " y";
        } else if (this.cubestate[40][0] == 3) {//on L face
            this.doAlgorithm("y'");
            moves += " y'";
        } else if (this.cubestate[49][0] == 3) {//on B face
            this.doAlgorithm("y2");
            moves += " y2";
        }

        return moves;
    }

    this.toString = function () {
        var str = "";
        var i;
        var sides = ["U", "R", "F", "D", "L", "B"]
        for (i = 0; i < this.cubestate.length; i++) {
            str += sides[this.cubestate[i][0] - 1];
        }
        // console.log(str);
        return str;
    }

    this.toInitialMaskedString = function (initialMask) {
        var str = "";
        var i;
        var sides = ["U", "R", "F", "D", "L", "B"]
        for (i = 0; i < this.cubestate.length; i++) {
            if (initialMask[this.cubestate[i][1]] == 'x') {
                str += 'x';
            } else {
                str += sides[this.cubestate[i][0] - 1];
            }
        }
        return str;
    }


    this.test = function (alg) {
        this.doAlgorithm(alg);
        updateVirtualCube();
    }

    this.doAlgorithm = function (alg) {
        if (!alg || alg == "") return;

        var moveArr = alg.split(/(?=[A-Za-z])/);
        var i;

        for (i = 0; i < moveArr.length; i++) {
            var move = moveArr[i];
            var myRegexp = /([RUFBLDrufbldxyzEMS])(\d*)('?)/g;
            var match = myRegexp.exec(move.trim());


            if (match != null) {

                var side = match[1];

                var times = 1;
                if (!match[2] == "") {
                    times = match[2] % 4;
                }

                if (match[3] == "'") {
                    times = (4 - times) % 4;
                }

                switch (side) {
                    case "R":
                        this.doR(times);
                        break;
                    case "U":
                        this.doU(times);
                        break;
                    case "F":
                        this.doF(times);
                        break;
                    case "B":
                        this.doB(times);
                        break;
                    case "L":
                        this.doL(times);
                        break;
                    case "D":
                        this.doD(times);
                        break;
                    case "r":
                        this.doRw(times);
                        break;
                    case "u":
                        this.doUw(times);
                        break;
                    case "f":
                        this.doFw(times);
                        break;
                    case "b":
                        this.doBw(times);
                        break;
                    case "l":
                        this.doLw(times);
                        break;
                    case "d":
                        this.doDw(times);
                        break;
                    case "x":
                        this.doX(times);
                        break;
                    case "y":
                        this.doY(times);
                        break;
                    case "z":
                        this.doZ(times);
                        break;
                    case "E":
                        this.doE(times);
                        break;
                    case "M":
                        this.doM(times);
                        break;
                    case "S":
                        this.doS(times);
                        break;

                }
            }
        }

    }

    this.solveNoRotate = function () {
        //Center sticker indexes: 4, 13, 22, 31, 40, 49
        var cubestate = this.cubestate;
        this.cubestate = [cubestate[4], cubestate[4], cubestate[4], cubestate[4], cubestate[4], cubestate[4], cubestate[4], cubestate[4], cubestate[4],
        cubestate[13], cubestate[13], cubestate[13], cubestate[13], cubestate[13], cubestate[13], cubestate[13], cubestate[13], cubestate[13],
        cubestate[22], cubestate[22], cubestate[22], cubestate[22], cubestate[22], cubestate[22], cubestate[22], cubestate[22], cubestate[22],
        cubestate[31], cubestate[31], cubestate[31], cubestate[31], cubestate[31], cubestate[31], cubestate[31], cubestate[31], cubestate[31],
        cubestate[40], cubestate[40], cubestate[40], cubestate[40], cubestate[40], cubestate[40], cubestate[40], cubestate[40], cubestate[40],
        cubestate[49], cubestate[49], cubestate[49], cubestate[49], cubestate[49], cubestate[49], cubestate[49], cubestate[49], cubestate[49]];
    }

    this.doU = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.cubestate = [cubestate[6], cubestate[3], cubestate[0], cubestate[7], cubestate[4], cubestate[1], cubestate[8], cubestate[5], cubestate[2], cubestate[45], cubestate[46], cubestate[47], cubestate[12], cubestate[13], cubestate[14], cubestate[15], cubestate[16], cubestate[17], cubestate[9], cubestate[10], cubestate[11], cubestate[21], cubestate[22], cubestate[23], cubestate[24], cubestate[25], cubestate[26], cubestate[27], cubestate[28], cubestate[29], cubestate[30], cubestate[31], cubestate[32], cubestate[33], cubestate[34], cubestate[35], cubestate[18], cubestate[19], cubestate[20], cubestate[39], cubestate[40], cubestate[41], cubestate[42], cubestate[43], cubestate[44], cubestate[36], cubestate[37], cubestate[38], cubestate[48], cubestate[49], cubestate[50], cubestate[51], cubestate[52], cubestate[53]];
        }

    }

    this.doR = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;

            this.cubestate = [cubestate[0], cubestate[1], cubestate[20], cubestate[3], cubestate[4], cubestate[23], cubestate[6], cubestate[7], cubestate[26], cubestate[15], cubestate[12], cubestate[9], cubestate[16], cubestate[13], cubestate[10], cubestate[17], cubestate[14], cubestate[11], cubestate[18], cubestate[19], cubestate[29], cubestate[21], cubestate[22], cubestate[32], cubestate[24], cubestate[25], cubestate[35], cubestate[27], cubestate[28], cubestate[51], cubestate[30], cubestate[31], cubestate[48], cubestate[33], cubestate[34], cubestate[45], cubestate[36], cubestate[37], cubestate[38], cubestate[39], cubestate[40], cubestate[41], cubestate[42], cubestate[43], cubestate[44], cubestate[8], cubestate[46], cubestate[47], cubestate[5], cubestate[49], cubestate[50], cubestate[2], cubestate[52], cubestate[53]]
        }

    }

    this.doF = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[1], cubestate[2], cubestate[3], cubestate[4], cubestate[5], cubestate[44], cubestate[41], cubestate[38], cubestate[6], cubestate[10], cubestate[11], cubestate[7], cubestate[13], cubestate[14], cubestate[8], cubestate[16], cubestate[17], cubestate[24], cubestate[21], cubestate[18], cubestate[25], cubestate[22], cubestate[19], cubestate[26], cubestate[23], cubestate[20], cubestate[15], cubestate[12], cubestate[9], cubestate[30], cubestate[31], cubestate[32], cubestate[33], cubestate[34], cubestate[35], cubestate[36], cubestate[37], cubestate[27], cubestate[39], cubestate[40], cubestate[28], cubestate[42], cubestate[43], cubestate[29], cubestate[45], cubestate[46], cubestate[47], cubestate[48], cubestate[49], cubestate[50], cubestate[51], cubestate[52], cubestate[53]];
        }

    }

    this.doD = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[1], cubestate[2], cubestate[3], cubestate[4], cubestate[5], cubestate[6], cubestate[7], cubestate[8], cubestate[9], cubestate[10], cubestate[11], cubestate[12], cubestate[13], cubestate[14], cubestate[24], cubestate[25], cubestate[26], cubestate[18], cubestate[19], cubestate[20], cubestate[21], cubestate[22], cubestate[23], cubestate[42], cubestate[43], cubestate[44], cubestate[33], cubestate[30], cubestate[27], cubestate[34], cubestate[31], cubestate[28], cubestate[35], cubestate[32], cubestate[29], cubestate[36], cubestate[37], cubestate[38], cubestate[39], cubestate[40], cubestate[41], cubestate[51], cubestate[52], cubestate[53], cubestate[45], cubestate[46], cubestate[47], cubestate[48], cubestate[49], cubestate[50], cubestate[15], cubestate[16], cubestate[17]];
        }

    }

    this.doL = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.cubestate = [cubestate[53], cubestate[1], cubestate[2], cubestate[50], cubestate[4], cubestate[5], cubestate[47], cubestate[7], cubestate[8], cubestate[9], cubestate[10], cubestate[11], cubestate[12], cubestate[13], cubestate[14], cubestate[15], cubestate[16], cubestate[17], cubestate[0], cubestate[19], cubestate[20], cubestate[3], cubestate[22], cubestate[23], cubestate[6], cubestate[25], cubestate[26], cubestate[18], cubestate[28], cubestate[29], cubestate[21], cubestate[31], cubestate[32], cubestate[24], cubestate[34], cubestate[35], cubestate[42], cubestate[39], cubestate[36], cubestate[43], cubestate[40], cubestate[37], cubestate[44], cubestate[41], cubestate[38], cubestate[45], cubestate[46], cubestate[33], cubestate[48], cubestate[49], cubestate[30], cubestate[51], cubestate[52], cubestate[27]];
        }

    }

    this.doB = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.cubestate = [cubestate[11], cubestate[14], cubestate[17], cubestate[3], cubestate[4], cubestate[5], cubestate[6], cubestate[7], cubestate[8], cubestate[9], cubestate[10], cubestate[35], cubestate[12], cubestate[13], cubestate[34], cubestate[15], cubestate[16], cubestate[33], cubestate[18], cubestate[19], cubestate[20], cubestate[21], cubestate[22], cubestate[23], cubestate[24], cubestate[25], cubestate[26], cubestate[27], cubestate[28], cubestate[29], cubestate[30], cubestate[31], cubestate[32], cubestate[36], cubestate[39], cubestate[42], cubestate[2], cubestate[37], cubestate[38], cubestate[1], cubestate[40], cubestate[41], cubestate[0], cubestate[43], cubestate[44], cubestate[51], cubestate[48], cubestate[45], cubestate[52], cubestate[49], cubestate[46], cubestate[53], cubestate[50], cubestate[47]];
        }

    }

    this.doE = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[1], cubestate[2], cubestate[3], cubestate[4], cubestate[5], cubestate[6], cubestate[7], cubestate[8], cubestate[9], cubestate[10], cubestate[11], cubestate[21], cubestate[22], cubestate[23], cubestate[15], cubestate[16], cubestate[17], cubestate[18], cubestate[19], cubestate[20], cubestate[39], cubestate[40], cubestate[41], cubestate[24], cubestate[25], cubestate[26], cubestate[27], cubestate[28], cubestate[29], cubestate[30], cubestate[31], cubestate[32], cubestate[33], cubestate[34], cubestate[35], cubestate[36], cubestate[37], cubestate[38], cubestate[48], cubestate[49], cubestate[50], cubestate[42], cubestate[43], cubestate[44], cubestate[45], cubestate[46], cubestate[47], cubestate[12], cubestate[13], cubestate[14], cubestate[51], cubestate[52], cubestate[53]];
        }

    }

    this.doM = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[52], cubestate[2], cubestate[3], cubestate[49], cubestate[5], cubestate[6], cubestate[46], cubestate[8], cubestate[9], cubestate[10], cubestate[11], cubestate[12], cubestate[13], cubestate[14], cubestate[15], cubestate[16], cubestate[17], cubestate[18], cubestate[1], cubestate[20], cubestate[21], cubestate[4], cubestate[23], cubestate[24], cubestate[7], cubestate[26], cubestate[27], cubestate[19], cubestate[29], cubestate[30], cubestate[22], cubestate[32], cubestate[33], cubestate[25], cubestate[35], cubestate[36], cubestate[37], cubestate[38], cubestate[39], cubestate[40], cubestate[41], cubestate[42], cubestate[43], cubestate[44], cubestate[45], cubestate[34], cubestate[47], cubestate[48], cubestate[31], cubestate[50], cubestate[51], cubestate[28], cubestate[53]];
        }

    }

    this.doS = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[1], cubestate[2], cubestate[43], cubestate[40], cubestate[37], cubestate[6], cubestate[7], cubestate[8], cubestate[9], cubestate[3], cubestate[11], cubestate[12], cubestate[4], cubestate[14], cubestate[15], cubestate[5], cubestate[17], cubestate[18], cubestate[19], cubestate[20], cubestate[21], cubestate[22], cubestate[23], cubestate[24], cubestate[25], cubestate[26], cubestate[27], cubestate[28], cubestate[29], cubestate[16], cubestate[13], cubestate[10], cubestate[33], cubestate[34], cubestate[35], cubestate[36], cubestate[30], cubestate[38], cubestate[39], cubestate[31], cubestate[41], cubestate[42], cubestate[32], cubestate[44], cubestate[45], cubestate[46], cubestate[47], cubestate[48], cubestate[49], cubestate[50], cubestate[51], cubestate[52], cubestate[53]];
        }

    }

    this.doX = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.doR(1);
            this.doM(3);
            this.doL(3);
        }
    }

    this.doY = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;

            this.doU(1);
            this.doE(3);
            this.doD(3);
        }
    }

    this.doZ = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;

            this.doF(1);
            this.doS(1);
            this.doB(3);
        }
    }

    this.doUw = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.doE(3);
            this.doU(1);

        }

    }

    this.doRw = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.doM(3);
            this.doR(1);
        }

    }

    this.doFw = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.doS(1);
            this.doF(1);
        }

    }

    this.doDw = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.doE(1);
            this.doD(1);
        }

    }

    this.doLw = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.doM(1);
            this.doL(1);
        }

    }

    this.doBw = function (times) {
        var i;
        for (i = 0; i < times; i++) {
            var cubestate = this.cubestate;
            this.doS(3);
            this.doB(1);
        }

    }
}

RubiksCube.prototype.getThreeCycleMapping = function (edgeBuffer, cornerBuffer) {
    const unsolvedPositions = [];

    // Step 1: Identify unsolved positions
    for (let i = 0; i < this.cubestate.length; i++) {
        if (this.cubestate[i][0] !== SOLVED_POSITIONS[i][0] || this.cubestate[i][1] !== SOLVED_POSITIONS[i][1]) {
            unsolvedPositions.push(i);
        }
    }

    // Determine if it's an edge cycle or a corner cycle
    let bufferPosition;
    if (unsolvedPositions.length === 6) {
        bufferPosition = edgeBuffer; // Edge cycle
    } else if (unsolvedPositions.length === 9) {
        bufferPosition = cornerBuffer; // Corner cycle
    } else {
        console.log("Not a valid 3-cycle: ", unsolvedPositions);
        return null;
    }

    // Step 2: Determine the target positions
    const cycleMapping = {};
    for (const pos of unsolvedPositions) {
        const targetPosition = this.cubestate[pos][1]; // Where the piece should go
        cycleMapping[pos] = targetPosition;
    }

    // Step 3: Find the cycle containing the buffer
    const visited = new Set();
    const cycle = [];
    let current = bufferPosition;

    while (!visited.has(current)) {
        visited.add(current);
        cycle.push(current);
        current = cycleMapping[current];
    }

    // Ensure the cycle is valid (contains exactly 3 positions)
    if (cycle.length !== 3) {
        console.log("Invalid cycle for buffer position:", bufferPosition);
        return null;
    }

    return cycle;
};

function parseLettersForTTS(letters) {
    if (letters.length === 2) {
        const pair = letters.join(""); // Combine letters into a pair (e.g., "AG")
        const word = LETTER_PAIR_TO_WORD[pair]; // Look up the word for the pair

        if (word && word.trim() !== "") {
            return word; // Return the word if found
        } else {
            return letters.join(" "); // Fallback: Return the letters individually
        }
    } else {
        return letters.join(" "); // Fallback for non-pairs
    }
}


function checkForSpecialSequences() {
    const recentMoves = moveHistory.join("");

    // this needs to be commented out if we wanna use D8
    // if (recentMoves.endsWith("D D D D ") || recentMoves.endsWith("D'D'D'D'")) {
    //     console.log("Special sequence detected: D4");
    //     triggerSpecialAction("D4");
    // }

    if (recentMoves.endsWith("D D D D D D D D ") || recentMoves.endsWith("D'D'D'D'D'D'D'D'")) {
        console.log("Special sequence detected: D4");
        triggerSpecialAction("D8");
    }

    if (recentMoves.endsWith("B B B B ") || recentMoves.endsWith("B'B'B'B'")) {
        console.log("Special sequence detected: B4");
        triggerSpecialAction("B4");
    }

    // Add more sequences as needed
    if (recentMoves.endsWith("L L L L ") || recentMoves.endsWith("L'L'L'L'")) {
        console.log("Special sequence detected: L4");
        triggerSpecialAction("L4");
    }

    // Add more sequences as needed
    if (recentMoves.endsWith("F F F F ") || recentMoves.endsWith("F'F'F'F'")) {
        console.log("Special sequence detected: F4");
        triggerSpecialAction("F4");
    }

    // Add more sequences as needed
    if (recentMoves.endsWith("R R R R ") || recentMoves.endsWith("R'R'R'R'")) {
        console.log("Special sequence detected: R4");
        triggerSpecialAction("R4");
    }

    // Add more sequences as needed
    if (recentMoves.endsWith("U U U U U U U U ") || recentMoves.endsWith("U'U'U'U'U'U'U'U'")) {
        console.log("Special sequence detected: U6");
        triggerSpecialAction("U6");
    }
}

function determineReadingMode(text) {
    return processRegularMode(text);
}

function processRegularMode(text) {
    // Check if the user is on a mobile device
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    // Preprocess the text to add separators based on the device type
    return text
        .split(" ") // Split into individual moves
        .map(move => {
            if (move.endsWith("'") || move.endsWith("2")) {
                return move; // Keep moves with a prime or "2" unchanged
            }
            return isMobile ? move : `${move},`; // Add a comma for non-mobile devices
        })
        .join(isMobile ? "," : " "); // Join with spaces for both, but commas are added for non-mobile
}

function speakText(text, rate = 1.0, readComm = false, readHype = false) {
    const enableTTS = localStorage.getItem("enableTTS") === "true";

    if (!enableTTS) {
        console.log("TTS is disabled.");
        return; // Exit if TTS is disabled
    }

    if ('speechSynthesis' in window) {
        // Create the utterance instance only once
        if (!utterance) {
            utterance = new SpeechSynthesisUtterance();
        }

        // Stop any ongoing speech before speaking new text
        window.speechSynthesis.cancel();

        // Set properties directly to avoid redundant operations
        utterance.rate = rate; // Adjust speed
        utterance.lang = localStorage.getItem("ttsLanguage") || "pl-PL"; // Get language or use default

        // Process the text using the extracted method
        if (!readHype) {
            utterance.text = processTextForTTS(text, readComm);
        } else {
            utterance.text = text; // Use the original text for hype reading
        }

        // Speak the text immediately
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Text-to-Speech is not supported in this browser.');
    }
}

function processTextForTTS(text, readComm = false) {
    if (readComm) {
        // Handle the case where readComm is true
        if (currentMode === "corner") {
            // If the mode is "corner", only read up to the first occurrence of ":"
            const colonIndex = text.indexOf(":");
            if (colonIndex !== -1) {
                text = text.substring(0, colonIndex).trim(); // Extract text before the colon
            } else {
                return "czysty kom lub dziewięcioruchowiec"; // Return default text if no colon is found
            }
        }

        // Preprocess the text to replace special characters with words
        const replacements = {
            ":": " potem",
            "'": " priim",
            "/": " slesz"
        };

        // Dynamically construct the regex from the keys of the replacements map
        const regex = new RegExp(`[${Object.keys(replacements).join("")}]`, "g");

        // Replace all matches using the replacements map
        let processedText = text.replace(regex, match => replacements[match]);

        // Ensure spaces are preserved between moves
        processedText = processedText.split(" ").join(" ");

        return processedText;
    } else {
        // Determine the reading mode and process the text
        return determineReadingMode(text);
    }
}

function triggerSpecialAction(sequence) {
    moveHistory.length = 0; // Clear the history after checking
    switch (sequence) {
        case "D8":
            console.log("D4 detected! Reading out current displayed scramble");
            // Retrieve the scramble currently displayed on the screen
            const displayedScrambleElement = document.getElementById("scramble");
            const displayedScrambleText = displayedScrambleElement ? displayedScrambleElement.textContent : null;

            if (displayedScrambleText) {
                console.log("Reading out displayed scramble:", displayedScrambleText);
                speakText(displayedScrambleText, 1, true); // Trigger TTS to read out the displayed scramble
            } else {
                console.warn("No displayed scramble available to read out.");
            }
            markCurrentCommAsBad();
            break;
        case "B4":
            console.log("B4 detected! Marking last alg as bad");
            markLastCommAsBad();
            break;
        case "F4":
            console.log("F4 detected! Retrying current alg");
            markCurrentCommAsBad();
            retryCurrentAlgorithm();
            break;
        case "L4":
            console.log("L4 detected! Advancing drill or running next alg.");
            if (isDrillingMode) {
                advanceDrill(); // Special action for drilling mode
            } else {
                markCurrentCommAsBad(); // Original behavior for regular mode
                nextScramble();
            }
            break;
        case "R4":
            console.log("R4 detected! Marking last comm as drill/change alg");
            changeAlg.play();
            markLastCommAsChange();
            break;
        case "U6":
            console.log("U6 detected! Marking last alg as good");
            goodAlg.play(); // Play a sound to indicate success
            markLastCommAsGood();
            break;
        default:
            console.log(`No action defined for sequence: ${sequence}`);
    }
}

function enableTtsOnStartup() {
    const enableTTSCheckbox = document.getElementById("enableTTS");
    const savedTTSState = localStorage.getItem("enableTTS");

    // Set the checkbox state based on the saved value or default to true
    enableTTSCheckbox.checked = savedTTSState === "true";

    // Add an event listener to update localStorage when the checkbox is toggled
    enableTTSCheckbox.addEventListener("change", function () {
        localStorage.setItem("enableTTS", enableTTSCheckbox.checked);
    });
}

async function connectSmartCube() {
    try {
        if (conn) {
            // Disconnect the cube if already connected
            await conn.disconnect();
            connectSmartCubeElement.textContent = 'Connect';
            alert(`Smart cube ${conn.deviceName} disconnected`);
            conn = null;
        } else {
            // Attempt to connect to the cube
            conn = await connect(applyMoves);
            if (!conn) {
                alert(`Smart cube is not supported`);
            } else {
                await conn.initAsync();
                connectSmartCubeElement.textContent = 'Disconnect';

                // Check the current progress
                const progressText = document.getElementById("progressDisplay").innerText;
                const [currentProgress, totalProgress] = progressText
                    .replace("Progress: ", "")
                    .split("/")
                    .map(Number);

                if (currentProgress === 0) {
                    initializeSession(); // Initialize the session if no progress
                } else {
                    // Retry the current scramble if progress is higher than 0
                    retryCurrentAlgorithm();
                }
            }
        }
    } catch (e) {
        console.error("Error connecting to smart cube:", e);
        connectSmartCubeElement.textContent = 'Connect';
    }
}

function retryCurrentAlgorithm() {
    // Get the last tested algorithm from the history
    const lastTest = algorithmHistory[algorithmHistory.length - 1];
    stopTimer(false);

    if (!lastTest) {
        alert("No algorithm to retry.");
        return;
    }

    // Reset the cube and apply the scramble
    cube.resetCube();
    doAlg(lastTest.scramble, false);
    updateVirtualCube();

    // Reset the timer display
    document.getElementById("timer").innerHTML = "0.00";

    // Optionally, display the algorithm and cycle letters again
    document.getElementById("scramble").innerHTML = `<span>${lastTest.orientRandPart}</span> ${lastTest.rawAlgs[0]}`;
    document.getElementById("cycle").innerHTML = lastTest.cycleLetters;

    // Trigger TTS to read out the cycle letters
    speakText(parseLettersForTTS(lastTest.cycleLetters.split("")));

    console.log("Retrying algorithm:", lastTest.rawAlgs[0]);
    startTimer();
}

const cycleFeedbackMap = new Map(); // Map to store cycle letters and feedback (1 for good, 0 for bad)

function markCurrentCommAsGood() {
    const lastTest = algorithmHistory[algorithmHistory.length - 1];
    if (!lastTest) {
        console.warn("No cycle letters available to mark as good.");
        return;
    }

    const cycleLetters = lastTest.cycleLetters;
    if (!cycleFeedbackMap.has(cycleLetters)) {
        cycleFeedbackMap.set(cycleLetters, 1); // Add cycle letters with value 1 (good)
        console.log(`Marked "${cycleLetters}" as Good.`);
        updateLastCycleInfo(); // Update the last cycle letters
        updateFeedbackResults(); // Update the results view
    } else {
        console.warn(`"${cycleLetters}" is already marked as ${cycleFeedbackMap.get(cycleLetters) === 1 ? "Good" : "Bad"}.`);
    }
}

function markCurrentCommAsBad() {
    const lastTest = algorithmHistory[algorithmHistory.length - 1];
    if (!lastTest) {
        console.warn("No cycle letters available to mark as bad.");
        return;
    }

    const cycleLetters = lastTest.cycleLetters;
    if (!cycleFeedbackMap.has(cycleLetters)) {
        cycleFeedbackMap.set(cycleLetters, 0); // Add cycle letters with value 0 (bad)
        console.log(`Marked "${cycleLetters}" as Bad.`);
        updateLastCycleInfo(); // Update the last cycle letters
        updateFeedbackResults(); // Update the results view
    } else {
        console.warn(`"${cycleLetters}" is already marked as ${cycleFeedbackMap.get(cycleLetters) === 1 ? "Good" : "Bad"}.`);
    }
}

function markLastCommAsChange() {
    const lastCycleLettersElement = document.getElementById("lastCycleLetters");
    const cycleLetters = lastCycleLettersElement.textContent;

    if (!cycleLetters || cycleLetters === "None") {
        console.warn("No cycle letters available to mark as Change/Drill alg.");
        return;
    }

    if (!cycleFeedbackMap.has(cycleLetters)) {
        console.warn(`"${cycleLetters}" is not in the feedback map.`);
        return;
    }

    // Change the feedback value to 2 (Change/Drill alg)
    cycleFeedbackMap.set(cycleLetters, 2);

    console.log(`Marked "${cycleLetters}" as Change/Drill alg.`);
    updateFeedbackResults(); // Update the results view
}

document.getElementById("goodButton").addEventListener("click", markCurrentCommAsGood);
document.getElementById("badButton").addEventListener("click", markCurrentCommAsBad);

document.addEventListener("keydown", function (event) {
    if (event.key === "g" || event.key === "1") {
        markCurrentCommAsGood();
    } else if (event.key === "b" || event.key === "2") {
        markCurrentCommAsBad();
    } else if (event.key === "n" || event.key === "N" || event.key === "3") {
        nextScramble();
    } else if (event.key === "4") {
        triggerSpecialAction("D4");
    }
});

function updateFeedbackResults() {
    const goodListElement = document.getElementById("goodList");
    const badListElement = document.getElementById("badList");
    const changeListElement = document.getElementById("changeList");

    const lastCycleLettersElement = document.getElementById("lastCycleLetters");
    const lastCycleLetters = lastCycleLettersElement.textContent;

    // Separate the cycle letters into good, bad, and change lists
    const goodCycles = [];
    const badCycles = [];
    const changeCycles = [];

    cycleFeedbackMap.forEach((value, key) => {
        if (value === 1) {
            goodCycles.push(key);
        } else if (value === 0) {
            badCycles.push(key);
        } else if (value === 2) {
            changeCycles.push(key);
        }
    });

    // Sort the lists using the custom comparator
    goodCycles.sort(customComparator);
    badCycles.sort(customComparator);
    changeCycles.sort(customComparator);

    // Format the lists and highlight the last cycle letters
    goodListElement.innerHTML = formatListWithHighlight(goodCycles, lastCycleLetters);
    badListElement.innerHTML = formatListWithHighlight(badCycles, lastCycleLetters);
    changeListElement.innerHTML = formatListWithHighlight(changeCycles, lastCycleLetters);
}

// Helper function to format the list and highlight the last cycle letters
function formatListWithHighlight(list, highlightItem) {
    return list
        .map(item => {
            if (item === highlightItem) {
                return `<span style="font-weight: bold; text-decoration: underline; color: yellow;">${item}</span>`;
            }
            return item;
        })
        .join(", ");
}

function customComparator(a, b) {
    const letterOrder = "AOIEFGHJJKLMNBPQTSRCDWZ"; // Custom letter order
    const getOrder = (letter) => letterOrder.indexOf(letter);

    // Compare the first letters of the cycle pairs
    const firstLetterComparison = getOrder(a[0]) - getOrder(b[0]);
    if (firstLetterComparison !== 0) {
        return firstLetterComparison;
    }

    // If the first letters are the same, compare the second letters
    return getOrder(a[1]) - getOrder(b[1]);
}

function revealScramble() {
    const scrambleElement = document.getElementById("scramble");
    scrambleElement.classList.remove("obfuscated");
    scrambleElement.classList.add("revealed");
}

function hideScramble() {
    const scrambleElement = document.getElementById("scramble");
    const obfuscateScrambleCheckbox = document.getElementById("obfuscateScrambleCheckbox");

    // Only obfuscate the scramble if the checkbox is checked
    if (obfuscateScrambleCheckbox.checked) {
        scrambleElement.classList.remove("revealed");
        scrambleElement.classList.add("obfuscated");
      //  console.log("Scramble obfuscated.");
    } else {
        revealScramble();
      //  console.log("Scramble shown by default.");
    }
}

const obfuscateScrambleCheckbox = document.getElementById("obfuscateScrambleCheckbox");

// Load the saved state from localStorage
const savedObfuscateState = localStorage.getItem("obfuscateScramble") === "true";
obfuscateScrambleCheckbox.checked = savedObfuscateState;

// Add an event listener to update localStorage when the checkbox is toggled
obfuscateScrambleCheckbox.addEventListener("change", function () {
    localStorage.setItem("obfuscateScramble", obfuscateScrambleCheckbox.checked);
    console.log(`Obfuscate Scramble is now ${obfuscateScrambleCheckbox.checked ? "enabled" : "disabled"}`);
});

function copyScrambleAndCycle(scrambleId, cycleId, usePrevious = false) {
    let scrambleText, cycleLetters;

    if (usePrevious) {
        // Use previous cycle and scramble data
        scrambleText = previousScramble || "No previous scramble available";
        cycleLetters = previousCycle || "No previous cycle available";
    } else {
        // Use current cycle and scramble data
        scrambleText = document.getElementById(scrambleId).textContent.trim();
        cycleLetters = document.getElementById(cycleId).textContent.trim();
    }

    const pieceNotation = getPieceNotation(cycleLetters); // Get the piece notation

    if (scrambleText && pieceNotation) {
        const combinedText = `${scrambleText} - ${pieceNotation}`; // Combine scramble and piece notation
        navigator.clipboard.writeText(combinedText).then(() => {
            console.log("Copied to clipboard:", combinedText);
        }).catch(err => {
            console.error("Failed to copy to clipboard:", err);
        });
    } else {
        console.warn("Missing scramble text or piece notation.");
    }
}

document.getElementById("scramble").addEventListener("click", function () {
    const obfuscateScrambleCheckbox = document.getElementById("obfuscateScrambleCheckbox");

    if (obfuscateScrambleCheckbox.checked) {
        // If obfuscate scramble is enabled, reveal the scramble
        revealScramble();
    } else {
        // Call the extracted function to copy the scramble and cycle letters
        copyScrambleAndCycle("scramble", "cycle");
    }
});

function updateLastCycleInfo() {
    const lastTest = algorithmHistory[algorithmHistory.length - 1];
    const lastCycleLettersElement = document.getElementById("lastCycleLetters");
    const lastScrambleElement = document.getElementById("lastScramble");

    if (lastTest) {
        // Update cycle letters
        const cycleLetters = lastTest.cycleLetters || "None";
        lastCycleLettersElement.textContent = cycleLetters;

        // Use getPieceNotation to get the formatted positions
        const formattedPositions = getPieceNotation(cycleLetters);

        if (!formattedPositions || formattedPositions.includes("Unknown")) {
            console.warn("Missing mapping for one or more letters:", cycleLetters);
            window.lastCyclePositions = "Unknown"; // Fallback to "Unknown"
        } else {
            window.lastCyclePositions = formattedPositions; // Store globally for reuse
        }

        // Update scramble
        try {
            lastScrambleElement.textContent = lastTest.rawAlgs[0] || "None";
        } catch (error) {
            console.error("Error retrieving commutator notation:", error);
            lastScrambleElement.textContent = "None"; // Fallback to "None"
        }

        // **Update previous scramble and cycle variables**
        previousScramble = lastScrambleElement.textContent.trim();
        previousCycle = lastCycleLettersElement.textContent.trim();
    } else {
        lastCycleLettersElement.textContent = "None";
        lastScrambleElement.textContent = "None";
        window.lastCyclePositions = null; // Clear stored positions

        // **Clear previous scramble and cycle variables**
        previousScramble = "";
        previousCycle = "";
    }
}

function copyFeedbackToClipboard() {
    const goodList = document.getElementById("goodList").textContent.split(", ");
    const badList = document.getElementById("badList").textContent.split(", ");
    const changeDrillList = document.getElementById("changeList").textContent.split(", ");

    // Helper function to group elements by their starting letter
    function groupByStartingLetter(list) {
        const grouped = {};
        list.forEach(item => {
            const firstLetter = item[0];
            if (!grouped[firstLetter]) {
                grouped[firstLetter] = [];
            }
            grouped[firstLetter].push(item);
        });

        // Format the grouped elements into lines
        return Object.values(grouped)
            .map(group => group.join(" "))
            .join("\n");
    }

    // Format each list
    const formattedGoodList = groupByStartingLetter(goodList);
    const formattedBadList = groupByStartingLetter(badList);
    const formattedChangeDrillList = groupByStartingLetter(changeDrillList);

    // Combine the formatted lists with labels
    const feedbackText = `Good:\n${formattedGoodList}\n\nChange/Drill:\n${formattedChangeDrillList}\n\nBad:\n${formattedBadList}`;

    // Copy the content to the clipboard
    navigator.clipboard.writeText(feedbackText).then(() => {
        console.log("Feedback copied to clipboard!");
        //alert("Feedback copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy feedback to clipboard:", err);
        alert("Failed to copy feedback to clipboard.");
    });
}

// Function to copy text to clipboard
function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text).then(() => {
        console.log(`Copied: ${text}`);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

// Function to convert cycle letters to UFR/UF format and copy to clipboard
function copyCyclePositions(originId = "none") {
    let cycleData;

    // Determine the source of the invocation
    if (originId === "lastCycleLetters" || originId === "lastScramble") {
        // Use the previous cycle data
        cycleData = previousCycle || "No previous cycle data available";
    } else {
        // Use the current cycle data
        cycleData = document.getElementById("cycle").innerText.trim();
    }

    // Convert cycle letters to piece notation
    const pieceNotation = getPieceNotation(cycleData);

    if (!pieceNotation) {
        console.warn("Failed to convert cycle letters to piece notation.");
        return;
    }

    // Add the "?how" prefix to the piece notation
    const formattedData = `?how ${pieceNotation}`;

    // Copy the formatted data to the clipboard
    navigator.clipboard.writeText(formattedData).then(() => {
        console.log("Cycle data copied to clipboard:", formattedData);
    }).catch(err => {
        console.error("Failed to copy cycle data to clipboard:", err);
    });
}

document.getElementById("copyFeedbackButton").addEventListener("click", copyFeedbackToClipboard);

function markLastCommAsBad() {
    const lastCycleLettersElement = document.getElementById("lastCycleLetters");
    const cycleLetters = lastCycleLettersElement.textContent;

    if (!cycleLetters || cycleLetters === "None") {
        console.warn("No cycle letters available to mark as Bad.");
        return;
    }

    if (!cycleFeedbackMap.has(cycleLetters)) {
        console.warn(`"${cycleLetters}" is not in the feedback map.`);
        return;
    }

    // Set the feedback value to 0 (Bad)
    cycleFeedbackMap.set(cycleLetters, 0);

    console.log(`Marked "${cycleLetters}" as Bad.`);
    updateFeedbackResults(); // Update the results view
}

function markLastCommAsGood() {
    const lastCycleLettersElement = document.getElementById("lastCycleLetters");
    const cycleLetters = lastCycleLettersElement.textContent;

    if (!cycleLetters || cycleLetters === "None") {
        console.warn("No cycle letters available to mark as Good.");
        return;
    }

    if (!cycleFeedbackMap.has(cycleLetters)) {
        console.warn(`"${cycleLetters}" is not in the feedback map.`);
        return;
    }

    // Set the feedback value to 1 (Good)
    cycleFeedbackMap.set(cycleLetters, 1);

    console.log(`Marked "${cycleLetters}" as Good.`);
    updateFeedbackResults(); // Update the results view
}

document.getElementById("clearUserAlgsButton").addEventListener("click", function () {
    const userDefinedAlgs = document.getElementById("userDefinedAlgs");
    userDefinedAlgs.value = ""; // Clear the textarea
    console.log("User-defined algs cleared.");
});

let fetchedAlgs = []; // Array to store fetched algorithms

// Label to display the last fetch date
const lastFetchLabel = document.getElementById("lastFetchLabel");

// Load cached algorithms and fetch date from localStorage
function loadCachedAlgs() {
    const cachedAlgs = localStorage.getItem("fetchedAlgs");
    const lastFetchDate = localStorage.getItem("lastFetchDate");

    if (cachedAlgs && lastFetchDate) {
        fetchedAlgs = JSON.parse(cachedAlgs);
        lastFetchLabel.innerHTML = `<span style="color: #00FF00; font-size: 20px;">Last Fetch: ${lastFetchDate}</span>`;
    } else {
        lastFetchLabel.innerHTML = `<span style="color: red; font-size: 30px;">NO ALGS</span>`;
    }
}

function saveFetchedAlgs(algs) {
    const currentDate = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });
    localStorage.setItem(getStorageKey("fetchedAlgs"), JSON.stringify(algs));
    localStorage.setItem(getStorageKey("lastFetchDate"), currentDate);
    lastFetchLabel.innerHTML = `<span style="color: #00FF00; font-size: 20px">Last Fetch: ${currentDate}</span>`;
}

function loadFetchedAlgs() {
    const cachedAlgs = localStorage.getItem(getStorageKey("fetchedAlgs"));
    const lastFetchDate = localStorage.getItem(getStorageKey("lastFetchDate"));

    if (cachedAlgs && lastFetchDate) {
        fetchedAlgs = JSON.parse(cachedAlgs);
        lastFetchLabel.innerHTML = `<span style="color: #00FF00; font-size: 20px;">Last Fetch: ${lastFetchDate}</span>`;
      //  console.log("Fetched algorithms loaded:", fetchedAlgs);
    } else {
        fetchedAlgs = [];
        lastFetchLabel.innerHTML = `<span style="color: red; font-size: 30px;">NO ALGS</span>`;
    }
}

async function fetchAlgs() {
    try {
        console.log("Fetching algorithms from proxy...");
        const res = await fetch(PROXY_URL);
        const text = await res.text();
        console.log("Algorithms fetched successfully. Parsing data...");

        // Parse TSV and extract the first and second columns
        fetchedAlgs = text
            .split("\n") // Split into rows
            .map(row => row.split("\t")) // Split each row into columns
            .filter(columns => columns.length >= 2) // Ensure there are at least two columns
            .map(columns => ({ key: columns[0].trim(), value: columns[1].trim() })) // Map as key-value pairs and trim whitespace
            .filter(pair => pair.key !== "" && pair.value !== "" && pair.value !== "\r"); // Prune invalid pairs

        console.log("Fetched algorithms:", fetchedAlgs);
        saveFetchedAlgs(fetchedAlgs); // Save to localStorage
    } catch (err) {
        console.error("Failed to fetch algorithms:", err);
        alert("Failed to fetch algorithms.");
    }
}

// Load cached algorithms on page load
document.addEventListener("DOMContentLoaded", loadCachedAlgs);

// Add an event listener to the fetch button
document.getElementById("fetchAlgsButton").addEventListener("click", fetchAlgs);


document.addEventListener("DOMContentLoaded", function () {
    // Ensure the grid is hidden on page load
    const selectionGrid = document.getElementById("selectionGrid");
    selectionGrid.style.display = "none"; // Explicitly set the initial display property
});

// Object to store the state of each set (toggled on/off)
const selectedSets = {};

// New state for the inverses toggle
let disableInversesMode = localStorage.getItem(getStorageKey("disableInversesMode")) === "true";

document.getElementById("letterSelector").addEventListener("click", function () {
    const selectionGrid = document.getElementById("selectionGrid");
    
    // 1. CLEAR PREVIOUS CONTENT (Prevents duplicate buttons/rows)
    selectionGrid.innerHTML = "";

    // --- HEADER (Close Button) ---
    const headerDiv = document.createElement("div");
    headerDiv.style.display = "flex";
    headerDiv.style.justifyContent = "flex-end";
    headerDiv.style.padding = "0 0 5px 0";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "X";
    closeBtn.className = "close-button close-set"; 
    closeBtn.style.backgroundColor = "#dc3545"; 
    closeBtn.style.color = "white";
    closeBtn.addEventListener("click", () => selectionGrid.style.display = "none");
    headerDiv.appendChild(closeBtn);
    selectionGrid.appendChild(headerDiv);

    // --- TITLE & SUBTITLE ---
    const titleContainer = document.createElement("div");
    titleContainer.className = "selector-title-container";

    const mainTitle = document.createElement("h2");
    mainTitle.textContent = "Select sets to practice";
    mainTitle.className = "selector-main-title";

    const subTitle = document.createElement("p");
    subTitle.textContent = "Inverses are separated for easier control";
    subTitle.className = "selector-sub-title";

    titleContainer.appendChild(mainTitle);
    titleContainer.appendChild(subTitle);
    selectionGrid.appendChild(titleContainer);

    // --- ACTION BUTTONS ---
    const actionsDiv = document.createElement("div");
    actionsDiv.style.textAlign = "center";
    actionsDiv.style.marginBottom = "15px";

    // Toggle All Button
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Toggle All Sets";
    toggleBtn.className = "large-button"; 
    toggleBtn.style.marginRight = "10px";
    toggleBtn.addEventListener("click", () => {
        const allKeys = Object.keys(selectedSets);
        const anyOn = allKeys.some(k => selectedSets[k]);
        const newState = !anyOn; 
        
        // Update Visuals
        document.querySelectorAll(".set-btn").forEach(btn => {
            if (!btn.disabled) {
                btn.classList.toggle("untoggled", !newState);
                const letter = btn.dataset.letter;
                const pos = btn.dataset.position; 
                const setKey = pos === 'first' ? `${letter}_` : `_${letter}`;
                selectedSets[setKey] = newState;
            }
        });
        
        // Update Logic
        fetchedAlgs.forEach(alg => stickerState[alg.key] = newState);
        
        saveSelectedSets();
        saveStickerState();
    });

    // Save & Apply Button
    const applyBtn = document.createElement("button");
    applyBtn.textContent = "Save & apply";
    applyBtn.className = "large-button";
    applyBtn.style.backgroundColor = "#28a745"; 
    applyBtn.addEventListener("click", () => {
        updateUserDefinedAlgs();
        selectionGrid.style.display = "none";
    });

    actionsDiv.appendChild(toggleBtn);
    actionsDiv.appendChild(applyBtn);
    selectionGrid.appendChild(actionsDiv);

    // --- LABELS (First target / Second target) ---
    const labelsDiv = document.createElement("div");
    labelsDiv.className = "set-labels-container";

    const leftLabel = document.createElement("div");
    leftLabel.className = "set-label";
    leftLabel.textContent = "First target";

    const spacer = document.createElement("div");
    spacer.className = "set-label-spacer";

    const rightLabel = document.createElement("div");
    rightLabel.className = "set-label";
    rightLabel.textContent = "Second target";

    labelsDiv.appendChild(leftLabel);
    labelsDiv.appendChild(spacer);
    labelsDiv.appendChild(rightLabel);
    selectionGrid.appendChild(labelsDiv);

    // --- GENERATE FACE ROWS ---
    const faces = [
        { name: "U", indices: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
        { name: "L", indices: [36, 37, 38, 39, 40, 41, 42, 43, 44] },
        { name: "F", indices: [18, 19, 20, 21, 22, 23, 24, 25, 26] },
        { name: "R", indices: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
        { name: "B", indices: [45, 46, 47, 48, 49, 50, 51, 52, 53] },
        { name: "D", indices: [27, 28, 29, 30, 31, 32, 33, 34, 35] }
    ];

    const BUFFER_INDICES = currentMode === "edge" ? [7, 19] : [8, 9, 20];
    const validIndices = new Set(currentMode === "corner" ? CORNER_FACELET_INDICES : EDGE_FACELET_INDICES);

    faces.forEach(face => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "face-row";

        const leftGroup = document.createElement("div");
        leftGroup.className = "face-group";

        const rightGroup = document.createElement("div");
        rightGroup.className = "face-group";

        const faceLetters = new Set();
        
        face.indices.forEach(index => {
            if (validIndices.has(index)) {
                let letter = POSITION_TO_LETTER_MAP[index];
                if (letter && letter.trim() !== "" && letter !== "-" && !faceLetters.has(letter)) {
                    faceLetters.add(letter);

                    const createBtn = (pos) => {
                        const btn = document.createElement("button");
                        btn.className = `set-btn face-${face.name}`;
                        btn.textContent = pos === 'first' ? `${letter}_` : `_${letter}`;
                        btn.dataset.letter = letter;
                        btn.dataset.position = pos;

                        const isBuffer = BUFFER_INDICES.includes(index);

                        if (isBuffer) {
                            btn.classList.add("buffer");
                            btn.disabled = true;
                            btn.title = "Buffer Piece";
                        } else {
                            const setKey = pos === 'first' ? `${letter}_` : `_${letter}`;
                            if (selectedSets[setKey] === undefined) selectedSets[setKey] = true;
                            
                            if (!selectedSets[setKey]) {
                                btn.classList.add("untoggled");
                            }

                            btn.addEventListener("click", () => handleGridButtonClick(btn, letter, pos));
                            
                            btn.addEventListener("contextmenu", (e) => {
                                e.preventDefault();
                                showPairSelectionGrid(letter);
                            });
                            
                            btn.addEventListener("touchstart", () => {
                                const timer = setTimeout(() => showPairSelectionGrid(letter), 500);
                                btn.addEventListener("touchend", () => clearTimeout(timer), {once: true});
                            });
                        }
                        return btn;
                    };

                    leftGroup.appendChild(createBtn('first'));
                    rightGroup.appendChild(createBtn('second'));
                }
            }
        });

        if (leftGroup.children.length > 0) {
            rowDiv.appendChild(leftGroup);
            
            const sep = document.createElement("div");
            sep.className = "face-separator";
            rowDiv.appendChild(sep);

            rowDiv.appendChild(rightGroup);
            selectionGrid.appendChild(rowDiv);
        }
    });

    selectionGrid.style.display = "block";
});

function updateUserDefinedAlgs() {
    console.log("Filtering algorithms based on centralized stickerState...");

    // Filter algs where the specific pair key (e.g. "AB") is NOT false.
    const uniqueAlgs = [...new Set(
        fetchedAlgs
            .filter(pair => stickerState[pair.key] !== false)
            .map(pair => pair.value.trim())
    )];

    document.getElementById("userDefinedAlgs").value = uniqueAlgs.join("\n");
    console.log(`Updated textbox with ${uniqueAlgs.length} algorithms.`);
}

function filterAlgorithmsVerbose(selectedSetNames, fetchedAlgs, stickerState, selectedSets) {
    console.log("Starting optimized filtering...");

    // Create a Set for active sets for faster lookups
    const activeSets = new Set(selectedSetNames);

    // Filter algorithms in a single pass
    const filteredAlgs = fetchedAlgs.filter(pair => {
        const isStickerSelected = stickerState[pair.key] ?? true; // Check if the sticker is selected
        const [firstLetter, secondLetter] = pair.key.split(""); // Split the pair into letters
        const isSetActive = activeSets.has(firstLetter) || activeSets.has(secondLetter); // Check if either set is active

        return isStickerSelected && isSetActive; // Include only if both conditions are met
    });

    // Extract unique algorithm values
    const uniqueAlgs = [...new Set(filteredAlgs.map(pair => pair.value.trim()))];

    console.log("Filtered and unique algorithms:", uniqueAlgs);

    return uniqueAlgs;
}

document.addEventListener("DOMContentLoaded", function () {
    loadStickerState(); // Load sticker state
    loadSelectedSets(); // Load selected sets
});

const ALL_LETTERS = "AOIEFGHJKLNBPQTSRCDWZ".split(""); // Array of all letters

// Predefined excluded trios
const EXCLUDED_TRIOS_CORNERS = [
    ["A", "E", "R"], // Trio 1
    ["O", "Q", "N"], // Trio 2
    ["I", "J", "F"], // Trio 3
    ["C", "G", "L"], // Trio 4
    ["D", "K", "P"], // Trio 5
    ["W", "B", "T"], // Trio 6
    ["Z", "S", "H"], // Trio 7
    ["U", "Y", "M"], // buffer
];

const EXCLUDED_DUOS_EDGES = [
    ["A", "Q"], // Duo 1
    ["O", "M"], // Duo 2
    ["I", "E"], // Duo 3
    ["F", "L"], // Duo 4
    ["G", "Z"], // Duo 5
    ["H", "R"], // Duo 6
    ["J", "P"], // Duo 7
    ["K", "C"], // Duo 7
    ["N", "T"], // Duo 7
    ["B", "D"], // Duo 7
    ["S", "W"], // Duo 7
    ["U", "Y"], // buffer
];

function findMissingCombinations(selectedLetter, algs) {
    // Generate all possible pairs for the selected letter
    const allCombinations = ALL_LETTERS.map(letter => `${selectedLetter}${letter}`)
        .concat(ALL_LETTERS.map(letter => `${letter}${selectedLetter}`)) // Include both positions
        .filter(combination => combination[0] !== combination[1]) // Skip pairs where both letters are the same
        .filter(combination => !isExcludedCombination(combination)); // Skip excluded combinations

    // Extract existing combinations from the fetched algs
    const existingCombinations = algs.map(pair => pair.key);

    // Find missing combinations
    const missingCombinations = allCombinations.filter(combination => !existingCombinations.includes(combination));

    return missingCombinations;
}

function isExcludedCombination(combination) {
    const currentExclusions = determineCycleType() === "corner" ? EXCLUDED_TRIOS_CORNERS : EXCLUDED_DUOS_EDGES;

    // Check if the combination belongs to any excluded trio or duo
    for (const group of currentExclusions) {
        const [letter1, letter2] = combination.split("");
        if (group.includes(letter1) && group.includes(letter2)) {
            return true; // Exclude the combination
        }
    }
    return false; // Include the combination
}

async function filterAlgsByLetter(selectedLetter) {
    if (!selectedLetter) {
        console.warn("No letter selected.");
        return;
    }

    // Fetch algs if the array is empty
    if (fetchedAlgs.length === 0) {
        console.log("Fetching algorithms as fetchedAlgs is empty...");
        await fetchAlgs();
    }

    // Filter the fetchedAlgs array for keys that match the selected letter
    const filteredValues = fetchedAlgs
        .filter(pair => pair.key.startsWith(selectedLetter) || pair.key.endsWith(selectedLetter))
        .map(pair => pair.value.trim()); // Extract only the values and trim whitespace

    // Paste the filtered values into the input box
    const userDefinedAlgs = document.getElementById("userDefinedAlgs");
    userDefinedAlgs.value = filteredValues.join("\n"); // Join with newlines
    console.log(`Filtered algorithms for "${selectedLetter}":`, filteredValues);

    // Check for missing combinations if the filtered values are less than 36
    const missingCommsLabel = document.getElementById("missingCommsLabel");
    if (filteredValues.length < 36) {
        const missingCombinations = findMissingCombinations(selectedLetter, fetchedAlgs);
        console.log(`Missing combinations for "${selectedLetter}":`, missingCombinations);

        if (missingCombinations.length > 0) {
            // Update the dynamic label with missing combinations
            missingCommsLabel.innerHTML = `<span style="color: white;">Missing Comms:</span> <span style="color: red;">${missingCombinations.join(", ")}</span>`;
        } else {
            // Clear the label if there are no missing combinations
            missingCommsLabel.innerHTML = `<span style="color: white;">Missing Comms:</span>`;
        }
    } else {
        // Clear the label if there are no missing combinations
        missingCommsLabel.innerHTML = `<span style="color: white;">Missing Comms:</span>`;
    }
}

document.getElementById("connectSmartCubeReplica").addEventListener("click", function () {
    document.getElementById("connectSmartCube").click(); // Simulate a click on the original button
});

const stickerState = {}; // Shared state for all stickers

// Add right-click event listener to grid buttons
document.querySelectorAll(".gridButton").forEach(button => {
    const setName = button.dataset.letter; // Get the set name from the button's data attribute

    button.addEventListener("contextmenu", function (event) {
        event.preventDefault(); // Prevent the default context menu

        // Show the pair selection grid
        showPairSelectionGrid(setName);
    });

    button.addEventListener("touchstart", function (event) {
        // Handle long press for mobile
        let timeout = setTimeout(() => {
            showPairSelectionGrid(setName);
        }, 500); // Long press duration

        button.addEventListener("touchend", () => clearTimeout(timeout), { once: true });
    });
});

// Function to show the pair selection grid
function showPairSelectionGrid(setName) {
    const pairSelectionGrid = document.getElementById("pairSelectionGrid");
    const leftPairGrid = document.getElementById("leftPairGrid");
    const rightPairGrid = document.getElementById("rightPairGrid");
    const pairSelectionTitle = document.getElementById("pairSelectionTitle");

    // Update the title
    pairSelectionTitle.textContent = `Select Pairs for Letter ${setName}`;

    // Clear the grids
    leftPairGrid.innerHTML = "";
    rightPairGrid.innerHTML = "";

    // 1. REPLACEMENT: Use dynamic scheme letters instead of ALL_LETTERS
    const activeLetters = getActiveSchemeLetters(); 

    // Generate all pairs for the selected letter
    const pairs = activeLetters.map(letter => `${setName}${letter}`)
        .concat(activeLetters.map(letter => `${letter}${setName}`)) // Include both positions
        .filter(pair => pair[0] !== pair[1]) // Skip pairs where both letters are the same
        .filter(pair => !isExcludedCombination(pair)) // Skip excluded combinations
        .sort(customComparator); // Sort using the custom comparator

    // Initialize state for each sticker if not already done
    pairs.forEach(pair => {
        if (!(pair in stickerState)) {
            stickerState[pair] = true; // Default to toggled (selected)
        }
    });

    // Group stickers by color
    const colorGroups = {};
    pairs.forEach(pair => {
        // Determine the "face" color based on the letter that ISN'T the setName
        // (e.g. For Set A, pair AB: Color is determined by B)
        const colorLetter = pair[0] === setName ? pair[1] : pair[0];
        
        // Get color definition, default to grey
        const { background } = LETTER_COLORS[colorLetter] || { background: "grey" }; 
        
        if (!colorGroups[background]) {
            colorGroups[background] = [];
        }
        colorGroups[background].push(pair);
    });

    // Create rows for each color group
    Object.keys(colorGroups).forEach(colorName => {
        const leftRow = document.createElement("div");
        const rightRow = document.createElement("div");
        leftRow.className = "grid-row";
        rightRow.className = "grid-row";

        colorGroups[colorName].forEach(pair => {
            const button = document.createElement("button");
            
            // 2. REPLACEMENT: Use CSS classes instead of inline styles
            button.classList.add("pairButton"); // Base styling
            
            // Add a specific class for the color (e.g., "sticker-red", "sticker-white")
            // We sanitize the colorName just in case (remove spaces, lowercase)
            const safeColorName = colorName.toLowerCase().replace(/\s+/g, '-');
            button.classList.add(`sticker-${safeColorName}`); 

            button.textContent = pair;
            button.dataset.pair = pair; 

            // Apply the untoggled state class if needed
            if (!stickerState[pair]) {
                button.classList.add("untoggled");
            }

            // Determine if the button is on the left or right side
            const isLeftSide = pair.startsWith(setName);

            // Add click event listener
            button.addEventListener("click", () => {
                const newState = !stickerState[pair];

                // Rule 1: Always toggle the state of the clicked button
                stickerState[pair] = newState;
                button.classList.toggle("untoggled", !newState);

                // Rule 2: If a left-side button is clicked, also toggle the right-side counterpart
                if (isLeftSide) {
                    const reversePair = `${pair[1]}${pair[0]}`;
                    stickerState[reversePair] = newState; // Sync the state

                    // Find and visually update the corresponding right-side button
                    const reverseButton = document.querySelector(`.pairButton[data-pair="${reversePair}"]`);
                    if (reverseButton) {
                        if (newState) {
                            reverseButton.classList.remove("untoggled");
                        } else {
                            reverseButton.classList.add("untoggled");
                        }
                    }
                }
                
                saveStickerState(); 
            });

            // Append the button to the appropriate row
            if (isLeftSide) {
                leftRow.appendChild(button);
            } else {
                rightRow.appendChild(button);
            }
        });

        // Append rows to the appropriate columns
        if (leftRow.children.length > 0) {
            leftPairGrid.appendChild(leftRow);
        }
        if (rightRow.children.length > 0) {
            rightPairGrid.appendChild(rightRow);
        }
    });

    // Show the grid
    pairSelectionGrid.style.display = "block";
}

// Add event listener to the "Apply Selection" button
document.getElementById("applyPairSelectionButton").addEventListener("click", function () {
    const pairSelectionGrid = document.getElementById("pairSelectionGrid");
    pairSelectionGrid.style.display = "none"; // Hide the grid

    // Save the updated sticker state
    saveStickerState();
    console.log("Updated sticker state:", stickerState);

    // Update the user-defined algorithms based on the new sticker state
    updateUserDefinedAlgs();
});

function saveSelectedSets() {
    localStorage.setItem(getStorageKey("selectedSets"), JSON.stringify(selectedSets));
    console.log(`Selected sets saved for ${currentMode}:`, selectedSets);
}

function loadSelectedSets() {
    const savedSets = localStorage.getItem(getStorageKey("selectedSets"));
    if (savedSets) {
        Object.assign(selectedSets, JSON.parse(savedSets));
    //    console.log(`Selected sets loaded for ${currentMode}:`, selectedSets);

        // Update the visual state of the grid buttons
        document.querySelectorAll(".gridButton").forEach(button => {
            const setName = button.dataset.letter;
            button.classList.toggle("untoggled", !selectedSets[setName]);
        });
    } else {
        // Reset selectedSets if no saved data exists for the current mode
        Object.keys(selectedSets).forEach(setName => {
            selectedSets[setName] = false;
        });
    }
}

function saveStickerState() {
    localStorage.setItem(getStorageKey("stickerState"), JSON.stringify(stickerState));
    console.log("Sticker state saved:", stickerState);
}

function loadStickerState() {
    const savedState = localStorage.getItem(getStorageKey("stickerState"));
    if (savedState) {
        Object.assign(stickerState, JSON.parse(savedState));
   //     console.log("Sticker state loaded:", stickerState);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    loadFetchedAlgs();
    loadSelectedSets();
    loadStickerState();
    bindApplyButton();
});

function bindApplyButton() {
    const applyButton = document.getElementById("applySelectionsButton");
    if (applyButton) {
        applyButton.addEventListener("click", function () {
            // Get the pair selection grid element
            const pairSelectionGrid = document.getElementById("pairSelectionGrid");

            // If the pair selection grid is currently displayed, handle its closure and save its state first.
            if (pairSelectionGrid && pairSelectionGrid.style.display !== "none") {
                pairSelectionGrid.style.display = "none"; // Hide the grid
                saveStickerState(); // Save the state of the selections made in the pair grid
                console.log("Pair selection grid closed and state saved.");
            }

            // Continue with the original logic for the "applySelectionsButton"
            console.log("Applying set/sticker selections to textbox...");
            updateUserDefinedAlgs(); // This populates the textbox based on the combined set and sticker selections.
     //       alert("Textbox updated with your selections.");

            // Hide the main selection grid after applying
            const selectionGrid = document.getElementById("selectionGrid");
            if (selectionGrid) {
                selectionGrid.style.display = "none";
            }
        });
    }
}

function pressApplySelectionButton() {
    const applySelectionButton = document.getElementById("applyPairSelectionButton");
    if (applySelectionButton) {
        applySelectionButton.click(); // Simulate a click on the "Apply Selection" button
    }
}

function determineCycleType() {
    return currentMode; // Return "corner" or "edge" based on the toggle state
}

function getPieceNotation(cycleLetters) {
    const cycleType = determineCycleType(); // Determine the cycle type based on the current page
    if (!cycleType) {
        alert("Invalid cycle type. Please check the page.");
        return null;
    }

    const buffer = cycleType === "edge" ? "UF" : "UFR"; // Use different buffers for edge and corner cycles
    const pieceMap = cycleType === "edge" ? EDGE_PIECE_MAP : CORNER_PIECE_MAP; // Use the appropriate map

    // Map each letter to its piece notation
    const pieces = cycleLetters.split("").map(letter => pieceMap[letter]);

    if (pieces.includes(undefined)) {
        console.warn("Missing mapping for one or more letters:", cycleLetters);
        return null; // Return null if any letter is missing in the map
    }

    // Combine the buffer and pieces into the final notation
    return [buffer, ...pieces].join(" ");
}

// Add event listener to the cycle letters element
document.getElementById("cycle").addEventListener("click", function () {
    const cycleLetters = this.textContent.trim(); // Get the displayed cycle letters
    const pieceNotation = getPieceNotation(cycleLetters); // Get the piece notation

    if (!pieceNotation) {
        alert("Missing piece notation for one or more letters.");
        return;
    }

    const formattedData = `?how ${pieceNotation}`;

    // Copy the piece notation to the clipboard
    navigator.clipboard.writeText(formattedData).then(() => {
        console.log("Piece notation copied to clipboard:", pieceNotation);
    }).catch(err => {
        console.error("Failed to copy piece notation to clipboard:", err);
    });
});

document.addEventListener("DOMContentLoaded", function () {
    const selectionGrid = document.getElementById("selectionGrid");

    const existingResetButton = selectionGrid.querySelector(".reset-button");
    if (!existingResetButton) {
        const resetButton = document.createElement("button");
        resetButton.textContent = "Reset All Sets and Stickers";
        resetButton.className = "reset-button"; // Use the CSS class
        resetButton.addEventListener("click", () => {
            // Reset all sets to toggled state
            Object.keys(selectedSets).forEach(setName => {
                selectedSets[setName] = true; // Toggle all sets on
            });

            // Reset all stickers to toggled state using updateStickerState
            const allStickerKeys = Object.keys(stickerState); // Get all sticker keys
            updateStickerState(allStickerKeys); // Pass all keys to updateStickerState

            // Update the visual state of the buttons
            document.querySelectorAll(".gridButton").forEach(button => {
                const setName = button.dataset.letter;
                button.classList.remove("untoggled"); // Ensure all sets are visually toggled on
            });

            // Save the updated states
            saveSelectedSets();

            // Update the user-defined algorithms
       //     updateUserDefinedAlgs();

            console.log("All sets and stickers reset to toggled state.");
        });
        selectionGrid.appendChild(resetButton);
    }
});

function updateStickerState(keysWithValues) {
    console.log("Updating sticker state...");

    // Set all stickers to false first
    Object.keys(stickerState).forEach(key => {
        stickerState[key] = false;
    });

    // Update the global sticker state for keys with non-empty values
    keysWithValues.forEach(key => {
        stickerState[key] = true;
    });

    console.log("Updated sticker state:", stickerState);

    // Save the updated sticker state
    saveStickerState();
}

const drillingModeToggle = document.getElementById("drillingModeToggle");
const drillingModeLabel = document.getElementById("drillingModeLabel");

// Default to "Regular" mode if no mode is saved in localStorage
const savedDrillingMode = localStorage.getItem("drillingMode") === "true";
let isDrillingMode = savedDrillingMode;

// Set the initial state of the toggle and label
drillingModeToggle.checked = isDrillingMode;
drillingModeLabel.textContent = isDrillingMode ? "Drilling" : "Regular";

// Add an event listener to handle toggle changes
drillingModeToggle.addEventListener("change", function () {
    isDrillingMode = this.checked; // Update the mode
    localStorage.setItem("drillingMode", isDrillingMode); // Save the mode to localStorage
    drillingModeLabel.textContent = isDrillingMode ? "Drilling" : "Regular"; // Update the label text

    console.log(`Drilling Mode switched to: ${isDrillingMode ? "Drilling" : "Regular"}`);
});

async function fetchAndApplyPartialFilter() {
    const partialProxyUrl = currentMode === "corner"
        ? 'https://commexportproxy.vercel.app/api/algs?sheet=corners_partial'
        : 'https://commexportproxy.vercel.app/api/algs?sheet=edges_partial';

    try {
        console.log("Fetching partial algorithm list to populate textbox...");
        const partialList = await fetchAlgorithms(partialProxyUrl);

        if (partialList.length === 0) {
            alert("No algorithms found in the partial sheet.");
            return;
        }

        // Get the commutators (the 'value' part of the pairs)
        const commutators = partialList
            .map(pair => pair.value.trim())
            .filter(comm => comm !== "");

        // Directly update the userDefinedAlgs textbox
        document.getElementById("userDefinedAlgs").value = commutators.join("\n");

        console.log(`Textbox populated with ${commutators.length} algs from the partial sheet.`);
        alert("Textbox has been updated with algorithms from the partial filter.");

    } catch (error) {
        console.error("Error fetching or applying the partial filter:", error);
        alert("Failed to fetch or apply the partial filter.");
    }
}

function reloadAlgorithmsBasedOnStickers() {
    console.log("Reloading algorithms based on selected stickers...");

    // Gather all active stickers
    const activeStickers = Object.keys(stickerState).filter(pair => stickerState[pair]);

    // Filter the fetched algorithms to match the active stickers
    const matchingComms = fetchedAlgs.filter(pair => activeStickers.includes(pair.key));

    // Extract the commutators (values) and update the userDefinedAlgs textbox
    const commutators = matchingComms.map(pair => pair.value.trim());
    const userDefinedAlgs = document.getElementById("userDefinedAlgs");
    userDefinedAlgs.value = commutators.join("\n"); // Combine all commutators into a single string

    console.log("Updated user-defined algorithms:", commutators);
}

function updateSetAndStickerStatePartial() {
    console.log("Updating set selection state based on sticker state...");

    // Step 1: Turn off all sets
    Object.keys(selectedSets).forEach(setName => {
        selectedSets[setName] = false;
    });

    // Step 2: Iterate through the stickerState and turn on sets with active stickers
    Object.keys(stickerState).forEach(pair => {
        if (stickerState[pair]) { // If the sticker is active (true)
            const [firstLetter, secondLetter] = pair.split(""); // Split the pair into individual letters

            // Turn on the sets for both letters
            selectedSets[firstLetter] = true;
            selectedSets[secondLetter] = true;
        }
    });

    // Step 3: Save the updated set state
    saveSelectedSets();

    console.log("Set selection state updated:", selectedSets);

    // Step 4: Reload algorithms based on the updated sticker state
    reloadAlgorithmsBasedOnStickers();
}

async function fetchAlgorithms(proxyUrl) {
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch algorithms from ${proxyUrl}`);
        }
        const text = await response.text();

        // Parse TSV and extract key-value pairs
        return text
            .split("\n") // Split into rows
            .map(row => row.split("\t")) // Split each row into columns
            .filter(columns => columns.length >= 2) // Ensure there are at least two columns
            .map(columns => ({ key: columns[0].trim(), value: columns[1].trim() })) // Map as key-value pairs
            .filter(pair => pair.key !== "" && pair.value !== "" && pair.value !== "\r"); // Prune invalid pairs
    } catch (error) {
        console.error("Error fetching algorithms:", error);
        return [];
    }
}

document.getElementById("applyPartialFilterButton").addEventListener("click", fetchAndApplyPartialFilter);

/**
 * Provides visual feedback for a successful solve by flashing
 * the background green and changing the timer color temporarily.
 */
function showSuccessFeedback() {
    if (!isVisualFeedbackEnabled) {
        return;
    }
    const body = document.body;
    const timerElement = document.getElementById("timer");

    // 1. Add the CSS class to the body to trigger the green background flash
    body.classList.add("solve-success-flash");

    // 2. Change the timer's text color for extra reinforcement
   // timerElement.style.color = "#66bb6a"; // A lighter, vibrant green

    // 3. Set a timer to automatically remove the feedback after a short duration
    setTimeout(() => {
        body.classList.remove("solve-success-flash"); // Revert background
  //      timerElement.style.color = "white";             // Revert timer color
    }, 400); // The feedback will be visible for 350 milliseconds (0.35s)
}

// 1. Get the new checkbox element from the DOM
const visualFeedbackCheckbox = document.getElementById("visualFeedbackCheckbox");

// 2. Load the saved state from localStorage. Default to 'true' (enabled) if it's not set.
// Note: We are now defaulting it to true, so users see the new feature immediately.
const savedVisualFeedback = localStorage.getItem("visualFeedbackEnabled");
let isVisualFeedbackEnabled = savedVisualFeedback === null ? true : savedVisualFeedback === "true";

// 3. Set the initial state of the checkbox to match what we loaded
visualFeedbackCheckbox.checked = isVisualFeedbackEnabled;
localStorage.setItem("visualFeedbackEnabled", isVisualFeedbackEnabled); // Save default if it was null

// 4. Add an event listener to handle when the user clicks the checkbox
visualFeedbackCheckbox.addEventListener("change", function () {
    // Update our global variable with the new state
    isVisualFeedbackEnabled = this.checked;
    
    // Save the new state to localStorage so it's remembered
    localStorage.setItem("visualFeedbackEnabled", isVisualFeedbackEnabled);

    console.log(`Visual feedback flash switched to: ${isVisualFeedbackEnabled ? "enabled" : "disabled"}`);
});

/**
 * Reads inputs from the visual grid and updates the global map.
 * Returns the object map to be saved as JSON.
 */
function applySchemeFromGrid() {
    const inputs = document.querySelectorAll('.sticker-input');
    const newMap = {};

    inputs.forEach(input => {
        const index = parseInt(input.getAttribute('data-index'));
        
        // If the input is a center (disabled), we preserve the EXISTING value 
        if (CENTER_INDICES.includes(index)) {
             newMap[index] = POSITION_TO_LETTER_MAP[index] || DEFAULT_POSITION_TO_LETTER_MAP[index];
        } else {
             let val = input.value.trim().toUpperCase();
             if (val === "") val = "-"; 
             newMap[index] = val;
        }
    });

    Object.assign(POSITION_TO_LETTER_MAP, newMap);
    return newMap;
}

/**
 * Populates the visual grid from a map object.
 */
function populateGridFromScheme(schemeMap) {
    if (!schemeMap) return;

    const inputs = document.querySelectorAll('.sticker-input');
    
    inputs.forEach(input => {
        const index = parseInt(input.getAttribute('data-index'));
        const val = schemeMap[index];
        
        if (val !== undefined) {
            // Only update editable fields (non-centers)
            if (!input.disabled) {
                input.value = val;
            }
        }
    });
}

/**
 * Event Listener: Save Custom Scheme
 */
const saveSchemeButton = document.getElementById("saveLetterScheme");
if (saveSchemeButton) {
    saveSchemeButton.addEventListener("click", function () {
        const schemeMap = applySchemeFromGrid();

        try {
            localStorage.setItem("customLetterSchemeJSON", JSON.stringify(schemeMap));
            alert("Custom letter scheme saved!");
        } catch (e) {
            console.error("Error saving scheme:", e);
            alert("Failed to save scheme.");
        }
    });
}

/**
 * Event Listener: Speffz Scheme
 */
const speffzSchemeButton = document.getElementById("speffzLetterScheme");
if (speffzSchemeButton) {
    speffzSchemeButton.addEventListener("click", function () {
        if (confirm("Load standard Speffz scheme?")) {
            // Update Internal Map
            Object.assign(POSITION_TO_LETTER_MAP, SPEFFZ_LETTER_MAP);
            // Update Visual Grid
            populateGridFromScheme(SPEFFZ_LETTER_MAP);
            // Save immediately so it persists on reload
            localStorage.setItem("customLetterSchemeJSON", JSON.stringify(SPEFFZ_LETTER_MAP));
        }
    });
}

const hanusSchemeButton = document.getElementById("hanusLetterScheme");
if (hanusSchemeButton) {
    hanusSchemeButton.addEventListener("click", function () {
        if (confirm("Load gigachad Hanuś scheme?")) {
            // Update Internal Map
            Object.assign(POSITION_TO_LETTER_MAP, HANUS_LETTER_MAP);
            // Update Visual Grid
            populateGridFromScheme(HANUS_LETTER_MAP);
            // Save immediately so it persists on reload
            localStorage.setItem("customLetterSchemeJSON", JSON.stringify(HANUS_LETTER_MAP));
        }
    });
}

const kacperSchemeButton = document.getElementById("kacperLetterScheme");
if (kacperSchemeButton) {
    kacperSchemeButton.addEventListener("click", function () {
        if (confirm("Load Kacper's lettering scheme?")) {
            localStorage.removeItem("customLetterSchemeJSON");
            
            // Revert global map
            Object.assign(POSITION_TO_LETTER_MAP, DEFAULT_POSITION_TO_LETTER_MAP);
            
            // Revert visual grid
            populateGridFromScheme(DEFAULT_POSITION_TO_LETTER_MAP);
            
            alert("Set to Kacper's scheme.");
        }
    });
}

/**
 * Initialization
 */
document.addEventListener("DOMContentLoaded", function () {
    const savedJSON = localStorage.getItem("customLetterSchemeJSON");
    
    if (savedJSON) {
        try {
            const savedMap = JSON.parse(savedJSON);
            Object.assign(POSITION_TO_LETTER_MAP, savedMap);
            populateGridFromScheme(savedMap);
            console.log("Custom lettering scheme loaded (JSON).");
        } catch (e) {
            console.error("Error parsing saved scheme, reverting to default.", e);
            populateGridFromScheme(DEFAULT_POSITION_TO_LETTER_MAP);
        }
    } else {
        // Fallback for backward compatibility
        const oldString = localStorage.getItem("customLetterScheme");
        if (oldString && oldString.length === 54) {
             console.log("Old string format detected but ignored. Please re-save.");
        }
        
        populateGridFromScheme(DEFAULT_POSITION_TO_LETTER_MAP);
    }
});

function getActiveSchemeLetters() {
    const indices = currentMode === "corner" ? CORNER_FACELET_INDICES : EDGE_FACELET_INDICES;
    const letters = new Set();

    indices.forEach(index => {
        // Get letter from map, default to empty if undefined
        let char = POSITION_TO_LETTER_MAP[index];
        // Clean up (handle empty strings, dashes, or undefined)
        if (char && char.trim() !== "" && char !== "-") {
            letters.add(char.trim());
        }
    });

    // Return sorted unique letters
    return Array.from(letters).sort();
}

/**
 * Handles clicking a Set Button.
 * @param {HTMLElement} button - The clicked button
 * @param {string} letter - The letter (e.g. "A")
 * @param {string} position - 'first' (A_) or 'second' (_A)
 */
function handleGridButtonClick(button, letter, position) {
    // Construct a unique key for selectedSets (e.g., "A_" or "_A")
    const setKey = position === 'first' ? `${letter}_` : `_${letter}`;
    
    // 1. Toggle Visual State
    const newState = !selectedSets[setKey];
    selectedSets[setKey] = newState;
    
    // Update Button Appearance
    button.classList.toggle("untoggled", !newState);
    saveSelectedSets();

    // 2. Batch Update stickerState
    if (fetchedAlgs.length > 0) {
        let changedCount = 0;
        fetchedAlgs.forEach(item => {
            const key = item.key; // e.g., "AB"
            if (key.length < 2) return;

            // Logic: 
            // If we clicked "A_", we change pairs starting with A.
            // If we clicked "_A", we change pairs ending with A.
            if (position === 'first' && key[0] === letter) {
                stickerState[key] = newState;
                changedCount++;
            } else if (position === 'second' && key[1] === letter) {
                stickerState[key] = newState;
                changedCount++;
            }
        });
        
        saveStickerState();
        console.log(`Updated ${setKey}: ${changedCount} algs set to ${newState}`);
    }
}