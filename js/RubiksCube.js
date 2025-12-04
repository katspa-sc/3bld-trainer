const CORNER_FACELET_INDICES = [0, 2, 6, 8, 9, 11, 15, 17, 18, 20, 24, 26, 27, 29, 33, 35, 36, 38, 42, 44, 45, 47, 51, 53];
const EDGE_FACELET_INDICES = [1, 3, 5, 7, 10, 12, 14, 16, 19, 21, 23, 25, 28, 30, 32, 34, 37, 39, 41, 43, 46, 48, 50, 52];

let cachedEdgeLetterToIndex = {};
let cachedCornerLetterToIndex = {};

let previousScramble = "";
let previousCycle = "";
let sessionQueue = [];
let upcomingAlgTest = null;

// Helper to check if two indices are on the same piece
function getPieceGroupId(faceletIndex, type) {
    const groups = type === 'corner' ? PIECE_GEOMETRY.corners : PIECE_GEOMETRY.edges;
    return groups.findIndex(group => group.includes(faceletIndex));
}

function tryNotify() {
    const options = isHypeMode ? hypeDrillOptions : regularDrillOptions;
    const text = options[Math.floor(Math.random() * options.length)];
    const rate = isHypeMode ? 1.3 : 1.5;
    speakText(text, rate, false, isHypeMode);
}

function getStorageKey(baseKey) {
    return `${currentMode}_${baseKey}`;
}

var PROXY_URL = "";

const hypeModeCheckbox = document.getElementById("hypeModeCheckbox");

const savedHypeMode = localStorage.getItem("hypeMode") === "true";
let isHypeMode = savedHypeMode;

hypeModeCheckbox.checked = isHypeMode;
hypeModeCheckbox.addEventListener("change", function () {
    isHypeMode = this.checked;
    localStorage.setItem("hypeMode", isHypeMode);

    console.log(`Hype Mode switched to: ${isHypeMode ? "enabled" : "disabled"}`);
});

let drillingPairs = [];
let currentDrillingPair = null;
let isSecondInPair = false;
let totalDrillPairs = 0;

let isFirstDrillRun = true;  
let shouldReadDrillTTS = true; 

function initializeDrillingPairs(algsFromTextarea) {
    console.log("Initializing drilling session from textbox content...");
    
    const fullAlgMap = new Map(fetchedAlgs.map(item => [item.value.trim(), item.key.trim()]));
    
    const inverseKeyMap = new Map();
    fetchedAlgs.forEach(item => {
        const inverseKey = item.key[1] + item.key[0];
        inverseKeyMap.set(item.key, inverseKey);
    });

    const keyToCommMap = new Map(fetchedAlgs.map(item => [item.key.trim(), item.value.trim()]));

    const processed = new Set();
    drillingPairs = [];
    const missingPairs = []; 

    for (const alg of algsFromTextarea) {
        const trimmedAlg = alg.trim();
        if (processed.has(trimmedAlg)) {
            continue;
        }

        const key = fullAlgMap.get(trimmedAlg);
        if (!key) continue; 

        const inverseKey = inverseKeyMap.get(key);
        const inverseAlg = keyToCommMap.get(inverseKey);
        
        if (inverseAlg && algsFromTextarea.map(a => a.trim()).includes(inverseAlg.trim())) {
            drillingPairs.push([trimmedAlg, inverseAlg]);
            processed.add(trimmedAlg);
            processed.add(inverseAlg.trim());
        } else {
            
            missingPairs.push(`${trimmedAlg} (${key})`); 
        }
    }

    if (drillingPairs.length === 0) {
        alert("No valid algorithm pairs found for Drilling mode based on the content of the textbox. Please check your algorithms.");
        return;
    }

    for (let i = drillingPairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [drillingPairs[i], drillingPairs[j]] = [drillingPairs[j], drillingPairs[i]];
    }

    totalDrillPairs = drillingPairs.length;
    console.log(`Found and shuffled ${totalDrillPairs} pairs for drilling.`);
    isSecondInPair = false;
    shouldReadDrillTTS = true;

    if (missingPairs.length > 0) {
        alert(`The following commutators were valid but had no corresponding inverse:\n${missingPairs.join("\n")}`);
        console.log("Missing pairs:", missingPairs);
    }
}

function initializeSession() {
    sessionQueue = [];
    upcomingAlgTest = null;

    if (isDrillingMode) {
        const boxAlgs = document.getElementById("userDefinedAlgs").value;
        const cleanedAlgs = boxAlgs.split("\n").filter(alg => alg.trim() !== "");

        if (cleanedAlgs.length === 0) {
            alert("The algorithm box is empty. Please add algorithms before starting a session.");
            return;
        }

        initializeDrillingPairs(cleanedAlgs);
        sessionQueue = drillingPairs.flat();
        isFirstDrillRun = true;
    } else {
        const algList = createAlgList();
        for (let i = algList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [algList[i], algList[j]] = [algList[j], algList[i]];
        }
        sessionQueue = algList;
        isFirstRun = true;
    }

    repetitionCounter = 0;
    localStorage.setItem("repetitionCounter", repetitionCounter);
    document.getElementById("repetitionCounter").innerText = `${repetitionCounter}`;
    document.getElementById("progressDisplay").innerText = "Progress: 0/0";

    nextScramble();
    console.log("Session initialized. Starting a new practice session.");
}

document.getElementById("resetSessionButton").addEventListener("click", function () {
 initializeSession();
});

function retryDrill() {
    const lastTest = algorithmHistory[algorithmHistory.length - 1];
    if (!lastTest) return;

    cube.resetCube();
    doAlg(lastTest.scramble, false);
    updateVirtualCube();

    document.getElementById("timer").innerHTML = "0.00";
    tryNotify();

    
    shouldReadDrillTTS = false;

    console.log("Drilling same algorithm:", lastTest.rawAlgs[0]);
    startTimer();
}

function advanceDrill() {
    if (!isDrillingMode) return;

    console.log("L4 gesture: Advancing to next drill case...");
    stopTimer(false);

    shouldReadDrillTTS = true;
    nextScramble();
}

const modeToggle = document.getElementById("modeToggle");
const modeToggleLabel = document.getElementById("modeToggleLabel");

const savedMode = localStorage.getItem("mode") || "corner";
let currentMode = savedMode;

modeToggle.checked = currentMode === "edge";
modeToggleLabel.textContent = currentMode === "edge" ? "Edge" : "Corner";

modeToggle.addEventListener("change", function () {
    currentMode = this.checked ? "edge" : "corner"; 
    localStorage.setItem("mode", currentMode); 
    modeToggleLabel.textContent = currentMode === "edge" ? "Edge" : "Corner"; 
    updateProxyUrl(); 

    loadFetchedAlgs();
    loadSelectedSets();
    loadStickerState();

    updateUserDefinedAlgs();

    console.log(`Mode switched to: ${currentMode}`);
});

function updateProxyUrl() {
    if (currentMode === "corner") {
        PROXY_URL = 'https://commexportproxy.vercel.app/api/algs?sheet=corners';
    } else if (currentMode === "edge") {
        PROXY_URL = 'https://commexportproxy.vercel.app/api/algs?sheet=edges';
    }
}

updateProxyUrl();

const moveHistory = [];
const MAX_HISTORY_LENGTH = 10; 

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
let toggleFeedbackUsed = false; 

function loadVoices() {
    var voices = window.speechSynthesis.getVoices();
    var filteredVoices = voices.filter(voice => voice.lang.startsWith('pl'));

    selectedVoice = filteredVoices[0];
}

let repetitionCounter = parseInt(localStorage.getItem("repetitionCounter")) || 0;
document.getElementById("repetitionCounter").innerText = `${repetitionCounter}`;

if (localStorage.getItem("enableTTS") === null) {
    localStorage.setItem("enableTTS", "true"); 
}

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

function findPivot(alg) {
    let cube = new RubiksCube();
    let moves = alg.split(" ");
    let states = [];

    for (let move of moves) {
        cube.doAlgorithm(move);
        states.push(cube.getMaskValues());
    }

    

    for (let i = 0; i < 54; ++i) {
        
        if (i % 9 == 4) continue;

        
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

function findRotationToFixPivot(pivotIndex) {
    const rotations = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"];

    for (let i = 0; i < rotations.length; ++i) {
        for (let j = 0; j < rotations.length; ++j) {
            let rotation = rotations[i] + ' ' + rotations[j];
            rotation = rotation.trim();

            

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

    return move; 
}

function applyMoves(moves) {
    let ori = cube.wcaOrient();
    doAlg(alg.cube.invert(ori), false);
    let startingRotation = ori;

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
        moveHistory.shift(); 
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

var resetSessionElement = document.getElementById("resetSession");
resetSessionElement.addEventListener('click', async () => {
    await connectSmartCube();
});

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
            button.style.height = minButtonWidth * 0.85 + 'px'; 
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

document.getElementById("userDefinedAlgs").style.display = "block";

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

var fullCN = document.getElementById("fullCN");
fullCN.addEventListener("click", function () {
    localStorage.setItem("fullCN", this.checked);
});

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

try { 
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
    rotationCube.doAlgorithm(moves);

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
    let rotationMap = getRotationMap(initialRotations);

    for (let k = 0; k < 54; ++k) {
        if (vc[k] != 'x') {
            
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
    
    if (timerIsRunning && cube.isSolved(initialMask.value) && isUsingVirtualCube()) {
        if (updateTimer) {
            stopTimer(); 
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

function getPremoves(length) {
    var previous = "U"; 
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

    const edgeBufferPosition = 7; 
    const cornerBufferPosition = 8; 

    const cycleMapping = cube.getThreeCycleMapping(edgeBufferPosition, cornerBufferPosition);
    if (!cycleMapping) {
        return ["", scramble]; 
    }

    const bufferPosition = cycleMapping.includes(edgeBufferPosition) ? edgeBufferPosition : cornerBufferPosition;
    const bufferIndex = cycleMapping.indexOf(bufferPosition);
    const rearrangedCycle = [...cycleMapping.slice(bufferIndex), ...cycleMapping.slice(0, bufferIndex)];

    const filteredCycle = rearrangedCycle.filter(pos => pos !== bufferPosition);
    let letters = filteredCycle.map(pos => POSITION_TO_LETTER_MAP[pos]);
    const cycleLetters = letters.join('');

    return [cycleLetters, scramble];
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
        this.visualCubeView = visualCubeView;
        this.orientRandPart = orientRandPart;
    }
}

function correctRotation(alg) {
    var rc = new RubiksCube();
    rc.doAlgorithm(alg);
    var ori = rc.wcaOrient();

    return alg + " " + ori;
}

function generateAlgTest(rawAlgStr) {
    if (!rawAlgStr) {
        return null; 
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

    cube.resetCube();
    doAlg(algTest.scramble, false);
    updateVirtualCube();

    if (addToHistory) {
        algorithmHistory.push(algTest);
    } 
}

function updateAlgsetStatistics(algList) {
    const totalTime = timeArray.reduce((sum, solveTime) => sum + solveTime.timeValue(), 0).toFixed(2);

    const stats = {
        "STM": averageMovecount(algList, "btm", false).toFixed(3),
        "SQTM": averageMovecount(algList, "bqtm", false).toFixed(3),
        "STM (including AUF)": averageMovecount(algList, "btm", true).toFixed(3),
        "SQTM (including AUF)": averageMovecount(algList, "bqtm", true).toFixed(3),
        "Number of algs": algList.length,
        "Total Time (seconds)": totalTime 
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
    
    if (lastTest == undefined) {
        return;
    }

    cube.resetCube();
    doAlg(lastTest.scramble, false);
    updateVirtualCube();
}

function updateTrainer(scramble, solutions, algorithm, timer) {
    if (scramble != null) {
        document.getElementById("scramble").innerHTML = scramble;
    }

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
        let currAlg = algorithms[i].replace(/\[|\]|\)|\(/g, "");
    }
    return algorithms;
    //TODO Allow commutators

}

function displayAlgorithmFromHistory(index) {
    var algTest = algorithmHistory[index];

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

let remainingAlgs = []; 
let isFirstRun = true; 

function getNextAlgFromSession() {
    
    if (sessionQueue.length === 0) {
        if (isDrillingMode) {
            if (!isFirstDrillRun) {
                const jingle = document.getElementById("completionJingle");
                jingle.volume = 0.5;
                jingle.play();
            }
            isFirstDrillRun = false;
            
            const boxAlgs = document.getElementById("userDefinedAlgs").value.split("\n").filter(alg => alg.trim() !== "");
            initializeDrillingPairs(boxAlgs);
            sessionQueue = drillingPairs.flat();
            if (sessionQueue.length === 0) return null;
        } else { 
            if (!isFirstRun) {
                const jingle = document.getElementById("completionJingle");
                jingle.volume = 0.5;
                jingle.play();
            }
            isFirstRun = false;
            
            const algList = createAlgList();
            if (algList.length === 0) return null;
            for (let i = algList.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [algList[i], algList[j]] = [algList[j], algList[i]];
            }
            sessionQueue = algList;
        }
    }

    
    if (isDrillingMode) {
         const completedPairs = totalDrillPairs - Math.ceil(sessionQueue.length / 2);
         document.getElementById("progressDisplay").innerText = `Progress: ${completedPairs}/${totalDrillPairs}`;
    } else {
        const totalAlgs = createAlgList().length;
        const currentIndex = totalAlgs - sessionQueue.length;
        document.getElementById("progressDisplay").innerText = `Progress: ${currentIndex}/${totalAlgs}`;
    }

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
        var cycleLetters = lastTest ? lastTest.cycleLetters : ""; 
        var solveTime = new SolveTime(time, '', cycleLetters); 
        lastTest.solveTime = solveTime;
        timeArray.push(solveTime);
        console.log(timeArray);
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
        timeList.innerHTML += timeArray[i].toString(); 
        timeList.innerHTML += " ";
    }

    scrollTimes.scrollTop = scrollTimes.scrollHeight;
}

function findMistakesInUserAlgs(userAlgs) {
    var errorMessage = "";
    var newList = [];
    var newListDisplay = []; 

    for (var i = 0; i < userAlgs.length; i++) {
        let alg = userAlgs[i].trim();
        alg = alg.replace(/^[\*\-]+/, "").trim();
        alg = alg.replace(/[\u2018\u0060\u2019\u00B4]/g, "'").replace(/"/g, "");
        let algWithParenthesis = alg;
        alg = alg.replace(/\([^)]*\)/g, "").trim();

        if (!isCommutator(alg)) {
            try {
                alg.cube.simplify(alg);
                if (alg !== "") {
                    newList.push(alg);
                    newListDisplay.push(algWithParenthesis);
                }
            } catch (err) {
                cube.resetCube();
                cube.doAlgorithm(alg);
                const edgeBufferPosition = 7; 
                const cornerBufferPosition = 8; 

                const cycleMapping = cube.getThreeCycleMapping(edgeBufferPosition, cornerBufferPosition);
                cube.resetCube();

                if (cycleMapping) {
                    newList.push(alg);
                    newListDisplay.push(algWithParenthesis);
                } else {
                    if (alg !== "") {
                        errorMessage += `"${userAlgs[i]}" is an invalid alg and has been removed\n`;
                    }
                }
            }
        } else {
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
        topAlg = commToMoves(topAlg);
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

    if (!upcomingAlgTest) {
        upcomingAlgTest = generateAlgTest(getNextAlgFromSession());
    }

    const currentAlgTest = upcomingAlgTest;
    
    if (!currentAlgTest) {
        document.getElementById("scramble").innerHTML = "Session Complete!";
        document.getElementById("cycle").innerHTML = "";
        document.getElementById("upcoming_cycle").innerHTML = "";
        return;
    }

    if (shouldReadDrillTTS && currentAlgTest.cycleLetters) {
        speakText(parseLettersForTTS(currentAlgTest.cycleLetters.split("")));
    }

    upcomingAlgTest = generateAlgTest(getNextAlgFromSession());

    document.getElementById("cycle").innerHTML = currentAlgTest.cycleLetters;
    const upcomingCycleElement = document.getElementById("upcoming_cycle");

    if (upcomingAlgTest) {
        upcomingCycleElement.innerHTML = upcomingAlgTest.cycleLetters;
    } else {
        upcomingCycleElement.innerHTML = "End";
    }
    
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
        this.cycleLetters = cycleLetters; 
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
    
    for (let i = 0; i < this.cubestate.length; i++) {
        if (this.cubestate[i][0] !== SOLVED_POSITIONS[i][0] || this.cubestate[i][1] !== SOLVED_POSITIONS[i][1]) {
            unsolvedPositions.push(i);
        }
    }

    let bufferPosition;
    if (unsolvedPositions.length === 6) {
        bufferPosition = edgeBuffer; 
    } else if (unsolvedPositions.length === 9) {
        bufferPosition = cornerBuffer; 
    } else {
        console.log("Not a valid 3-cycle: ", unsolvedPositions);
        return null;
    }

    const cycleMapping = {};
    for (const pos of unsolvedPositions) {
        const targetPosition = this.cubestate[pos][1]; 
        cycleMapping[pos] = targetPosition;
    }

    const visited = new Set();
    const cycle = [];
    let current = bufferPosition;

    while (!visited.has(current)) {
        visited.add(current);
        cycle.push(current);
        current = cycleMapping[current];
    }

    if (cycle.length !== 3) {
        console.log("Invalid cycle for buffer position:", bufferPosition);
        return null;
    }

    return cycle;
};

function parseLettersForTTS(letters) {
    if (letters.length === 2) {
        const pair = letters.join(""); 
        const word = LETTER_PAIR_TO_WORD[pair]; 

        if (word && word.trim() !== "") {
            return word; 
        } else {
            return letters.join(" "); 
        }
    } else {
        return letters.join(" "); 
    }
}

function checkForSpecialSequences() {
    const recentMoves = moveHistory.join("");
    if (recentMoves.endsWith("D D D D D D D D ") || recentMoves.endsWith("D'D'D'D'D'D'D'D'")) {
        console.log("Special sequence detected: D4");
        triggerSpecialAction("D8");
    }

    if (recentMoves.endsWith("B B B B ") || recentMoves.endsWith("B'B'B'B'")) {
        console.log("Special sequence detected: B4");
        triggerSpecialAction("B4");
    }

    if (recentMoves.endsWith("L L L L ") || recentMoves.endsWith("L'L'L'L'")) {
        console.log("Special sequence detected: L4");
        triggerSpecialAction("L4");
    }

    if (recentMoves.endsWith("F F F F ") || recentMoves.endsWith("F'F'F'F'")) {
        console.log("Special sequence detected: F4");
        triggerSpecialAction("F4");
    }

    if (recentMoves.endsWith("R R R R ") || recentMoves.endsWith("R'R'R'R'")) {
        console.log("Special sequence detected: R4");
        triggerSpecialAction("R4");
    }

    if (recentMoves.endsWith("U U U U U U U U ") || recentMoves.endsWith("U'U'U'U'U'U'U'U'")) {
        console.log("Special sequence detected: U6");
        triggerSpecialAction("U6");
    }
}

function processRegularMode(text) {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    
    return text
        .split(" ") 
        .map(move => {
            if (move.endsWith("'") || move.endsWith("2")) {
                return move; 
            }
            return isMobile ? move : `${move},`; 
        })
        .join(isMobile ? "," : " "); 
}

function speakText(text, rate = 1.0, readComm = false, readHype = false) {
    const enableTTS = localStorage.getItem("enableTTS") === "true";

    if (!enableTTS) {
        console.log("TTS is disabled.");
        return; 
    }

    if ('speechSynthesis' in window) {
        if (!utterance) {
            utterance = new SpeechSynthesisUtterance();
        }

        window.speechSynthesis.cancel();
        utterance.rate = rate; 
        utterance.lang = localStorage.getItem("ttsLanguage") || "pl-PL"; 
        
        if (!readHype) {
            utterance.text = processTextForTTS(text, readComm);
        } else {
            utterance.text = text; 
        }

        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Text-to-Speech is not supported in this browser.');
    }
}

function processTextForTTS(text, readComm = false) {
    if (readComm) {
        if (currentMode === "corner") {
            const colonIndex = text.indexOf(":");
            if (colonIndex !== -1) {
                text = text.substring(0, colonIndex).trim(); 
            } else {
                return "czysty kom lub dziewięcioruchowiec"; 
            }
        }

        const replacements = {
            ":": " potem",
            "'": " priim",
            "/": " slesz"
        };

        const regex = new RegExp(`[${Object.keys(replacements).join("")}]`, "g");
        let processedText = text.replace(regex, match => replacements[match]);
        processedText = processedText.split(" ").join(" ");

        return processedText;
    } else {
        return processRegularMode(text);
    }
}

function triggerSpecialAction(sequence) {
    moveHistory.length = 0; 
    switch (sequence) {
        case "D8":
            console.log("D4 detected! Reading out current displayed scramble");
            const displayedScrambleElement = document.getElementById("scramble");
            const displayedScrambleText = displayedScrambleElement ? displayedScrambleElement.textContent : null;

            if (displayedScrambleText) {
                console.log("Reading out displayed scramble:", displayedScrambleText);
                speakText(displayedScrambleText, 1, true); 
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
                advanceDrill(); 
            } else {
                markCurrentCommAsBad(); 
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
            goodAlg.play(); 
            markLastCommAsGood();
            break;
        default:
            console.log(`No action defined for sequence: ${sequence}`);
    }
}

function enableTtsOnStartup() {
    const enableTTSCheckbox = document.getElementById("enableTTS");
    const savedTTSState = localStorage.getItem("enableTTS");
    enableTTSCheckbox.checked = savedTTSState === "true";
    enableTTSCheckbox.addEventListener("change", function () {
        localStorage.setItem("enableTTS", enableTTSCheckbox.checked);
    });
}

async function connectSmartCube() {
    try {
        if (conn) {
            await conn.disconnect();
            connectSmartCubeElement.textContent = 'Connect';
            alert(`Smart cube ${conn.deviceName} disconnected`);
            conn = null;
        } else {
            conn = await connect(applyMoves);
            if (!conn) {
                alert(`Smart cube is not supported`);
            } else {
                await conn.initAsync();
                connectSmartCubeElement.textContent = 'Disconnect';

                const progressText = document.getElementById("progressDisplay").innerText;
                const [currentProgress, totalProgress] = progressText
                    .replace("Progress: ", "")
                    .split("/")
                    .map(Number);

                if (currentProgress === 0) {
                    initializeSession(); 
                } else {
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
    const lastTest = algorithmHistory[algorithmHistory.length - 1];
    stopTimer(false);

    if (!lastTest) {
        alert("No algorithm to retry.");
        return;
    }

    cube.resetCube();
    doAlg(lastTest.scramble, false);
    updateVirtualCube();

    document.getElementById("timer").innerHTML = "0.00";
    document.getElementById("scramble").innerHTML = `<span>${lastTest.orientRandPart}</span> ${lastTest.rawAlgs[0]}`;
    document.getElementById("cycle").innerHTML = lastTest.cycleLetters;

    speakText(parseLettersForTTS(lastTest.cycleLetters.split("")));
    console.log("Retrying algorithm:", lastTest.rawAlgs[0]);

    startTimer();
}

const cycleFeedbackMap = new Map(); 

function markCurrentCommAsGood() {
    const lastTest = algorithmHistory[algorithmHistory.length - 1];
    if (!lastTest) {
        console.warn("No cycle letters available to mark as good.");
        return;
    }

    const cycleLetters = lastTest.cycleLetters;
    if (!cycleFeedbackMap.has(cycleLetters)) {
        cycleFeedbackMap.set(cycleLetters, 1); 
        console.log(`Marked "${cycleLetters}" as Good.`);
        updateLastCycleInfo(); 
        updateFeedbackResults(); 
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
        cycleFeedbackMap.set(cycleLetters, 0); 
        console.log(`Marked "${cycleLetters}" as Bad.`);
        updateLastCycleInfo(); 
        updateFeedbackResults(); 
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

    cycleFeedbackMap.set(cycleLetters, 2);

    console.log(`Marked "${cycleLetters}" as Change/Drill alg.`);
    updateFeedbackResults(); 
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

    
    goodCycles.sort(customComparator);
    badCycles.sort(customComparator);
    changeCycles.sort(customComparator);

    
    goodListElement.innerHTML = formatListWithHighlight(goodCycles, lastCycleLetters);
    badListElement.innerHTML = formatListWithHighlight(badCycles, lastCycleLetters);
    changeListElement.innerHTML = formatListWithHighlight(changeCycles, lastCycleLetters);
}

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
    const letterOrder = "AOIEFGHJJKLMNBPQTSRCDWZ"; 
    const getOrder = (letter) => letterOrder.indexOf(letter);

    
    const firstLetterComparison = getOrder(a[0]) - getOrder(b[0]);
    if (firstLetterComparison !== 0) {
        return firstLetterComparison;
    }

    
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

    
    if (obfuscateScrambleCheckbox.checked) {
        scrambleElement.classList.remove("revealed");
        scrambleElement.classList.add("obfuscated");
      
    } else {
        revealScramble();
      
    }
}

const obfuscateScrambleCheckbox = document.getElementById("obfuscateScrambleCheckbox");

const savedObfuscateState = localStorage.getItem("obfuscateScramble") === "true";
obfuscateScrambleCheckbox.checked = savedObfuscateState;

obfuscateScrambleCheckbox.addEventListener("change", function () {
    localStorage.setItem("obfuscateScramble", obfuscateScrambleCheckbox.checked);
    console.log(`Obfuscate Scramble is now ${obfuscateScrambleCheckbox.checked ? "enabled" : "disabled"}`);
});

function copyScrambleAndCycle(scrambleId, cycleId, usePrevious = false) {
    let scrambleText, cycleLetters;

    if (usePrevious) {
        
        scrambleText = previousScramble || "No previous scramble available";
        cycleLetters = previousCycle || "No previous cycle available";
    } else {
        
        scrambleText = document.getElementById(scrambleId).textContent.trim();
        cycleLetters = document.getElementById(cycleId).textContent.trim();
    }

    const pieceNotation = getPieceNotation(cycleLetters); 

    if (scrambleText && pieceNotation) {
        const combinedText = `${scrambleText} - ${pieceNotation}`; 
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
        
        revealScramble();
    } else {
        
        copyScrambleAndCycle("scramble", "cycle");
    }
});

function updateLastCycleInfo() {
    const lastTest = algorithmHistory[algorithmHistory.length - 1];
    const lastCycleLettersElement = document.getElementById("lastCycleLetters");
    const lastScrambleElement = document.getElementById("lastScramble");

    if (lastTest) {
        
        const cycleLetters = lastTest.cycleLetters || "None";
        lastCycleLettersElement.textContent = cycleLetters;

        
        const formattedPositions = getPieceNotation(cycleLetters);

        if (!formattedPositions || formattedPositions.includes("Unknown")) {
            console.warn("Missing mapping for one or more letters:", cycleLetters);
            window.lastCyclePositions = "Unknown"; 
        } else {
            window.lastCyclePositions = formattedPositions; 
        }

        
        try {
            lastScrambleElement.textContent = lastTest.rawAlgs[0] || "None";
        } catch (error) {
            console.error("Error retrieving commutator notation:", error);
            lastScrambleElement.textContent = "None"; 
        }

        
        previousScramble = lastScrambleElement.textContent.trim();
        previousCycle = lastCycleLettersElement.textContent.trim();
    } else {
        lastCycleLettersElement.textContent = "None";
        lastScrambleElement.textContent = "None";
        window.lastCyclePositions = null; 

        
        previousScramble = "";
        previousCycle = "";
    }
}

function copyFeedbackToClipboard() {
    const goodList = document.getElementById("goodList").textContent.split(", ");
    const badList = document.getElementById("badList").textContent.split(", ");
    const changeDrillList = document.getElementById("changeList").textContent.split(", ");

    
    function groupByStartingLetter(list) {
        const grouped = {};
        list.forEach(item => {
            const firstLetter = item[0];
            if (!grouped[firstLetter]) {
                grouped[firstLetter] = [];
            }
            grouped[firstLetter].push(item);
        });

        
        return Object.values(grouped)
            .map(group => group.join(" "))
            .join("\n");
    }

    
    const formattedGoodList = groupByStartingLetter(goodList);
    const formattedBadList = groupByStartingLetter(badList);
    const formattedChangeDrillList = groupByStartingLetter(changeDrillList);

    
    const feedbackText = `Good:\n${formattedGoodList}\n\nChange/Drill:\n${formattedChangeDrillList}\n\nBad:\n${formattedBadList}`;

    
    navigator.clipboard.writeText(feedbackText).then(() => {
        console.log("Feedback copied to clipboard!");
        //alert("Feedback copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy feedback to clipboard:", err);
        alert("Failed to copy feedback to clipboard.");
    });
}

function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text).then(() => {
        console.log(`Copied: ${text}`);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

function copyCyclePositions(originId = "none") {
    let cycleData;

    
    if (originId === "lastCycleLetters" || originId === "lastScramble") {
        
        cycleData = previousCycle || "No previous cycle data available";
    } else {
        
        cycleData = document.getElementById("cycle").innerText.trim();
    }

    
    const pieceNotation = getPieceNotation(cycleData);

    if (!pieceNotation) {
        console.warn("Failed to convert cycle letters to piece notation.");
        return;
    }

    
    const formattedData = `?how ${pieceNotation}`;

    
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

    
    cycleFeedbackMap.set(cycleLetters, 0);

    console.log(`Marked "${cycleLetters}" as Bad.`);
    updateFeedbackResults(); 
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

    
    cycleFeedbackMap.set(cycleLetters, 1);

    console.log(`Marked "${cycleLetters}" as Good.`);
    updateFeedbackResults(); 
}

document.getElementById("clearUserAlgsButton").addEventListener("click", function () {
    const userDefinedAlgs = document.getElementById("userDefinedAlgs");
    userDefinedAlgs.value = ""; 
    console.log("User-defined algs cleared.");
});

let fetchedAlgs = []; 

const lastFetchLabel = document.getElementById("lastFetchLabel");

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

        
        fetchedAlgs = text
            .split("\n") 
            .map(row => row.split("\t")) 
            .filter(columns => columns.length >= 2) 
            .map(columns => ({ key: columns[0].trim(), value: columns[1].trim() })) 
            .filter(pair => pair.key !== "" && pair.value !== "" && pair.value !== "\r"); 

        alert(`Fetched ${fetchedAlgs.length} algorithms successfully.`);
        console.log("Fetched algorithms:", fetchedAlgs);
        saveFetchedAlgs(fetchedAlgs); 
    } catch (err) {
        console.error("Failed to fetch algorithms:", err);
        alert("Failed to fetch algorithms.");
    }
}

document.addEventListener("DOMContentLoaded", loadCachedAlgs);

document.getElementById("fetchAlgsButton").addEventListener("click", fetchAlgs);

document.addEventListener("DOMContentLoaded", function () {
    
    const selectionGrid = document.getElementById("selectionGrid");
    selectionGrid.style.display = "none"; 
});

const selectedSets = {};

let disableInversesMode = localStorage.getItem(getStorageKey("disableInversesMode")) === "true";

document.getElementById("letterSelector").addEventListener("click", function () {
    const selectionGrid = document.getElementById("selectionGrid");
    selectionGrid.innerHTML = "";

    const headerDiv = document.createElement("div");
    headerDiv.style.display = "flex";
    headerDiv.style.justifyContent = "flex-end";
    headerDiv.style.padding = "0 0 5px 0";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "X";
    closeBtn.className = "close-button close-set"; 
    closeBtn.addEventListener("click", () => selectionGrid.style.display = "none");
    headerDiv.appendChild(closeBtn);
    selectionGrid.appendChild(headerDiv);

    const titleContainer = document.createElement("div");
    titleContainer.className = "selector-title-container";

    const mainTitle = document.createElement("h2");
    mainTitle.textContent = "Select sets to practice";
    mainTitle.className = "selector-main-title";

    const subTitle = document.createElement("p");
    subTitle.textContent = "Inverses are separated for easier control";
    subTitle.className = "selector-sub-title";

    const countLabel = document.createElement("div");
    countLabel.id = "set-selector-count";
    countLabel.style.fontSize = "1.2rem";
    countLabel.style.fontWeight = "bold";
    countLabel.style.marginTop = "8px";
    countLabel.style.color = "#4CAF50"; 
    countLabel.textContent = "Calculating..."; 

    titleContainer.appendChild(mainTitle);
    titleContainer.appendChild(subTitle);
    titleContainer.appendChild(countLabel);
    selectionGrid.appendChild(titleContainer);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "selector-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Toggle all sets";
    toggleBtn.className = "large-button action-btn toggle-action"; 
    toggleBtn.addEventListener("click", () => {
        const visibleBtns = Array.from(document.querySelectorAll(".set-btn:not(.buffer)"));
        const allAreOn = visibleBtns.every(btn => !btn.classList.contains("untoggled"));
        const newState = !allAreOn; 
        
        visibleBtns.forEach(btn => {
            btn.classList.toggle("untoggled", !newState);
            const letter = btn.dataset.letter;
            const pos = btn.dataset.position; 
            const setKey = pos === 'first' ? `${letter}_` : `_${letter}`;
            selectedSets[setKey] = newState;
        });
        
        fetchedAlgs.forEach(alg => stickerState[alg.key] = newState);
        
        saveSelectedSets();
        saveStickerState();
        updateActiveAlgCount(); 
    });

    const saveCloseBtn = document.createElement("button");
    saveCloseBtn.textContent = "Save & close";
    saveCloseBtn.className = "large-button action-btn save-close-action";
    saveCloseBtn.addEventListener("click", () => {
        updateUserDefinedAlgs();
        selectionGrid.style.display = "none";
    });

    const saveStartBtn = document.createElement("button");
    saveStartBtn.textContent = "Save & start session";
    saveStartBtn.className = "large-button action-btn save-start-action";
    saveStartBtn.addEventListener("click", () => {
        updateUserDefinedAlgs();
        selectionGrid.style.display = "none";
        initializeSession(); 
    });

    actionsDiv.appendChild(toggleBtn);
    actionsDiv.appendChild(saveCloseBtn);
    actionsDiv.appendChild(saveStartBtn);
    selectionGrid.appendChild(actionsDiv);

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
        const rowLeftBtns = [];
        const rowRightBtns = [];
        
        face.indices.forEach(index => {
            if (validIndices.has(index)) {
                let letter = POSITION_TO_LETTER_MAP[index];
                if (letter && letter.trim() !== "" && letter !== "-" && !faceLetters.has(letter)) {
                    faceLetters.add(letter);

                    // Function to create button
                    const createBtn = (pos) => {
                        const btn = document.createElement("button");
                        // Use lowercase face name to match CSS
                        btn.className = `set-btn face-${face.name.toLowerCase()}`;
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

                            btn.addEventListener("click", () => handleGridButtonClick(btn, letter, pos, index));
                            
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

                    // Collect buttons for this letter
                    rowLeftBtns.push(createBtn('first'));
                    rowRightBtns.push(createBtn('second'));
                }
            }
        });

        // SWAP LOGIC: Swap the last two buttons in the row (e.g., A B C D -> A B D C)
        if (rowLeftBtns.length >= 2) {
            const len = rowLeftBtns.length;
            // Swap left group
            [rowLeftBtns[len - 1], rowLeftBtns[len - 2]] = [rowLeftBtns[len - 2], rowLeftBtns[len - 1]];
            // Swap right group
            [rowRightBtns[len - 1], rowRightBtns[len - 2]] = [rowRightBtns[len - 2], rowRightBtns[len - 1]];
        }

        // Append buttons to groups
        rowLeftBtns.forEach(btn => leftGroup.appendChild(btn));
        rowRightBtns.forEach(btn => rightGroup.appendChild(btn));

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
    updateActiveAlgCount(); 
});

function updateUserDefinedAlgs() {
    console.log("Filtering algorithms based on centralized stickerState...");

    
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

    
    const activeSets = new Set(selectedSetNames);

    
    const filteredAlgs = fetchedAlgs.filter(pair => {
        const isStickerSelected = stickerState[pair.key] ?? true; 
        const [firstLetter, secondLetter] = pair.key.split(""); 
        const isSetActive = activeSets.has(firstLetter) || activeSets.has(secondLetter); 

        return isStickerSelected && isSetActive; 
    });
    
    const uniqueAlgs = [...new Set(filteredAlgs.map(pair => pair.value.trim()))];
    console.log("Filtered and unique algorithms:", uniqueAlgs);

    return uniqueAlgs;
}

document.addEventListener("DOMContentLoaded", function () {
    loadStickerState(); 
    loadSelectedSets(); 
});

document.getElementById("connectSmartCubeReplica").addEventListener("click", function () {
    document.getElementById("connectSmartCube").click(); 
});

const stickerState = {}; 

document.querySelectorAll(".gridButton").forEach(button => {
    const setName = button.dataset.letter; 

    button.addEventListener("contextmenu", function (event) {
        event.preventDefault(); 
        showPairSelectionGrid(setName);
    });

    button.addEventListener("touchstart", function (event) {
        
        let timeout = setTimeout(() => {
            showPairSelectionGrid(setName);
        }, 500); 
        button.addEventListener("touchend", () => clearTimeout(timeout), { once: true });
    });
});

const ALL_LETTERS = "AOIEFGHJKLNBPQTSRCDWZ".split(""); 

const EXCLUDED_TRIOS_CORNERS = [
    ["A", "E", "R"], 
    ["O", "Q", "N"], 
    ["I", "J", "F"], 
    ["C", "G", "L"], 
    ["D", "K", "P"], 
    ["W", "B", "T"], 
    ["Z", "S", "H"], 
    ["U", "Y", "M"], 
];

const EXCLUDED_DUOS_EDGES = [
    ["A", "Q"], 
    ["O", "M"], 
    ["I", "E"], 
    ["F", "L"], 
    ["G", "Z"], 
    ["H", "R"], 
    ["J", "P"], 
    ["K", "C"], 
    ["N", "T"], 
    ["B", "D"], 
    ["S", "W"], 
    ["U", "Y"], 
];

function isExcludedCombination(combination) {
    const currentExclusions = determineCycleType() === "corner" ? EXCLUDED_TRIOS_CORNERS : EXCLUDED_DUOS_EDGES;

    for (const group of currentExclusions) {
        const [letter1, letter2] = combination.split("");
        if (group.includes(letter1) && group.includes(letter2)) {
            return true; 
        }
    }
    return false; 
}

function showPairSelectionGrid(setName) {
    const pairSelectionGrid = document.getElementById("pairSelectionGrid");
    const leftPairGrid = document.getElementById("leftPairGrid");
    const rightPairGrid = document.getElementById("rightPairGrid");
    const pairSelectionTitle = document.getElementById("pairSelectionTitle");
    
    pairSelectionTitle.textContent = `Select Pairs for Letter ${setName}`;
    
    leftPairGrid.innerHTML = "";
    rightPairGrid.innerHTML = "";
    
    // 1. Determine Context (Corner vs Edge)
    const mode = currentMode; // "corner" or "edge"
    
    // 2. Identify Buffer Group based on standard scheme assumptions or configuration
    // (Matches logic in letterSelector: Edge=UF[7,19], Corner=UFR[8,9,20])
    const BUFFER_INDICES = mode === "edge" ? [7, 19] : [8, 9, 20];
    const bufferGroupId = getPieceGroupId(BUFFER_INDICES[0], mode);

    // 3. Get lookups
    const letterToMap = mode === "edge" ? cachedEdgeLetterToIndex : cachedCornerLetterToIndex;
    
    // Get index of the primary letter (setName)
    const primaryIndex = letterToMap[setName];
    const primaryGroupId = primaryIndex !== undefined ? getPieceGroupId(primaryIndex, mode) : -1;

    // Get all available letters
    const activeLetters = getActiveSchemeLetters(); 

    // 4. Generate Pairs with Geometric Filtering
    const pairs = activeLetters
        .flatMap(letter => [`${setName}${letter}`, `${letter}${setName}`]) // Generate candidates
        .filter((pair, index, self) => self.indexOf(pair) === index) // Unique
        .filter(pair => {
            const l1 = pair[0];
            const l2 = pair[1];

            // A. Identity Check
            if (l1 === l2) return false;

            // Get indices from cache
            const idx1 = letterToMap[l1];
            const idx2 = letterToMap[l2];

            // Safety check: if letters aren't in map, exclude
            if (idx1 === undefined || idx2 === undefined) return false;

            const g1 = getPieceGroupId(idx1, mode);
            const g2 = getPieceGroupId(idx2, mode);

            // B. Geometric Check: Are they on the same piece?
            if (g1 === g2) return false;

            // C. Buffer Check: Is either piece the buffer?
            // (Note: Usually we don't shoot TO buffer, and we don't start FROM buffer in pairs list
            // unless we are doing float handling, but standard practice is to exclude buffer stickers)
            if (g1 === bufferGroupId || g2 === bufferGroupId) return false;

            return true;
        })
        .sort(customComparator);

    // --- The rest of the function remains the same (Drawing the UI) ---

    pairs.forEach(pair => {
        if (!(pair in stickerState)) {
            stickerState[pair] = true; 
        }
    });

    const colorGroups = {};
    pairs.forEach(pair => {
        const colorLetter = pair[0] === setName ? pair[1] : pair[0];
        // Handle cases where color might be missing in default map
        const defaultColorInfo = LETTER_COLORS[colorLetter] || { background: "grey" };
        const background = defaultColorInfo.background;
        
        if (!colorGroups[background]) {
            colorGroups[background] = [];
        }
        colorGroups[background].push(pair);
    });

    Object.keys(colorGroups).forEach(colorName => {
        const leftRow = document.createElement("div");
        const rightRow = document.createElement("div");
        leftRow.className = "grid-row";
        rightRow.className = "grid-row";

        colorGroups[colorName].forEach(pair => {
            const button = document.createElement("button");
            button.classList.add("pairButton"); 

            const safeColorName = colorName.toLowerCase().replace(/\s+/g, '-');
            button.classList.add(`sticker-${safeColorName}`); 
            button.textContent = pair;
            button.dataset.pair = pair; 

            if (!stickerState[pair]) {
                button.classList.add("untoggled");
            }

            const isLeftSide = pair.startsWith(setName);
            button.addEventListener("click", () => {
                const newState = !stickerState[pair];

                stickerState[pair] = newState;
                button.classList.toggle("untoggled", !newState);

                // Toggle inverse logic
                if (isLeftSide) {
                    const reversePair = `${pair[1]}${pair[0]}`;
                    stickerState[reversePair] = newState; 

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

            if (isLeftSide) {
                leftRow.appendChild(button);
            } else {
                rightRow.appendChild(button);
            }
        });

        if (leftRow.children.length > 0) {
            leftPairGrid.appendChild(leftRow);
        }
        if (rightRow.children.length > 0) {
            rightPairGrid.appendChild(rightRow);
        }
    });

    pairSelectionGrid.style.display = "block";
}

document.getElementById("applyPairSelectionButton").addEventListener("click", function (event) {
    event.stopPropagation(); 

    const pairSelectionGrid = document.getElementById("pairSelectionGrid");
    pairSelectionGrid.style.display = "none";

    saveStickerState();
    updateActiveAlgCount();
    updateUserDefinedAlgs();
});

document.addEventListener("DOMContentLoaded", function () {
    const selectionGrid = document.getElementById("selectionGrid");

    const existingResetButton = selectionGrid.querySelector(".reset-button");
    if (!existingResetButton) {
        const resetButton = document.createElement("button");
        resetButton.textContent = "Reset All Sets and Stickers";
        resetButton.className = "reset-button"; 
        resetButton.addEventListener("click", () => {
            Object.keys(selectedSets).forEach(setName => {
                selectedSets[setName] = true; 
            });

            const allStickerKeys = Object.keys(stickerState); 
            updateStickerState(allStickerKeys); 

            document.querySelectorAll(".gridButton").forEach(button => {
                const setName = button.dataset.letter;
                button.classList.remove("untoggled"); 
            });
            saveSelectedSets();
            console.log("All sets and stickers reset to toggled state.");
        });
        selectionGrid.appendChild(resetButton);
    }
});

function updateStickerState(keysWithValues) {
    console.log("Updating sticker state...");
    Object.keys(stickerState).forEach(key => {
        stickerState[key] = false;
    });
    
    keysWithValues.forEach(key => {
        stickerState[key] = true;
    });

    console.log("Updated sticker state:", stickerState);

    saveStickerState();
}

function saveSelectedSets() {
    localStorage.setItem(getStorageKey("selectedSets"), JSON.stringify(selectedSets));
    console.log(`Selected sets saved for ${currentMode}:`, selectedSets);
}

function loadSelectedSets() {
    const savedSets = localStorage.getItem(getStorageKey("selectedSets"));
    if (savedSets) {
        Object.assign(selectedSets, JSON.parse(savedSets));
        document.querySelectorAll(".gridButton").forEach(button => {
            const setName = button.dataset.letter;
            button.classList.toggle("untoggled", !selectedSets[setName]);
        });
    } else {
        
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
            
            const pairSelectionGrid = document.getElementById("pairSelectionGrid"); 
            if (pairSelectionGrid && pairSelectionGrid.style.display !== "none") {
                pairSelectionGrid.style.display = "none"; 
                saveStickerState(); 
                console.log("Pair selection grid closed and state saved.");
            }

            console.log("Applying set/sticker selections to textbox...");
            updateUserDefinedAlgs(); 

            const selectionGrid = document.getElementById("selectionGrid");
            if (selectionGrid) {
                selectionGrid.style.display = "none";
            }
        });
    }
}

function determineCycleType() {
    return currentMode; 
}

function getPieceNotation(cycleLetters) {
    const cycleType = determineCycleType();
    if (!cycleType) {
        alert("Invalid cycle type. Please check the page.");
        return null;
    }

    const buffer = cycleType === "edge" ? "UF" : "UFR";

    const lookupCache = cycleType === "edge" ? cachedEdgeLetterToIndex : cachedCornerLetterToIndex;
    const notationMap = cycleType === "edge" ? EDGE_PIECE_MAP : CORNER_PIECE_MAP;

    const pieces = cycleLetters.split("").map(customLetter => {
        const index = lookupCache[customLetter];

        if (index === undefined) {
            console.warn(`Letter '${customLetter}' not found in current ${cycleType} scheme.`);
            return undefined;
        }

        const standardLetter = DEFAULT_POSITION_TO_LETTER_MAP[index];

        return notationMap[standardLetter];
    });

    if (pieces.includes(undefined)) {
        return null;
    }

    return [buffer, ...pieces].join(" ");
}
document.getElementById("cycle").addEventListener("click", function () {
    const cycleLetters = this.textContent.trim(); 
    const pieceNotation = getPieceNotation(cycleLetters); 

    if (!pieceNotation) {
        alert("Missing piece notation for one or more letters.");
        return;
    }

    const formattedData = `?how ${pieceNotation}`;
    
    navigator.clipboard.writeText(formattedData).then(() => {
        console.log("Piece notation copied to clipboard:", pieceNotation);
    }).catch(err => {
        console.error("Failed to copy piece notation to clipboard:", err);
    });
});

const drillingModeToggle = document.getElementById("drillingModeToggle");
const drillingModeLabel = document.getElementById("drillingModeLabel");

const savedDrillingMode = localStorage.getItem("drillingMode") === "true";
let isDrillingMode = savedDrillingMode;

drillingModeToggle.checked = isDrillingMode;
drillingModeLabel.textContent = isDrillingMode ? "Drilling" : "Regular";

drillingModeToggle.addEventListener("change", function () {
    isDrillingMode = this.checked; 
    localStorage.setItem("drillingMode", isDrillingMode); 
    drillingModeLabel.textContent = isDrillingMode ? "Drilling" : "Regular"; 

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

        
        const commutators = partialList
            .map(pair => pair.value.trim())
            .filter(comm => comm !== "");

        
        document.getElementById("userDefinedAlgs").value = commutators.join("\n");

        console.log(`Textbox populated with ${commutators.length} algs from the partial sheet.`);
        alert("Textbox has been updated with algorithms from the partial filter.");

    } catch (error) {
        console.error("Error fetching or applying the partial filter:", error);
        alert("Failed to fetch or apply the partial filter.");
    }
}

async function fetchAlgorithms(proxyUrl) {
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch algorithms from ${proxyUrl}`);
        }
        const text = await response.text();

        
        return text
            .split("\n") 
            .map(row => row.split("\t")) 
            .filter(columns => columns.length >= 2) 
            .map(columns => ({ key: columns[0].trim(), value: columns[1].trim() })) 
            .filter(pair => pair.key !== "" && pair.value !== "" && pair.value !== "\r"); 
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

    body.classList.add("solve-success-flash");
    setTimeout(() => {
        body.classList.remove("solve-success-flash"); 
  
    }, 400); 
}

const visualFeedbackCheckbox = document.getElementById("visualFeedbackCheckbox");

const savedVisualFeedback = localStorage.getItem("visualFeedbackEnabled");
let isVisualFeedbackEnabled = savedVisualFeedback === null ? true : savedVisualFeedback === "true";

visualFeedbackCheckbox.checked = isVisualFeedbackEnabled;
localStorage.setItem("visualFeedbackEnabled", isVisualFeedbackEnabled); 

visualFeedbackCheckbox.addEventListener("change", function () {
    
    isVisualFeedbackEnabled = this.checked;
    
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

function populateGridFromScheme(schemeMap) {
    if (!schemeMap) return;

    const inputs = document.querySelectorAll('.sticker-input');
    
    inputs.forEach(input => {
        const index = parseInt(input.getAttribute('data-index'));
        const val = schemeMap[index];
        
        if (val !== undefined) {
            
            if (!input.disabled) {
                input.value = val;
            }
        }
    });
}

const saveSchemeButton = document.getElementById("saveLetterScheme");
if (saveSchemeButton) {
    saveSchemeButton.addEventListener("click", function () {
        const schemeMap = applySchemeFromGrid();

        updateLetterSchemeCache();

        try {
            localStorage.setItem("customLetterSchemeJSON", JSON.stringify(schemeMap));
            alert("Custom letter scheme saved!");
        } catch (e) {
            console.error("Error saving scheme:", e);
            alert("Failed to save scheme.");
        }
    });
}

const speffzSchemeButton = document.getElementById("speffzLetterScheme");
if (speffzSchemeButton) {
    speffzSchemeButton.addEventListener("click", function () {
        if (confirm("Load standard Speffz scheme?")) {
            Object.assign(POSITION_TO_LETTER_MAP, SPEFFZ_LETTER_MAP);
            populateGridFromScheme(SPEFFZ_LETTER_MAP);
            updateLetterSchemeCache();
            localStorage.setItem("customLetterSchemeJSON", JSON.stringify(SPEFFZ_LETTER_MAP));
        }
    });
}

const hanusSchemeButton = document.getElementById("hanusLetterScheme");
if (hanusSchemeButton) {
    hanusSchemeButton.addEventListener("click", function () {
        if (confirm("Load gigachad Hanuś scheme?")) {
            Object.assign(POSITION_TO_LETTER_MAP, HANUS_LETTER_MAP);
            populateGridFromScheme(HANUS_LETTER_MAP);
            updateLetterSchemeCache();
            localStorage.setItem("customLetterSchemeJSON", JSON.stringify(HANUS_LETTER_MAP));
        }
    });
}

const kacperSchemeButton = document.getElementById("kacperLetterScheme");
if (kacperSchemeButton) {
    kacperSchemeButton.addEventListener("click", function () {
        if (confirm("Load Kacper's lettering scheme?")) {
            localStorage.removeItem("customLetterSchemeJSON");
            Object.assign(POSITION_TO_LETTER_MAP, DEFAULT_POSITION_TO_LETTER_MAP);
            populateGridFromScheme(DEFAULT_POSITION_TO_LETTER_MAP);
            updateLetterSchemeCache(); 
        }
    });
}

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
        const oldString = localStorage.getItem("customLetterScheme");
        if (oldString && oldString.length === 54) {
             console.log("Old string format detected but ignored. Please re-save.");
        }
        
        populateGridFromScheme(DEFAULT_POSITION_TO_LETTER_MAP);
    }

    updateLetterSchemeCache();
});

function getActiveSchemeLetters() {
    const indices = currentMode === "corner" ? CORNER_FACELET_INDICES : EDGE_FACELET_INDICES;
    const letters = new Set();

    indices.forEach(index => {
        let char = POSITION_TO_LETTER_MAP[index];
        if (char && char.trim() !== "" && char !== "-") {
            letters.add(char.trim());
        }
    });

    return Array.from(letters).sort();
}

function updateActiveAlgCount() {
    const statsLabel = document.getElementById("set-selector-count");
    if (!statsLabel) return;

    const activeCount = fetchedAlgs.filter(alg => stickerState[alg.key] !== false).length;
    const totalCount = fetchedAlgs.length;

    statsLabel.textContent = `Selected: ${activeCount} / ${totalCount}`;
    statsLabel.style.color = activeCount === 0 ? "#ff4444" : "#4CAF50";
}

function handleGridButtonClick(button, letter, position, index) {
    const setKey = position === 'first' ? `${letter}_` : `_${letter}`;
    const newState = !selectedSets[setKey];
    selectedSets[setKey] = newState;

    button.classList.toggle("untoggled", !newState);
    saveSelectedSets();

    const dbLetter = (typeof DEFAULT_POSITION_TO_LETTER_MAP !== 'undefined' && DEFAULT_POSITION_TO_LETTER_MAP[index]) 
                     ? DEFAULT_POSITION_TO_LETTER_MAP[index] 
                     : letter;

    if (fetchedAlgs.length > 0) {
        fetchedAlgs.forEach(item => {
            const key = item.key;
            if (key.length < 2) return;
            
            if (position === 'first' && key[0] === dbLetter) {
                stickerState[key] = newState;
            } else if (position === 'second' && key[1] === dbLetter) {
                stickerState[key] = newState;
            }
        });
        saveStickerState();
    }
    updateActiveAlgCount();
}

function updateLetterSchemeCache() {
    cachedEdgeLetterToIndex = {};
    cachedCornerLetterToIndex = {};

    const validCornerIndices = new Set(CORNER_FACELET_INDICES);
    const validEdgeIndices = new Set(EDGE_FACELET_INDICES);

    for (let i = 0; i < 54; i++) {
        const letter = POSITION_TO_LETTER_MAP[i];
        
        // Ensure we have a valid letter
        if (letter && typeof letter === 'string' && letter !== "-" && letter.trim() !== "") {
            const cleanLetter = letter.trim();

            if (validCornerIndices.has(i)) {
                cachedCornerLetterToIndex[cleanLetter] = i;
            } else if (validEdgeIndices.has(i)) {
                cachedEdgeLetterToIndex[cleanLetter] = i;
            }
        }
    }
    console.log("Letter scheme cache updated.");
}

document.addEventListener("click", function(event) {
    const selectionGrid = document.getElementById("selectionGrid");
    const letterSelector = document.getElementById("letterSelector");
    const pairSelectionGrid = document.getElementById("pairSelectionGrid");

    if (selectionGrid && selectionGrid.style.display === "block") {
        if (!selectionGrid.contains(event.target) && 
            !letterSelector.contains(event.target) &&
            (!pairSelectionGrid || !pairSelectionGrid.contains(event.target))) {
            console.log("Clicked outside set selector. Saving and closing...");
            updateUserDefinedAlgs();
            selectionGrid.style.display = "none";
            
            if (pairSelectionGrid) pairSelectionGrid.style.display = "none";
        }
    }
});