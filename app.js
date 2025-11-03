"use strict";

const sample = (a, range=null) => {
  if (!Array.isArray(a)) return ''
  range = (range == null ? a.length : range);
  return a[Math.floor(Math.random()*range)]
}

const rand = (min, max) => Math.random() * (max - min) + min;

const getRandomInt = (min, max) => Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min);

const getRandomItem = function(list, weight) {
  let total_weight = weight.reduce((prev, cur, i, arr) => prev + cur );
   
  let random_num = rand(0, total_weight);
  let weight_sum = 0;
   
  for (let i = 0; i < list.length; i++) {
    weight_sum += weight[i];
    weight_sum = +weight_sum.toFixed(2);
     
    if (random_num <= weight_sum) {
      return list[i];
    }
  }
};

const refreshHouse = function(config= null) {
  let house = new HouseScenario(21, "houseCanvas")
  house.generate(config);
}




// Integer-only behavior for zoneInput fields (desktop-safe)
function setupZoneInputSanitizers(){
  const fields = Array.from(document.getElementsByClassName('zoneInput'));
  if (!fields.length) return;
  fields.forEach(el => {
    // Helpful attributes
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('step', '1');
    el.setAttribute('min', '0');
    el.setAttribute('max', '100');
    el.setAttribute('pattern', '\\d*');

    // Prevent decimals while typing; allow empty while editing
    el.addEventListener('input', (e) => {
      const t = e.target;
      // keep only digits
      const digits = String(t.value).replace(/[^\d]/g, '');
      if (t.value !== digits) t.value = digits;
    });

    // On blur/Enter, coerce to 0..100 integer
    const commit = (t) => {
      const n = parseInt(String(t.value||'').trim(), 10);
      const v = Math.max(0, Math.min(100, isNaN(n) ? 0 : n));
      t.value = String(v);
    };
    el.addEventListener('blur', (e) => commit(e.target));
    el.addEventListener('change', (e) => commit(e.target));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(e.target); e.target.blur(); }
    });
  });
}
// === Write current scenario JSON into the editor (feet) ===
function mirrorScenarioToEditor(){
  try {
    const ta = document.getElementById('stones-ft');
    const cfgText = document.getElementById('scenario_config')?.value || '{}';
    if (!ta || !cfgText) return;

    const cfg   = JSON.parse(cfgText);
    const scale = Number(cfg.scale || 30);
    const house = document.getElementById('houseCanvas');
    const cx    = (house?.width || (scale*14)) / 2;
    const cy    = cx;
    const cols  = Array.isArray(cfg.stone_colours) ? cfg.stone_colours : ['Red','Yellow'];

    const lines = (cfg.coordinates || []).map((st, i) => {
      const xft = ((st.origin.x - cx) / scale).toFixed(2);
      const yft = ((st.origin.y - cy) / scale).toFixed(2);
      const cname = cols[st.colour_index] || (st.colour_index === 1 ? 'Yellow' : 'Red');
      const num = (st.num != null) ? st.num : Math.ceil((i+1)/2);
      return `${cname}, ${xft}, ${yft}, ${num}`;
    });
    ta.value = lines.join('\n');

    const mc = document.getElementById('manual-count');
    if (mc) mc.textContent = String((cfg.coordinates || []).length);
  } catch {}
}

function HouseScenario(scale, canvasId) {
  this.debug = false;
  this.scale = scale;
  this.stone_radius = (this.scale * 0.48);
  this.width = (scale * 14);
  this.height = (scale * 28);
  this.scenarioConfig = {
    coordinates: [],
    description: "",
    scale: scale,
  };
  this.defaultCanvasValues = {
    lineWidth: scale < 40 ? 1 : 2,
  }

  // configure the canvas
  this.canvas = document.getElementById(canvasId);
  this.canvas.width = this.width;
  this.canvas.height = this.height;
  this.context = document.getElementById(canvasId).getContext("2d");
  this.context.lineWidth = this.defaultCanvasValues.lineWidth;
}

HouseScenario.prototype.drawCircle = function(origin, radius, colour="white") {
  this.context.beginPath();
  this.context.arc(origin.x, origin.y, radius, 0, 2 * Math.PI);
  this.context.fillStyle = colour;
  this.context.fill();
  this.context.stroke();
},

HouseScenario.prototype.drawHouse = function() {
  let origin    = {x: (this.canvas.width / 2), y: (this.canvas.width / 2)},
      back_line = (origin.y - (6 * this.scale)),
      hog_line  = (origin.y + (21 * this.scale));

  this.drawCircle(origin, (6 * this.scale), 'red');  // Twelve foot
  this.drawCircle(origin, (4 * this.scale)); // Eight foot
  this.drawCircle(origin, (2 * this.scale), 'blue'); // Four foot
  this.drawCircle(origin, (0.5 * this.scale)); // Button

  // Centre line
  this.context.beginPath();
  this.context.moveTo(0, origin.y);
  this.context.lineTo(this.canvas.width, origin.y);
  this.context.stroke();

  // T-line
  this.context.beginPath();
  this.context.moveTo(origin.x, back_line);
  this.context.lineTo(origin.x, this.canvas.height);
  this.context.stroke();

  // Backline
  this.context.beginPath();
  this.context.moveTo(0, back_line);
  this.context.lineTo(this.canvas.width, back_line);
  this.context.stroke();

  // Hogline
  this.context.beginPath();
  this.context.moveTo(0, hog_line);
  this.context.lineTo(this.canvas.width, hog_line);
  this.context.lineWidth = this.defaultCanvasValues.lineWidth * 5;
  this.context.stroke();
  this.context.lineWidth = this.defaultCanvasValues.lineWidth;
},

HouseScenario.prototype.drawStone = function(pos, colour, num) {
  this.context.lineWidth = 0.5;
  this.drawCircle(pos, this.stone_radius, 'grey');
  this.drawCircle(pos, (this.stone_radius * 0.7), colour);
  this.context.lineWidth = this.defaultCanvasValues.lineWidth;
  return false;
},

HouseScenario.prototype.overlappingStones = function(pos, existing) {
  let newStone = {radius: this.stone_radius, x: pos.x, y: pos.y};

  for(let i=0; i < existing.length; i++) {
    let stone = {radius: this.stone_radius, x: existing[i].origin.x, y: existing[i].origin.y};
    let dx = newStone.x - stone.x;
    let dy = newStone.y - stone.y;
    let distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < newStone.radius + stone.radius) {
      return true;
    }
  }
  return false;
},

HouseScenario.prototype.fetchZone = function(zones) {
  let origin    = {x: (this.canvas.width / 2), y: (this.canvas.width / 2)},
      back_line = (origin.y - (6 * this.scale) - this.stone_radius),
      hog_line  = (origin.y + (21 * this.scale) - this.stone_radius);

  let list = zones.map(function(e) { return e.name });
  let weight = zones.map(function(e) { return e.weight });

  const s = this.scale;
  const y = origin.y;

  // Thresholds in feet from tee center (converted via scale)
  const plus16  = y + (16 * s);
  const plus11  = y + (11 * s);
  const plus7   = y + (7  * s);
  const plus5   = y + (5  * s);
  const plus3   = y + (3  * s);
  const plus1   = y + (1  * s);
  const minus1  = y - (1  * s);
  const minus2_5= y - (2.5* s);
  const minus4  = y - (4  * s);

  // Ten zones: far hog to deep backline
  let elements = {
    "zone1":  { min: plus16,  max: hog_line },
    "zone2":  { min: plus11,  max: plus16 },
    "zone3":  { min: plus7,   max: plus11 },
    "zone4":  { min: plus5,   max: plus7 },
    "zone5":  { min: plus3,   max: plus5 },
    "zone6":  { min: plus1,   max: plus3 },
    "zone7":  { min: minus1,  max: plus1 },
    "zone8":  { min: minus2_5,max: minus1 },
    "zone9":  { min: minus4,  max: minus2_5 },
    "zone10": { min: back_line, max: minus4 },
  };

  return elements[getRandomItem(list, weight)];
};

HouseScenario.prototype.generateStonePos = function(zone) {
  return {
    y: getRandomInt(zone.min, zone.max),
    x: getRandomInt(this.stone_radius, (this.canvas.width - this.stone_radius)),
  }
},

HouseScenario.prototype.scenarioToString = function(config) {
  let ends = (config.numberOfEnds ? ` (${config.numberOfEnds} ends)` : '' );
  return `${config.colour}, ${config.end} end ${config.hammer ? 'w/' : 'w/o '}hammer, ${config.thrower}, ${config.score_diff}${ends}`
}

HouseScenario.prototype.randomScenario = function(colours, numberOfEnds = 8, stonesThrown = 15, currentEnd="") {
  let labels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'],
      positions = ["Lead's first","Lead's last","Second's first","Second's last","Third's first","Third's last","Skip's first","Skip's last"],
      up_down = sample(['Up', 'Down']),
      nextStone = stonesThrown + 1,
      score_diff = Math.floor(Math.random()*6);


      console.log(currentEnd)
  let conf = {
    numberOfEnds: numberOfEnds,
    end: (currentEnd != "" ? currentEnd : sample(labels, numberOfEnds)),
    hammer: (stonesThrown % 2 == 0),
    colour: sample(colours),
    thrower: positions[Math.ceil(nextStone/2)-1],
    score_diff: ''
  }

  if (conf.end == "2nd" && up_down == "Up" && conf.hammer) {
    up_down = "Down";
  }
  conf.score_diff = (score_diff == 0 || conf.end == '1st' ? 'Tied' : `${up_down} ${score_diff}`);

  return conf;
}

HouseScenario.prototype.drawScenarioText = function(description) { /* removed on request */ }

HouseScenario.prototype.resetHouse = function() {
  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  this.context.lineWidth = this.defaultCanvasValues.lineWidth;;
  this.drawHouse();
}

HouseScenario.prototype.generate = function(config=null) {
  this.resetHouse();

  let configForm = document.getElementById("configForm");
  let colourSelect = configForm.elements.namedItem('stoneColours');
  let notes = configForm.elements.namedItem('scenarioNotes');
  let zoneFields = document.getElementsByClassName("zoneInput");

  if (config) {
    if (this.debug) { console.log("Generating house using supplied config") }
    this.scenarioConfig = config;
    
    // Update the form with the config values?
    colourSelect.value = this.scenarioConfig.stone_colours.join(" / ")
    for (let field of zoneFields) {
      for(let x=0; x < this.scenarioConfig.zone_weights.length; x++) {
        if (field.name == this.scenarioConfig.zone_weights[x].name) {
          field.value = Math.round(this.scenarioConfig.zone_weights[x].weight * 100)
        }
      }
    }
    notes.value = null;
    if (this.scenarioConfig.notes) notes.value = this.scenarioConfig.notes
  } else {
    if (this.debug) { console.log("Generating house using randomly generated config") }
    
    // Pull the config from the form
    let stone_colours = colourSelect.options[colourSelect.selectedIndex].value.split(" / ");

    let minStonesSelect = configForm.elements.namedItem('minThrown');
    let minStones = minStonesSelect.options[minStonesSelect.selectedIndex].value;
    let numEndsEl = configForm.elements.namedItem("numOfEnds");
    let numberOfEnds = numEndsEl ? numEndsEl.value : 8;
    
    let currentEnd = "";
    let currentEndSelect = configForm.elements.namedItem("currentEnd");
    if (currentEndSelect) { currentEnd = currentEndSelect.options[currentEndSelect.selectedIndex].value; }

    let zones = [];
    Array.prototype.forEach.call(zoneFields, function(element) {
      (() => { const n = parseInt(element.value, 10); const v = Math.max(0, Math.min(100, isNaN(n)?0:n)); zones.push({ name: element.name, weight: v / 100 }); })()
    });
    zones.sort((a,b) => (a.weight > b.weight) ? 1 : -1).reverse();

    let stones_thrown = getRandomInt(minStones,15); // all stones thrown
    if (this.debug) { console.log(`Stones Thrown ${stones_thrown}`) }
    this.scenarioConfig = {
      coordinates: [],
      details: this.randomScenario(stone_colours, numberOfEnds, stones_thrown, currentEnd),
      scale: this.scale,
      stone_colours: stone_colours,
      zone_weights: zones,
      notes: ''
    }

    notes.value = null;

    if (this.scenarioConfig.details.hammer && this.scenarioConfig.details.colour == this.scenarioConfig.stone_colours[0]) {
      this.scenarioConfig.stone_colours.reverse();
    }

    // Generate the stone positions
    for(let x=0; x < stones_thrown; x++) {
      let zone = this.fetchZone(zones),
          pos;
      do {
        pos = this.generateStonePos(zone);
      } while (this.overlappingStones(pos, this.scenarioConfig.coordinates));

      // randomly give each stone a 50% chance of being in play
      if (getRandomInt(1,100) > 45) {
        this.scenarioConfig.coordinates.push({ origin: pos, num: Math.ceil((x+1)/2), colour_index: (x % 2) });
      }
    }
  }

  // Draw the scenario
  // Draw the stone positions
  for(let x=0; x < this.scenarioConfig.coordinates.length; x++) {
    let stone = this.scenarioConfig.coordinates[x];
    this.drawStone(stone.origin, this.scenarioConfig.stone_colours[stone.colour_index], stone.num);
  }

  // Draw the scenario text
  if (this.scenarioConfig.description) {
    this.drawScenarioText(this.scenarioConfig.description)
  } else {
    this.drawScenarioText(this.scenarioToString(this.scenarioConfig.details))
  }

  // New scnario clear the notes  
  // Dump the config to screen (for debugging)
  let dump = document.getElementById("scenario_config");
  dump.value = JSON.stringify(this.scenarioConfig, null, 2);
  
}

// Manage the Saved Scenario List
const scenarioListItemNode = function(index, description) {
  let textnode = document.createTextNode(description);
  let node = document.createElement("BUTTON");
  node.setAttribute('type', 'button','data-index', index);
  node.className += "list-group-item list-group-item-action";
  node.appendChild(textnode);
  // Code below is used to set the value of button of each scenario eg: Scenario 1, Scenario 2, ...
  index++;
  node.innerHTML = "Scenario " + index;
  return node;
};

const loadScenario = function(index) {
  let scenarios = JSON.parse(localStorage.getItem("savedScenarios"))
  refreshHouse(scenarios[index]);
};

const loadSavedList = function() {
  let scenarioList = document.getElementById("saved-scenario-list")
  while (scenarioList.firstChild) {
    scenarioList.removeChild(scenarioList.firstChild);
  }

  if (localStorage.getItem("savedScenarios") !== null) {
    let scenarios = JSON.parse(localStorage.getItem("savedScenarios"));
    for(let x=0; x < scenarios.length; x++) { 
      let listItem = scenarioListItemNode(x, scenarios[x].description);
      scenarioList.appendChild(listItem);

      listItem.addEventListener('click', function(evt){
        loadScenario(this.getAttribute('data-index'))
        for (let item of this.parentNode.children) {
          item.classList.remove('active');
        }
        this.className += " active";
      });
    }
  }
}

// Page load initializationsrenderManual
window.addEventListener('load', function() {

  setupZoneInputSanitizers();


document.getElementById('configForm').addEventListener('submit', function(evt){
  evt.preventDefault()
  let field = JSON.parse(document.getElementById('scenario_config').value);
  refreshHouse();
  if (typeof mirrorScenarioToEditor === 'function') mirrorScenarioToEditor();
  if (window.resetManual) window.resetManual();
});


  document.getElementById('toggle-advanced').addEventListener('click', function(evt){
    let advancedForm = document.getElementById('advanced-config');
    advancedForm.style.display = advancedForm.style.display == "block" ? "none" : "block";
  });

  
  // Randomize zone percentages
  const randBtn = document.getElementById('randomize-zones');
  if (randBtn) {
    randBtn.addEventListener('click', function(){
      const fields = Array.from(document.getElementsByClassName('zoneInput'));
      if (!fields.length) return;
      const n = fields.length;
      // random parts -> 100 with integer rounding
      let parts = Array.from({length:n}, () => Math.random());
      let sum = parts.reduce((a,b)=>a+b,0) || 1;
      parts = parts.map(p => (p/sum)*100);
      let ints = parts.map(p => Math.round(p));
      let delta = 100 - ints.reduce((a,b)=>a+b,0);
      while (delta !== 0) {
        const i = Math.floor(Math.random()*n);
        if (delta > 0) { ints[i] += 1; delta--; }
        else if (ints[i] > 0) { ints[i] -= 1; delta++; }
      }
      fields.forEach((el, i) => { el.value = ints[i]; });
if (typeof refreshHouse === 'function') {
  refreshHouse();
  if (typeof mirrorScenarioToEditor === 'function') mirrorScenarioToEditor();
  if (window.resetManual) window.resetManual();
}
    });
  }
document.getElementById('rawJSONConfigForm').addEventListener('submit', function(evt){
  evt.preventDefault()
  let field = JSON.parse(document.getElementById('scenario_config').value);
  refreshHouse(field);
  if (typeof mirrorScenarioToEditor === 'function') mirrorScenarioToEditor();
  if (window.resetManual) window.resetManual();
});


  document.getElementById('clear-saved').addEventListener('click', function(evt){
    if (confirm("Remove all saved scenarios? They cannot be recovered!")) {
      localStorage.removeItem("savedScenarios");
      loadSavedList();
    }
  });

  document.getElementById('save-button').addEventListener('click', function(evt){
    if (this.debug) { console.log('Saving to local storage') }
    let field_value = JSON.parse(document.getElementById('scenario_config').value);
    let scenarios = localStorage.getItem("savedScenarios")
	
	console.log(scenarios);

    let configForm = document.getElementById("configForm");
    let notes = configForm.elements.namedItem('scenarioNotes');
    if (notes.value) { field_value.notes = notes.value }
    console.log(field_value.notes);

    if (scenarios === null) {
      scenarios = [field_value]
    } else {
      scenarios = JSON.parse(scenarios)
	  
	  //console.log(field_value)
      if (!(Array.isArray(scenarios))) {
        localStorage.removeItem("savedScenarios");
        scenarios = [];
      }
	  console.log(field_value)
      scenarios.push(field_value);
    }
    localStorage.setItem("savedScenarios", JSON.stringify(scenarios));
    loadSavedList();
  })

  loadSavedList();
  refreshHouse();
})
