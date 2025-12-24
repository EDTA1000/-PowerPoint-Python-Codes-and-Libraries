var State = { 
    zoomX: 1, 
    zoomY: 1, 
    DEFAULT_SCALE: 50 
};

var renderer, scene, camera, controls, currentSurfaceMesh = null;

const MATH_THEME = {
    operators: "#ff4444", 
    sin: "#00ffcc", cos: "#00ccff", tan: "#0099ff",
    cot: "#3366ff", sec: "#33ccff", csc: "#33ffff",
    asin: "#00ffaa", acos: "#00aaff", atan: "#0055ff",
    sinh: "#ff5500", cosh: "#ff8800", tanh: "#ffaa00",
    log: "#ffcc00", ln: "#ff9900", exp: "#ffbb33",
    sqrt: "#ccff00", root: "#aaff00",
    gamma: "#ff00ff", 
    erf: "#cc00ff", erfc: "#9900ff",
    sgn: "#ffffff", sign: "#ffffff",
    abs: "#ffffff",
    integral: "#00ff00", 
    diff: "#ff0055",     
    laplace: "#00aaff",  
    sum: "#ffff00",      
    product: "#ffaa00",  
    default_fn: "#55ff55" 
};

function universalCleaner(raw) {
    if (!raw) return "";
    let clean = raw.replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi')
                   .replace(/√/g, 'sqrt').replace(/Γ/g, 'gamma').replace(/φ/g, '1.6180339887');
    if (clean.includes('∑')) {
        clean = clean.replace(/∑\((.+?),(.+?),(.+?),(.+?)\)/g, "sum($1, $2, $3, $4)");
    }
    if (clean.includes('∏')) {
        clean = clean.replace(/∏\((.+?),(.+?),(.+?),(.+?)\)/g, "product($1, $2, $3, $4)");
    }
    clean = clean.replace(/\bsgn\((.+?)\)/g, "(($1)/abs($1))");
    clean = clean.replace(/log(\d+)\((.+?)\)/g, "(log($2)/log($1))");
    clean = clean.replace(/\bln\(/g, "log(");
    return clean;
}

function getColoredMathHtml(text) {
    let html = text.replace(/([\+\-\^=\(\)×÷∫∑∏∇√])/g, `<span style="color:${MATH_THEME.operators}">$1</span>`);
    html = html.replace(/\b([a-zA-Z0-9_]+)\b/g, (match) => {
        const lowerMatch = match.toLowerCase();
        if (MATH_THEME[lowerMatch]) return `<span style="color:${MATH_THEME[lowerMatch]}">${match}</span>`;
        if (lowerMatch.startsWith('log') && lowerMatch.length > 3) {
            let base = lowerMatch.substring(3);
            return `<span style="color:${MATH_THEME.log}">log</span><sub style="color:${MATH_THEME.operators}">${base}</sub>`;
        }
        return match;
    });
    html = html.replace(/Γ/g, `<span style="color:${MATH_THEME.gamma}">Γ</span>`);
    html = html.replace(/∇²/g, `<span style="color:${MATH_THEME.laplace}">∇²</span>`);
    return html;
}

function transformInput(inputElement) {
    let v = inputElement.value;
    v = v.replace(/\b(int|integral|انتگرال)\b/gi, "∫");
    v = v.replace(/\b(diff|derivative|مشتق)\b/gi, "d/dx");
    v = v.replace(/\bgamma\b/gi, "Γ");
    v = v.replace(/\blaplace\b/gi, "∇²");
    v = v.replace(/\b(جمع|∑)\b/gi, "sum");
    v = v.replace(/\b(prod|ضرب|∏)\b/gi, "product");
    v = v.replace(/\*/g, "×");
    v = v.replace(/\//g, "÷");
    if (inputElement.value !== v) inputElement.value = v;
}

var MathLab = {
    insertSymbol: function(s) {
        document.getElementById("octExpr").value += s;
        renderMath();
    },
    insertOp: function(op) {
        document.getElementById("octExpr").value += op;
        renderMath();
    },
    runOp: function(opName) {
        let input = document.getElementById("octExpr");
        input.value = opName + "(" + (input.value || "x") + ")";
        renderMath();
    },
    insertMatrix: function() {
        var rows = prompt("تعداد سطرهای ماتریس را وارد کنید/Enter the number of rows of the matrix:", "2");
        var cols = prompt("تعداد ستون‌های ماتریس را وارد کنید/Enter the number of columns in the matrix:", "2");
        if (rows && cols) {
            let m = "matrix(" + Array.from({length: rows}, () => "[" + Array(parseInt(cols)).fill(0).join(",") + "]").join(",") + ")";
            document.getElementById("octExpr").value += m;
            renderMath();
        }
    },
    insertRadical: function() {
        var base = prompt("فرجه رادیکال را وارد کنید (برای رادیکال معمولی خالی بگذارید یا 2 بنویسید)/Enter the radical term (leave blank or enter 2 for a regular radical)", "2");
        var expr = document.getElementById("octExpr");
        if (!base || base === "2") expr.value += "sqrt(";
        else expr.value += "(" + base + ")root(";
        renderMath();
    },
    insertComplexOp: function(type) {
        var input = document.getElementById("octExpr");
        if (type === 'logN') {
            var base = prompt("پپایه لگاریتم را وارد کنید/Enter the base of the logarithm:", "2");
            if (base) input.value += "log" + base + "(";
        } 
        else if (type === 'int') {
            var low = prompt("کران پایین انتگرال/Lower bound of the integral:", "0"), up = prompt("کران بالا انتگرال/Upper bound of the integral:", "1"), f = prompt("تابع مورد نظر/Desired function:", "x^2");
            if (f) input.value = `defint(${f}, ${low}, ${up}, x)`;
        }
        else if (type === 'sum' || type === 'prod') {
            var v = prompt("متغیر/Variable:", "k"), s = prompt("شروع از/Starting from:", "1"), e = prompt("پپایان در/End in:", "10");
            input.value = (type === 'sum' ? "sum" : "product") + `(${v}, ${v}, ${s}, ${e})`;
        }
        else if (type === 'gamma') { input.value += "Γ("; }
        else if (type === 'erfc') { input.value += "erfc("; }
        renderMath();
    }, 
	derivative: function(expr, v) {
     	   try {
               let clean = universalCleaner(expr);
     	       let result = nerdamer.diff(clean, v).toString();
     	       document.getElementById('output').innerHTML = "d/d" + v + ": " + result;
    	    } catch(e) { document.getElementById('output').innerHTML = "Error: " + e.message; }
 	   },
  	  gradient: function(expr) {
   	     try {
   	         let clean = universalCleaner(expr);
     	         let dx = nerdamer.diff(clean, 'x').toString();
     	         let dy = nerdamer.diff(clean, 'y').toString();
     	        document.getElementById('output').innerHTML = `∇f = (${dx})i + (${dy})j`;
       	      } catch(e) { document.getElementById('output').innerHTML = "Error: " + e.message; }
   	  },
    	laplacian: function(expr) {
      	  try {
       	         let clean = universalCleaner(expr);
          	 let d2x = nerdamer.diff(nerdamer.diff(clean, 'x'), 'x').toString();
         	 let d2y = nerdamer.diff(nerdamer.diff(clean, 'y'), 'y').toString();
        	 document.getElementById('output').innerHTML = "∇²f: " + d2x + " + " + d2y;
      	       } catch(e) { document.getElementById('output').innerHTML = "Error: " + e.message; }
   	 },
    showOctonion: function() {
        const expr = document.getElementById("octExpr").value.replace(/\s+/g, '');
        const output = document.getElementById("output");
        const fano = [[1, 2, 3], [1, 4, 5], [1, 7, 6], [2, 4, 6], [2, 5, 7], [3, 4, 7], [3, 6, 5]];
        const match = expr.match(/e([1-7])\*e([1-7])/);
        
        if (match) {
            const i = parseInt(match[1]), j = parseInt(match[2]);
            if (i === j) { output.innerHTML = "Result: -1"; return; }
            for (let trio of fano) {
                if (trio.includes(i) && trio.includes(j)) {
                    const k = trio.find(x => x !== i && x !== j);
                    const isPositive = (trio.indexOf(i) + 1) % 3 === trio.indexOf(j);
                    output.innerHTML = "Result: " + (isPositive ? "" : "-") + "e" + k;
                    return;
                }
            }
        } else { output.innerHTML = "عبارت دارای واحد های اوکتنیونی نیست!؟/Bart doesn't have octenionic units!?"; }
    },
    updateChartZoom: function(val) {
        State.zoomX = State.zoomY = parseFloat(val);
        this.draw2DOrPolarOrImplicit();
    },
    prepareCanvas: function() {
        var mathCanvas = document.getElementById("gridMath");
        mathCanvas.style.display = "block";
        document.getElementById("threeDContainer").style.display = "none";
        this.drawAxes();
        return mathCanvas.getContext("2d");
    },
    drawAxes: function() {
        var canvas = document.getElementById("gridMath");
        var ctx = canvas.getContext("2d"), cx = canvas.width / 2, cy = canvas.height / 2;
        var sx = State.DEFAULT_SCALE * State.zoomX, sy = State.DEFAULT_SCALE * State.zoomY;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1a1a1a"; ctx.beginPath();
        for (var x = cx % sx; x < canvas.width; x += sx) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        for (var y = cy % sy; y < canvas.height; y += sy) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        ctx.stroke();
        ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
    },
    draw2DOrPolarOrImplicit: function() {
       document.getElementById("gridMath").style.display = "block";
       document.getElementById("gridCA").style.display = "none";
       document.getElementById("threeDContainer").style.display = "none";
       if (window.CA_Controller) CA_Controller.stopSimulation();
        var ctx = this.prepareCanvas();
        var expr = document.getElementById("octExpr").value;
        if (!expr) return;
        let calcExpr = universalCleaner(expr);
        if (calcExpr.includes('r=')) this.executePolar(ctx, calcExpr);
        else if (calcExpr.includes('=') && !calcExpr.startsWith('y=')) this.executeImplicit(ctx, calcExpr);
        else this.executeStandard(ctx, calcExpr);
    },
    executeStandard: function(ctx, expr) {
        var canvas = document.getElementById("gridMath"), cx = canvas.width/2, cy = canvas.height/2;
        var sx = State.DEFAULT_SCALE * State.zoomX, sy = State.DEFAULT_SCALE * State.zoomY;
        var f = makeEvaluator(expr, 'x');
        ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 2; ctx.beginPath();
        for (var px = 0; px < canvas.width; px++) {
            var x = (px - cx) / sx;
            try { 
                var y = f(x); 
                var py = cy - y * sy; 
                if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); 
            } catch(e) {}
        }
        ctx.stroke();
    },
    executePolar: function(ctx, expr) {
        var canvas = document.getElementById("gridMath"), cx = canvas.width / 2, cy = canvas.height / 2;
        let f = makeEvaluator(expr.split('=')[1], 'theta'), scale = State.DEFAULT_SCALE * State.zoomX;
        ctx.strokeStyle = "#00ffcc"; ctx.beginPath();
        for (let t = 0; t <= Math.PI * 4; t += 0.02) {
            let r = f(t), x = r * Math.cos(t) * scale, y = r * Math.sin(t) * scale;
            if (t === 0) ctx.moveTo(cx + x, cy - y); else ctx.lineTo(cx + x, cy - y);
        }
        ctx.stroke();
    },
    executeImplicit: function(ctx, expr) {
        var canvas = document.getElementById("gridMath"), cx = canvas.width / 2, cy = canvas.height / 2;
        let sides = expr.split('='), f = makeEvaluator(`(${sides[0]}) - (${sides[1]})`, 'x,y'), scale = State.DEFAULT_SCALE * State.zoomX;
        ctx.fillStyle = "#ff4444";
        for (let i = 0; i < canvas.width; i += 4) {
            for (let j = 0; j < canvas.height; j += 4) {
                if (Math.abs(f((i-cx)/scale, (cy-j)/scale)) < 0.1) ctx.fillRect(i, j, 2, 2);
            }
        }
    },
    draw3DPlot: function() {
       const container = document.getElementById("threeDContainer");
       container.style.display = "block";
       document.getElementById("gridMath").style.display = "none";
       document.getElementById("gridCA").style.display = "none";
       if (window.CA_Controller) CA_Controller.stopSimulation();
       
        var expr = document.getElementById("octExpr").value;
        if (!expr) return;
        
        if (!renderer) {
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(800, 600);
            container.appendChild(renderer.domElement);
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(45, 800/600, 0.1, 1000);
            camera.position.set(12, 12, 12);
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            scene.add(new THREE.GridHelper(20, 20, 0x444444, 0x222222));
        }
        
        if (currentSurfaceMesh) scene.remove(currentSurfaceMesh);
        let finalExpr = universalCleaner(expr.includes('=') ? expr.split('=')[1] : expr);
        let f = makeEvaluator(finalExpr, 'x,y');
        
    var geometry = new THREE.ParametricBufferGeometry((u, v, target) => {
    	var x = (u - 0.5) * 15;
    	var y = (v - 0.5) * 15;
    	var z = 0;
    	try { 
     	   z = f(x, y); 
     	   if(isNaN(z) || !isFinite(z)) {
       	     z = undefined; 
       	 }
	    } catch(e) { z = undefined; }
	    
	    if (z === undefined) {
	        target.set(x, -999999, y); 
	    } else {
	        target.set(x, z, y);
	    }
	}, 60, 60);
        
        currentSurfaceMesh = new THREE.Mesh(geometry, new THREE.MeshNormalMaterial({ side: THREE.DoubleSide, wireframe: true }));
        scene.add(currentSurfaceMesh);
        
        const animate = () => { 
            if (container.style.display === "block") { 
                requestAnimationFrame(animate); 
                controls.update(); 
                renderer.render(scene, camera); 
            } 
        };
        animate();
    }
};

function makeEvaluator(expr, vars) {
try {
        let s = universalCleaner(expr);
        let vList = vars.split(',');
        if (!vList.includes('z')) vList.push('z');
        return nerdamer(s).buildFunction(vList);
    } catch (e) { return () => 0; }
}

var MathLabOps = {
    evalExpr: function(expr) {
        try {
            let clean = universalCleaner(expr);
            let result = nerdamer(clean).evaluate().toString();
            document.getElementById('output').innerHTML = "Result: " + result;
        } catch(e) { document.getElementById('output').innerHTML = "Error: " + e.message; }
    },
    integrateIndefinite: function(expr, v) {
        try {
            let clean = universalCleaner(expr);
            let result = nerdamer.integrate(clean, v).toString();
            document.getElementById('output').innerHTML = "Integral: " + result;
        } catch(e) { document.getElementById('output').innerHTML = "Error: " + e.message; }
    }
};