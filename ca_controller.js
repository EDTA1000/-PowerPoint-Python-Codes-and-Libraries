var CA_Controller = { 
    cellSize: 10,
    rows: 0,
    cols: 0,
    grid: [],
    nextGrid: [],
    running: false,
    lastUpdate: 0,
    speed: 1,
    interval: 1000,
    canvas: null,
    ctx: null,
    selectedColor: "#FFA500",
    colorMap: {"1": "#FFA500", "2": "#0000FF", "3": "#FF0000", "4": "#FFFF00", "5": "#00FF00"},
    patterns: {
        glider: [
            [0, 1, 0],
            [0, 0, 1],
            [1, 1, 1]
        ],
        lwss: [
            [0, 1, 1, 1, 1],
 	    [1, 0, 0, 0, 1],
	    [0, 0, 0, 0, 1],
 	    [1, 0, 0, 1, 0]
        ],
        hwss: [
            [0, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 1, 0]
        ],
        pulsar: [
            [0,0,1,1,1,0,0,0,1,1,1,0,0],
	    [0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,1,0,0,1,0,1,0,0,1,0,1],
	    [1,0,0,0,0,1,0,1,0,0,0,0,1],
            [1,0,1,0,0,1,0,1,0,0,1,0,1],
	    [0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,1,1,1,0,0,0,1,1,1,0,0]
        ],
        diehard: [
            [0,0,0,0,0,0,1,0],
            [1,1,0,0,0,0,0,0],
            [0,1,0,0,0,1,1,1]
        ],
        acorn: [
            [0,1,0,0,0,0,0],
            [0,0,0,1,0,0,0],
            [1,1,0,0,1,1,1]
        ],
        rpentomino: [
            [0,1,1],
            [1,1,0],
            [0,1,0]
        ],
        gosper_gun: [
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
            [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
            [1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,1,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        ]
    },
    init: function() {
        this.canvas = document.getElementById("gridCA");
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");
        this.resizeToWindow();
        this.updateInterval();
        this.setupEvents();
        this.drawGrid();
    },
    resizeToWindow: function() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = 600;
        this.cols = Math.floor(this.canvas.width / this.cellSize);
        this.rows = Math.floor(this.canvas.height / this.cellSize);
        this.grid = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => ({ active: false, color: null })));
        this.nextGrid = JSON.parse(JSON.stringify(this.grid));
    },
    drawGrid: function() {
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                if (this.grid[i][j].active) {
                    this.ctx.fillStyle = this.grid[i][j].color;
                    this.ctx.fillRect(j * this.cellSize, i * this.cellSize, this.cellSize - 1, this.cellSize - 1);
                }
            }
        }
    },
    updateGrid: function() {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                let neighbors = 0, colors = {};
                for (let ni = -1; ni <= 1; ni++) {
                    for (let nj = -1; nj <= 1; nj++) {
                        if (ni === 0 && nj === 0) continue;
                        const r = (i + ni + this.rows) % this.rows, c = (j + nj + this.cols) % this.cols;
                        if (this.grid[r][c].active) {
                            neighbors++;
                            colors[this.grid[r][c].color] = (colors[this.grid[r][c].color] || 0) + 1;
                        }
                    }
                }
                const cell = this.grid[i][j];
                if (cell.active && (neighbors === 2 || neighbors === 3)) {
                    this.nextGrid[i][j] = { active: true, color: cell.color };
                } else if (!cell.active && neighbors === 3) {
                    let dominant = "#FFA500", max = -1;
                    for (let c in colors) { if (colors[c] > max) { max = colors[c]; dominant = c; } }
                    this.nextGrid[i][j] = { active: true, color: dominant };
                } else {
                    this.nextGrid[i][j] = { active: false, color: null };
                }
            }
        }
        this.grid = JSON.parse(JSON.stringify(this.nextGrid));
        this.drawGrid();
    },
    updateInterval: function() { this.interval = 1000 / this.speed; },
    setupEvents: function() {
      const getCoords = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    let isDrawing = false;

    this.canvas.addEventListener('mousedown', (e) => {
        const coords = getCoords(e);
        const pat = document.getElementById('patternSelect').value;
        
        if (pat) {
            this.placePattern(pat, coords.x, coords.y);
        } else {
            isDrawing = true;
            this.toggleCell(coords.x, coords.y, true);
        }
    });

    this.canvas.addEventListener('mousemove', (e) => {
        if (isDrawing) {
            const coords = getCoords(e);
            this.toggleCell(coords.x, coords.y, true);
        }
    });

    window.addEventListener('mouseup', () => {
        isDrawing = false;
    });
   },

   toggleCell: function(x, y, forceActive = false) {
    const c = Math.floor(x / this.cellSize);
    const r = Math.floor(y / this.cellSize);

    if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
        if (forceActive) {
            this.grid[r][c].active = true;
        } else {
            this.grid[r][c].active = !this.grid[r][c].active;
        }
        

        const colorIdx = document.getElementById("colorSelect").value;
        this.grid[r][c].color = this.colorMap[colorIdx] || "#FFA500";
        
        this.drawGrid();
    }
   },
    placePattern: function(p, x, y) {
        const pattern = this.patterns[p]; if (!pattern) return;
        const r0 = Math.floor(y / this.cellSize), c0 = Math.floor(x / this.cellSize);
        pattern.forEach((row, i) => row.forEach((val, j) => {
            if (val && this.grid[r0+i]) this.grid[r0+i][c0+j] = { active: true, color: this.colorMap[document.getElementById("colorSelect").value] };
        }));
        this.drawGrid();
    },
    startSimulation: function() { 
	document.getElementById("gridCA").style.display = "block";
	    document.getElementById("gridMath").style.display = "none";
	    document.getElementById("threeDContainer").style.display = "none";
	    
	    this.running = true; 
	    const loop = (ts) => { 
	        if(!this.running) return; 
	        if(ts - this.lastUpdate > this.interval) { this.updateGrid(); this.lastUpdate = ts; }
	        requestAnimationFrame(loop);
	    };
	    requestAnimationFrame(loop);
    },
    stopSimulation: function() { this.running = false; },
    clearGrid: function() { this.resizeToWindow(); this.drawGrid(); },
    updateSpeed: function(v) { this.speed = parseFloat(v); this.updateInterval(); },
    updateCellZoom: function(v) { this.cellSize = Math.max(5, Math.round(10 * v)); this.resizeToWindow(); this.drawGrid(); }
};