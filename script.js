// Football Pitch Interactive xG Calculator
class XGCalculator {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.createZones();
        this.updateDisplay();
        this.throttledUpdateLiveXG(); // Initial xG calculation
        this.checkApiStatus(); // Check if API is available
    }

    initializeElements() {
        // Players
        this.shotPlayer = document.getElementById('shot-player');
        this.goalkeeper = document.getElementById('goalkeeper');
        this.defenders = document.querySelectorAll('.defender');

        // UI Elements
        this.shotPosition = document.getElementById('shot-position');
        this.gkPosition = document.getElementById('gk-position');
        this.defenderCount = document.getElementById('defender-count');
        this.xgDisplay = document.getElementById('xg-display');

        // Controls
        this.clearDefendersBtn = document.getElementById('clear-defenders');
        this.resetAllBtn = document.getElementById('reset-all');
        this.removeLastBtn = document.getElementById('remove-last');
        this.addDefenderBtn = document.getElementById('add-defender');
        this.calculateBtn = document.getElementById('calculate-xg');

        // Modal
        this.showDetailsBtn = document.getElementById('show-details');
        this.detailsModal = document.getElementById('details-modal');
        this.closeDetailsBtn = document.getElementById('close-details');

        // Chapter Modal
        this.showChapterBtn = document.getElementById('show-chapter');
        this.chapterModal = document.getElementById('chapter-modal');
        this.closeChapterBtn = document.getElementById('close-chapter');

        // Explain Modal
        this.showExplainBtn = document.getElementById('show-explain');
        this.explainModal = document.getElementById('explain-modal');
        this.closeExplainBtn = document.getElementById('close-explain');

        // Game Data Upload
        this.uploadGameDataInput = document.getElementById('upload-game-data');
        this.analyzeShotsBtn = document.getElementById('analyze-shots');
        this.nextShotBtnMain = document.getElementById('next-shot-main');
        this.prevShotBtnMain = document.getElementById('prev-shot-main');
        this.shotAnalysisModal = document.getElementById('shot-analysis-modal');
        this.closeShotAnalysisBtn = document.getElementById('close-shot-analysis');
        this.gameData = null;
        this.currentShotIndex = 0;
        this.teamXGData = null; // Store team xG values

        // Sliders
        this.shotXSlider = document.getElementById('shot-x-slider');
        this.shotYSlider = document.getElementById('shot-y-slider');
        this.gkXSlider = document.getElementById('gk-x-slider');
        this.gkYSlider = document.getElementById('gk-y-slider');
        
        // Values
        this.shotXValue = document.getElementById('shot-x-value');
        this.shotYValue = document.getElementById('shot-y-value');
        this.gkXValue = document.getElementById('gk-x-value');
        this.gkYValue = document.getElementById('gk-y-value');
        
        // Target goal
        this.targetGoalInputs = document.querySelectorAll('input[name="target"]');
        
        // API settings
        this.apiUrlInput = document.getElementById('api-url');
        this.apiStatus = document.getElementById('api-status');
        
        // Retrain model
        this.retrainBtn = document.getElementById('retrain-model');
        this.trainingStatus = document.getElementById('training-status');
        
        // Pitch
        this.pitch = document.getElementById('football-pitch');
        this.rightGoal = document.getElementById('right-goal');
        this.leftGoal = document.getElementById('left-goal');
        
        // Track current goal target to prevent double inversion
        this.currentTarget = 'right';
        
        // Current positions (scaled to SVG coordinates - now using transform translate values)
        // START WITH NO DEFENDERS - just shot and goalkeeper
        this.positions = {
            shot: { x: 900, y: 340 },  // Penalty spot area
            gk: { x: 1040, y: 340 },   // Goalkeeper on line
            defenders: []  // Start with NO defenders - add them as needed
        };
        
        this.isDragging = false;
        this.dragElement = null;
        this.dragOffset = { x: 0, y: 0 };
        
        // Throttling for API calls during drag
        this.lastApiCall = 0;
        this.apiCallDelay = 300; // 300ms delay between API calls
        this.pendingApiCall = null;
    }

    setupEventListeners() {
        // Button controls
        this.clearDefendersBtn.addEventListener('click', () => this.clearDefenders());
        this.resetAllBtn.addEventListener('click', () => this.resetAll());
        this.removeLastBtn.addEventListener('click', () => this.removeLastDefender());
        this.addDefenderBtn.addEventListener('click', () => this.addDefender());
        if (this.calculateBtn) this.calculateBtn.addEventListener('click', () => this.calculateXG());
        
        // Sliders (optional - may not exist in all layouts)
        if (this.shotXSlider) this.shotXSlider.addEventListener('input', (e) => this.updateFromSlider('shot', 'x', e.target.value));
        if (this.shotYSlider) this.shotYSlider.addEventListener('input', (e) => this.updateFromSlider('shot', 'y', e.target.value));
        if (this.gkXSlider) this.gkXSlider.addEventListener('input', (e) => this.updateFromSlider('gk', 'x', e.target.value));
        if (this.gkYSlider) this.gkYSlider.addEventListener('input', (e) => this.updateFromSlider('gk', 'y', e.target.value));

        // Target goal change
        this.targetGoalInputs.forEach(input => {
            input.addEventListener('change', () => this.updateTargetGoal());
        });

        // API URL change (optional)
        if (this.apiUrlInput) this.apiUrlInput.addEventListener('change', () => this.checkApiStatus());

        // Retrain model (optional)
        if (this.retrainBtn) this.retrainBtn.addEventListener('click', () => this.retrainModel());

        // Double click to add defender
        this.pitch.addEventListener('dblclick', (e) => this.addDefenderAtPosition(e));

        // Modal controls (Model Details removed from this build)
        if (this.showDetailsBtn && this.detailsModal) {
            this.showDetailsBtn?.addEventListener('click', () => this.showDetailsModal());
            this.closeDetailsBtn?.addEventListener('click', () => this.closeDetailsModal());
            this.detailsModal?.addEventListener('click', (e) => {
                if (e.target === this.detailsModal) {
                    this.closeDetailsModal();
                }
            });
        }

        // Chapter Modal controls
        this.showChapterBtn?.addEventListener('click', () => this.showChapterModal());
        this.closeChapterBtn?.addEventListener('click', () => this.closeChapterModal());

        // Physics Chapter Modal controls
        this.showPhysicsChapterBtn = document.getElementById('show-physics-chapter');
        this.physicsChapterModal = document.getElementById('physics-chapter-modal');
        this.closePhysicsChapterBtn = document.getElementById('close-physics-chapter');

        if (this.showPhysicsChapterBtn) {
            this.showPhysicsChapterBtn?.addEventListener('click', () => this.showPhysicsChapterModal());
        }
        if (this.closePhysicsChapterBtn) {
            this.closePhysicsChapterBtn?.addEventListener('click', () => this.closePhysicsChapterModal());
        }

        // Close chapter modal when clicking outside
        this.chapterModal?.addEventListener('click', (e) => {
            if (e.target === this.chapterModal) {
                this.closeChapterModal();
            }
        });

        // Close physics chapter modal when clicking outside
        if (this.physicsChapterModal) {
            this.physicsChapterModal?.addEventListener('click', (e) => {
                if (e.target === this.physicsChapterModal) {
                    this.closePhysicsChapterModal();
                }
            });
        }

        // Download chapter buttons
        const downloadGeometryBtn = document.getElementById('download-geometry-chapter');
        if (downloadGeometryBtn) {
            downloadGeometryBtn.addEventListener('click', () => this.downloadChapter('geometry'));
        }
        const downloadPhysicsBtn = document.getElementById('download-physics-chapter');
        if (downloadPhysicsBtn) {
            downloadPhysicsBtn.addEventListener('click', () => this.downloadChapter('physics'));
        }

        // Explain Modal controls (Explain Scenario removed from this build)
        if (this.showExplainBtn && this.explainModal) {
            this.showExplainBtn?.addEventListener('click', () => this.showExplainModal());
            this.closeExplainBtn?.addEventListener('click', () => this.closeExplainModal());
            this.explainModal?.addEventListener('click', (e) => {
                if (e.target === this.explainModal) {
                    this.closeExplainModal();
                }
            });
        }

        // Game Data Upload controls
        this.uploadGameDataInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.analyzeShotsBtn.addEventListener('click', () => this.showShotAnalysisModal());
        this.nextShotBtnMain.addEventListener('click', () => this.navigateShot(1));
        this.prevShotBtnMain.addEventListener('click', () => this.navigateShot(-1));
        this.closeShotAnalysisBtn.addEventListener('click', () => this.closeShotAnalysisModal());

        // Close shot analysis modal when clicking outside
        this.shotAnalysisModal.addEventListener('click', (e) => {
            if (e.target === this.shotAnalysisModal) {
                this.closeShotAnalysisModal();
            }
        });

        // Add keyboard shortcuts for shot navigation
        document.addEventListener('keydown', (e) => {
            // Only handle arrow keys when shot analysis modal is open
            if (this.shotAnalysisModal.style.display === 'block' && this.gameData) {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigateShot(1); // Next shot
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigateShot(-1); // Previous shot
                }
            }
        });

        // Add event listeners for shot parameter changes
        document.getElementById('body-part').addEventListener('change', () => this.throttledUpdateLiveXG());
        document.getElementById('shot-type').addEventListener('change', () => this.throttledUpdateLiveXG());
        document.getElementById('situation').addEventListener('change', (e) => {
            this.handleSituationChange(e.target.value);
            this.throttledUpdateLiveXG();
        });
        document.getElementById('previous-action').addEventListener('change', () => this.throttledUpdateLiveXG());
        document.getElementById('player-position').addEventListener('change', () => this.throttledUpdateLiveXG());

        // Match time slider
        const matchTimeInput = document.getElementById('match-time');
        const matchTimeValue = document.getElementById('match-time-value');
        if (matchTimeInput) {
            matchTimeInput.addEventListener('input', (e) => {
                if (matchTimeValue) matchTimeValue.textContent = e.target.value;
                this.throttledUpdateLiveXG();
            });
        }

        // Shot quality sliders
        document.getElementById('shot-power').addEventListener('input', (e) => {
            document.getElementById('shot-power-value').textContent = e.target.value;
            this.throttledUpdateLiveXG();
        });
        document.getElementById('shot-placement').addEventListener('input', (e) => {
            document.getElementById('shot-placement-value').textContent = e.target.value;
            this.throttledUpdateLiveXG();
        });

        // NEW: Game state and checkboxes
        document.getElementById('score-diff').addEventListener('change', () => this.throttledUpdateLiveXG());
        document.getElementById('first-touch').addEventListener('change', () => this.throttledUpdateLiveXG());
        document.getElementById('under-pressure').addEventListener('change', () => this.throttledUpdateLiveXG());
    }

    setupDragAndDrop() {
        const players = document.querySelectorAll('.draggable');
        
        players.forEach(player => {
            player.addEventListener('mousedown', (e) => this.startDrag(e, player));
        });
        
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());
        
        // Touch events for mobile
        players.forEach(player => {
            player.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                this.startDrag({clientX: touch.clientX, clientY: touch.clientY}, player);
            });
        });
        
        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                const touch = e.touches[0];
                this.drag({clientX: touch.clientX, clientY: touch.clientY});
            }
        });
        
        document.addEventListener('touchend', () => this.endDrag());
    }

    startDrag(e, element) {
        this.isDragging = true;
        this.dragElement = element;
        element.classList.add('dragging');
        
        const rect = this.pitch.getBoundingClientRect();
        const svgPoint = this.getSVGPoint(e.clientX, e.clientY);
        
        this.dragOffset.x = svgPoint.x - parseFloat(element.getAttribute('cx'));
        this.dragOffset.y = svgPoint.y - parseFloat(element.getAttribute('cy'));
    }

    drag(e) {
        if (!this.isDragging || !this.dragElement) return;
        
        const svgPoint = this.getSVGPoint(e.clientX, e.clientY);
        let newX = svgPoint.x - this.dragOffset.x;
        let newY = svgPoint.y - this.dragOffset.y;
        
        // Constrain to pitch boundaries
        newX = Math.max(10, Math.min(1040, newX));
        newY = Math.max(10, Math.min(670, newY));
        
        this.dragElement.setAttribute('cx', newX);
        this.dragElement.setAttribute('cy', newY);
        
        this.updatePositionFromElement(this.dragElement, newX, newY);
        this.updateDisplay();
        this.throttledUpdateLiveXG();
    }

    endDrag() {
        if (this.dragElement) {
            this.dragElement.classList.remove('dragging');
            this.dragElement = null;
        }
        this.isDragging = false;
        // Update Voronoi after drag ends (if visible)
        this.updateVoronoiIfVisible();
    }

    getSVGPoint(clientX, clientY) {
        const rect = this.pitch.getBoundingClientRect();
        const scaleX = 1050 / rect.width;
        const scaleY = 680 / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    updatePositionFromElement(element, x, y) {
        const type = element.dataset.type;
        
        if (type === 'shot') {
            this.positions.shot = { x, y };
        } else if (type === 'gk') {
            this.positions.gk = { x, y };
        } else if (type === 'defender') {
            const defenderIndex = Array.from(this.defenders).indexOf(element);
            if (defenderIndex >= 0) {
                this.positions.defenders[defenderIndex] = { x, y };
            }
        }
    }

    updateFromSlider(playerType, axis, value) {
        const scaledValue = axis === 'x' ? value * 10 : value * 10; // Scale to SVG coordinates

        if (playerType === 'shot') {
            this.positions.shot[axis] = scaledValue;
            this.shotPlayer.setAttribute(axis === 'x' ? 'cx' : 'cy', scaledValue);
        } else if (playerType === 'gk') {
            this.positions.gk[axis] = scaledValue;
            this.goalkeeper.setAttribute(axis === 'x' ? 'cx' : 'cy', scaledValue);
        }

        this.updateDisplay();
        this.throttledUpdateLiveXG();
        this.updateVoronoiIfVisible();
    }

    clearDefenders() {
        this.defenders.forEach(defender => defender.remove());
        this.positions.defenders = [];
        this.defenders = document.querySelectorAll('.defender');
        this.updateDisplay();
        this.throttledUpdateLiveXG();
        this.updateVoronoiIfVisible();
    }

    resetAll() {
        // Get current target goal
        const targetGoal = document.querySelector('input[name="target"]:checked').value;

        // Reset to default positions based on target goal - NO DEFENDERS
        if (targetGoal === 'right') {
            this.positions = {
                shot: { x: 900, y: 340 },  // Penalty spot area
                gk: { x: 1040, y: 340 },   // Goalkeeper on line
                defenders: []  // Reset with NO defenders
            };
        } else {
            this.positions = {
                shot: { x: 150, y: 340 },  // Penalty spot area (left side)
                gk: { x: 10, y: 340 },     // Goalkeeper on line (left side)
                defenders: []  // Reset with NO defenders
            };
        }

        // Update DOM elements
        this.shotPlayer.setAttribute('cx', this.positions.shot.x);
        this.shotPlayer.setAttribute('cy', this.positions.shot.y);
        this.goalkeeper.setAttribute('cx', this.positions.gk.x);
        this.goalkeeper.setAttribute('cy', this.positions.gk.y);

        // Clear existing defenders
        this.clearDefenders();

        // Add default defenders
        this.positions.defenders.forEach((pos, index) => {
            this.createDefender(pos.x, pos.y);
        });

        this.updateDisplay();
        this.throttledUpdateLiveXG();
        this.updateVoronoiIfVisible();
    }

    removeLastDefender() {
        if (this.positions.defenders.length > 0) {
            this.positions.defenders.pop();
            const defenders = document.querySelectorAll('.defender');
            if (defenders.length > 0) {
                defenders[defenders.length - 1].remove();
            }
            this.defenders = document.querySelectorAll('.defender');
            this.updateDisplay();
            this.throttledUpdateLiveXG();
            this.updateVoronoiIfVisible();
        }
    }

    addDefender() {
        // Add defender at a default position based on target goal
        const targetGoal = document.querySelector('input[name="target"]:checked').value;
        let newX, newY;

        if (targetGoal === 'right') {
            newX = 900 + Math.random() * 100;
            newY = 300 + Math.random() * 80;
        } else {
            // Left goal - position defenders on left side
            newX = 50 + Math.random() * 100;
            newY = 300 + Math.random() * 80;
        }

        this.createDefender(newX, newY);
        this.positions.defenders.push({ x: newX, y: newY });
        this.updateDisplay();
        this.throttledUpdateLiveXG();
        this.updateVoronoiIfVisible();
    }

    addDefenderAtPosition(e) {
        const svgPoint = this.getSVGPoint(e.clientX, e.clientY);
        this.createDefender(svgPoint.x, svgPoint.y);
        this.positions.defenders.push({ x: svgPoint.x, y: svgPoint.y });
        this.updateDisplay();
        this.throttledUpdateLiveXG();
        this.updateVoronoiIfVisible();
    }

    createDefender(x, y) {
        const defender = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        defender.setAttribute('cx', x);
        defender.setAttribute('cy', y);
        defender.setAttribute('r', 8);
        defender.setAttribute('fill', 'blue');
        defender.setAttribute('stroke', 'white');
        defender.setAttribute('stroke-width', 2);
        defender.classList.add('defender', 'draggable', 'player');
        defender.dataset.type = 'defender';
        
        this.pitch.appendChild(defender);
        
        // Add drag functionality
        defender.addEventListener('mousedown', (e) => this.startDrag(e, defender));
        defender.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrag({clientX: touch.clientX, clientY: touch.clientY}, defender);
        });
        
        this.defenders = document.querySelectorAll('.defender');
    }

    updateTargetGoal() {
        const target = document.querySelector('input[name="target"]:checked').value;

        // Only invert if target actually changed
        if (target !== this.currentTarget) {
            if (target === 'left') {
                // Switch to left goal - invert all positions horizontally
                this.invertPositionsHorizontally();
                this.invertZones();

                // Update goal styling
                this.leftGoal.setAttribute('stroke', 'red');
                this.leftGoal.setAttribute('stroke-width', '8');
                this.leftGoal.setAttribute('fill', 'yellow');
                this.rightGoal.setAttribute('stroke', 'black');
                this.rightGoal.setAttribute('stroke-width', '4');
                this.rightGoal.setAttribute('fill', 'white');
            } else {
                // Switch to right goal - invert back from left goal positions
                this.invertPositionsHorizontally();
                this.invertZones();

                // Update goal styling
                this.rightGoal.setAttribute('stroke', 'red');
                this.rightGoal.setAttribute('stroke-width', '8');
                this.rightGoal.setAttribute('fill', 'yellow');
                this.leftGoal.setAttribute('stroke', 'black');
                this.leftGoal.setAttribute('stroke-width', '4');
                this.leftGoal.setAttribute('fill', 'white');
            }

            this.currentTarget = target;

            // Update visual positions after coordinate change
            this.updatePlayerPositions();

            // If penalty is selected, reposition to correct penalty spot
            const situation = document.getElementById('situation').value;
            if (situation === 'Penalty') {
                this.handleSituationChange('Penalty');
            }

            this.updateDisplay();
            // Update Voronoi after goal switch
            this.updateVoronoiIfVisible();
        }

        this.throttledUpdateLiveXG();
    }

    updatePlayerPositions() {
        // Update shot player position
        this.shotPlayer.setAttribute('cx', this.positions.shot.x);
        this.shotPlayer.setAttribute('cy', this.positions.shot.y);
        
        // Update goalkeeper position
        this.goalkeeper.setAttribute('cx', this.positions.gk.x);
        this.goalkeeper.setAttribute('cy', this.positions.gk.y);
        
        // Update all defender positions
        const defenderElements = document.querySelectorAll('.defender');
        this.positions.defenders.forEach((pos, index) => {
            if (defenderElements[index]) {
                defenderElements[index].setAttribute('cx', pos.x);
                defenderElements[index].setAttribute('cy', pos.y);
            }
        });
    }

    invertPositionsHorizontally() {
        // Invert X coordinates (mirror horizontally across pitch center)
        this.positions.shot.x = 1050 - this.positions.shot.x;
        this.positions.gk.x = 1050 - this.positions.gk.x;
        
        this.positions.defenders.forEach(defender => {
            defender.x = 1050 - defender.x;
        });
    }

    invertZones() {
        // Find all zone elements and invert their X positions
        const zones = this.pitch.querySelectorAll('.pitch-zone');
        zones.forEach(zone => {
            const currentX = parseFloat(zone.getAttribute('x'));
            const width = parseFloat(zone.getAttribute('width'));
            const newX = 1050 - currentX - width;
            zone.setAttribute('x', newX);
        });
    }

    updateDisplay() {
        // Convert SVG coordinates to field coordinates (0-105, 0-68)
        const shotX = Math.round(this.positions.shot.x / 10);
        const shotY = Math.round(this.positions.shot.y / 10);
        const gkX = Math.round(this.positions.gk.x / 10);
        const gkY = Math.round(this.positions.gk.y / 10);

        this.shotPosition.textContent = `(${shotX}, ${shotY})`;
        this.gkPosition.textContent = `(${gkX}, ${gkY})`;
        this.defenderCount.textContent = this.positions.defenders.length;

        // Update slider values (if sliders exist)
        if (this.shotXSlider) this.shotXSlider.value = shotX;
        if (this.shotYSlider) this.shotYSlider.value = shotY;
        if (this.gkXSlider) this.gkXSlider.value = gkX;
        if (this.gkYSlider) this.gkYSlider.value = gkY;

        if (this.shotXValue) this.shotXValue.textContent = shotX;
        if (this.shotYValue) this.shotYValue.textContent = shotY;
        if (this.gkXValue) this.gkXValue.textContent = gkX;
        if (this.gkYValue) this.gkYValue.textContent = gkY;

        // Update angle visualization
        this.updateAngleVisualization();
    }

    updateAngleVisualization() {
        // Remove existing angle lines and shot analysis
        const existingLines = this.pitch.querySelectorAll('.angle-line, .angle-text, .shot-trajectory, .shot-corridor, .defender-highlight, .blocking-label');
        existingLines.forEach(line => line.remove());

        // Get current target goal
        const targetGoal = document.querySelector('input[name="target"]:checked').value;

        // Goal positions
        let goalX, goalTop, goalBottom, goalCenterY;
        if (targetGoal === 'right') {
            goalX = 1050;
            goalTop = 306.6;  // (34 - 3.66) * 10 = 303.4 in SVG
            goalBottom = 373.4;  // (34 + 3.66) * 10 = 373.4 in SVG
            goalCenterY = 340;
        } else {
            goalX = 0;
            goalTop = 306.6;
            goalBottom = 373.4;
            goalCenterY = 340;
        }

        // Draw shot corridor (cone from shooter to goal)
        const corridorWidth = 40; // Width of the corridor at shooter position
        const topCorridorY = this.positions.shot.y - corridorWidth;
        const bottomCorridorY = this.positions.shot.y + corridorWidth;

        const corridorPath = `M ${this.positions.shot.x},${topCorridorY} L ${goalX},${goalTop} L ${goalX},${goalBottom} L ${this.positions.shot.x},${bottomCorridorY} Z`;
        const corridor = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        corridor.setAttribute('d', corridorPath);
        corridor.setAttribute('fill', 'rgba(255, 20, 147, 0.2)');
        corridor.setAttribute('stroke', 'rgba(255, 0, 255, 0.7)');
        corridor.setAttribute('stroke-width', '2');
        corridor.setAttribute('stroke-dasharray', '10,5');
        corridor.classList.add('shot-corridor');
        this.pitch.insertBefore(corridor, this.pitch.querySelector('.player'));

        // Draw main shot trajectory line (to goal center)
        const trajectoryLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        trajectoryLine.setAttribute('x1', this.positions.shot.x);
        trajectoryLine.setAttribute('y1', this.positions.shot.y);
        trajectoryLine.setAttribute('x2', goalX);
        trajectoryLine.setAttribute('y2', goalCenterY);
        trajectoryLine.setAttribute('stroke', 'rgba(255, 0, 0, 0.8)');
        trajectoryLine.setAttribute('stroke-width', '3');
        trajectoryLine.classList.add('shot-trajectory');
        this.pitch.insertBefore(trajectoryLine, this.pitch.querySelector('.player'));

        // Analyze defenders and calculate blocking
        const blockingAnalysis = this.analyzeDefenderBlocking(goalX, goalCenterY, goalTop, goalBottom);

        // Highlight defenders on shot line and add blocking info
        blockingAnalysis.forEach((defender, index) => {
            if (defender.onShotLine) {
                // Highlight defender with pulsing circle
                const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                highlight.setAttribute('cx', defender.x);
                highlight.setAttribute('cy', defender.y);
                highlight.setAttribute('r', 15);
                highlight.setAttribute('fill', 'none');
                highlight.setAttribute('stroke', defender.priority === 1 ? '#FF0000' : defender.priority === 2 ? '#FF00FF' : '#00FFFF');
                highlight.setAttribute('stroke-width', '3');
                highlight.setAttribute('opacity', '0.9');
                highlight.classList.add('defender-highlight');
                this.pitch.insertBefore(highlight, this.pitch.querySelector('.player'));

                // Add blocking probability label
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', defender.x);
                label.setAttribute('y', defender.y - 25);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('fill', 'white');
                label.setAttribute('font-size', '12');
                label.setAttribute('font-weight', 'bold');
                label.setAttribute('stroke', 'black');
                label.setAttribute('stroke-width', '0.5');
                label.textContent = `#${defender.priority} (${defender.blockingProbability.toFixed(0)}%)`;
                label.classList.add('blocking-label');
                this.pitch.appendChild(label);
            }
        });

        // Draw lines from shot to goal posts
        const topLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        topLine.setAttribute('x1', this.positions.shot.x);
        topLine.setAttribute('y1', this.positions.shot.y);
        topLine.setAttribute('x2', goalX);
        topLine.setAttribute('y2', goalTop);
        topLine.setAttribute('stroke', 'rgba(255, 0, 0, 0.5)');
        topLine.setAttribute('stroke-width', '2');
        topLine.setAttribute('stroke-dasharray', '5,5');
        topLine.classList.add('angle-line');

        const bottomLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        bottomLine.setAttribute('x1', this.positions.shot.x);
        bottomLine.setAttribute('y1', this.positions.shot.y);
        bottomLine.setAttribute('x2', goalX);
        bottomLine.setAttribute('y2', goalBottom);
        bottomLine.setAttribute('stroke', 'rgba(255, 0, 0, 0.5)');
        bottomLine.setAttribute('stroke-width', '2');
        bottomLine.setAttribute('stroke-dasharray', '5,5');
        bottomLine.classList.add('angle-line');

        // Insert before players so they appear below
        this.pitch.insertBefore(topLine, this.pitch.querySelector('.player'));
        this.pitch.insertBefore(bottomLine, this.pitch.querySelector('.player'));

        // Calculate and display angle
        const shotXMeters = this.positions.shot.x / 10;
        const goalXMeters = goalX / 10;
        const distance = Math.abs(goalXMeters - shotXMeters);
        const angle = Math.atan2(7.32, distance + 0.1) * (180 / Math.PI);

        // Add angle text near the shot
        const angleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        angleText.setAttribute('x', this.positions.shot.x + 20);
        angleText.setAttribute('y', this.positions.shot.y - 20);
        angleText.setAttribute('fill', 'red');
        angleText.setAttribute('font-size', '16');
        angleText.setAttribute('font-weight', 'bold');
        angleText.setAttribute('text-shadow', '1px 1px 2px rgba(0,0,0,0.5)');
        angleText.textContent = `${angle.toFixed(1)}°`;
        angleText.classList.add('angle-text');

        this.pitch.appendChild(angleText);
    }

    analyzeDefenderBlocking(goalX, goalCenterY, goalTop, goalBottom) {
        // Analyze each defender's blocking potential
        const analysis = this.positions.defenders.map((defender, index) => {
            // Calculate distance from defender to shot line
            const distanceToLine = this.pointToLineDistance(
                defender.x, defender.y,
                this.positions.shot.x, this.positions.shot.y,
                goalX, goalCenterY
            );

            // Check if defender is in the shot corridor
            const inCorridor = this.isPointInCorridor(
                defender.x, defender.y,
                this.positions.shot.x, this.positions.shot.y,
                goalX, goalTop, goalBottom
            );

            // Calculate blocking probability based on:
            // 1. Distance from shot line (closer = higher probability)
            // 2. Distance from shooter (closer = higher probability)
            // 3. Whether defender is between shooter and goal
            const distanceFromShooter = Math.sqrt(
                Math.pow(defender.x - this.positions.shot.x, 2) +
                Math.pow(defender.y - this.positions.shot.y, 2)
            );

            const distanceFromGoal = Math.sqrt(
                Math.pow(defender.x - goalX, 2) +
                Math.pow(defender.y - goalCenterY, 2)
            );

            // Defender is on shot line if in corridor and between shooter and goal
            const isBetween = (goalX > this.positions.shot.x) ?
                (defender.x > this.positions.shot.x && defender.x < goalX) :
                (defender.x < this.positions.shot.x && defender.x > goalX);

            const onShotLine = inCorridor && isBetween;

            // Calculate blocking probability (0-100%)
            let blockingProbability = 0;
            if (onShotLine) {
                // Base probability from distance to line (max 50%)
                const lineProb = Math.max(0, 50 - distanceToLine * 2);

                // Distance factor (closer to shooter = higher, max 30%)
                const distFactor = Math.max(0, 30 - distanceFromShooter / 10);

                // Position factor (optimal position between 30-60% of distance, max 20%)
                const optimalDist = distanceFromShooter + distanceFromGoal;
                const positionRatio = distanceFromShooter / optimalDist;
                const posFactor = positionRatio > 0.3 && positionRatio < 0.6 ? 20 : 10;

                blockingProbability = lineProb + distFactor + posFactor;
            }

            return {
                index,
                x: defender.x,
                y: defender.y,
                distanceToLine,
                distanceFromShooter,
                onShotLine,
                blockingProbability: Math.min(100, Math.max(0, blockingProbability)),
                priority: 0 // Will be set below
            };
        });

        // Sort by blocking probability and assign priority
        const defendersOnLine = analysis.filter(d => d.onShotLine)
            .sort((a, b) => b.blockingProbability - a.blockingProbability);

        defendersOnLine.forEach((defender, index) => {
            defender.priority = index + 1;
        });

        return analysis;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        // Calculate perpendicular distance from point (px, py) to line defined by (x1, y1) and (x2, y2)
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;

        return Math.sqrt(dx * dx + dy * dy);
    }

    isPointInCorridor(px, py, shotX, shotY, goalX, goalTop, goalBottom) {
        // Check if point is within the triangular corridor from shooter to goal
        // Using barycentric coordinates to check if point is inside triangle

        // Define corridor as polygon with 4 points
        const corridorWidth = 40;
        const topCorridorY = shotY - corridorWidth;
        const bottomCorridorY = shotY + corridorWidth;

        // Check if point is in the polygon using ray casting algorithm
        const polygon = [
            {x: shotX, y: topCorridorY},
            {x: goalX, y: goalTop},
            {x: goalX, y: goalBottom},
            {x: shotX, y: bottomCorridorY}
        ];

        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            const intersect = ((yi > py) !== (yj > py))
                && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside;
    }

    async checkApiStatus() {
        // Skip if API status elements don't exist
        if (!this.apiStatus || !this.apiUrlInput) return;

        try {
            this.apiStatus.textContent = 'API Status: Checking...';
            this.apiStatus.className = 'status-checking';

            const apiUrl = this.apiUrlInput.value.replace('/calculate_xg', '/health');

            const response = await fetch(apiUrl, {
                method: 'GET',
                timeout: 5000
            });

            if (response.ok) {
                const data = await response.json();
                if (data.model_available) {
                    const modelType = data.model_type || 'unknown';
                    this.apiStatus.textContent = `API Status: ✅ Online (${modelType} model)`;
                    this.apiStatus.className = 'status-online';
                } else {
                    this.apiStatus.textContent = 'API Status: ⚠️ Online (No Model)';
                    this.apiStatus.className = 'status-checking';
                }
            } else {
                this.apiStatus.textContent = 'API Status: ❌ Offline';
                this.apiStatus.className = 'status-offline';
            }
        } catch (error) {
            if (this.apiStatus) {
                this.apiStatus.textContent = 'API Status: ❌ Connection Failed';
                this.apiStatus.className = 'status-offline';
            }
            console.error('API status check failed:', error);
        }
    }

    async retrainModel() {
        // Skip if required elements don't exist
        if (!this.retrainBtn || !this.apiUrlInput) return;

        try {
            // Show training status
            if (this.trainingStatus) this.trainingStatus.style.display = 'flex';
            this.retrainBtn.disabled = true;
            this.retrainBtn.textContent = '⏳ Training...';

            const apiUrl = this.apiUrlInput.value.replace('/calculate_xg', '/retrain_model');

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Success
                if (this.trainingStatus) this.trainingStatus.style.display = 'none';
                this.retrainBtn.disabled = false;
                this.retrainBtn.textContent = '🔄 Retrain Model';

                // Update API status
                this.checkApiStatus();

                // Show success message briefly
                if (this.apiStatus) {
                    this.apiStatus.textContent = '✅ Model retrained successfully!';
                    this.apiStatus.className = 'status-online';
                }

                setTimeout(() => {
                    this.checkApiStatus();
                }, 3000);

            } else {
                throw new Error(data.detail || 'Training failed');
            }

        } catch (error) {
            // Error handling
            if (this.trainingStatus) this.trainingStatus.style.display = 'none';
            if (this.retrainBtn) {
                this.retrainBtn.disabled = false;
                this.retrainBtn.textContent = '🔄 Retrain Model';
            }

            if (this.apiStatus) {
                this.apiStatus.textContent = `❌ Training failed: ${error.message}`;
                this.apiStatus.className = 'status-offline';
            }

            console.error('Model retraining failed:', error);
        }
    }

    throttledUpdateLiveXG() {
        const now = Date.now();
        
        // Clear any pending API call
        if (this.pendingApiCall) {
            clearTimeout(this.pendingApiCall);
        }
        
        // If enough time has passed since last API call, make it immediately
        if (now - this.lastApiCall >= this.apiCallDelay) {
            this.lastApiCall = now;
            this.updateLiveXG();
        } else {
            // Otherwise, schedule it for later
            this.pendingApiCall = setTimeout(() => {
                this.lastApiCall = Date.now();
                this.updateLiveXG();
                this.pendingApiCall = null;
            }, this.apiCallDelay - (now - this.lastApiCall));
        }
    }

    async updateLiveXG() {
        try {
            // Show loading state
            this.xgDisplay.textContent = '...';
            this.xgDisplay.className = 'xg-value medium';

            const result = await this.calculateXGFromAPI();
            const xg = result.xg;
            const percentage = (xg * 100).toFixed(1) + '%';

            this.xgDisplay.textContent = percentage;

            // Update subtitle with shot parameters impact if available
            const subtitle = document.querySelector('.xg-subtitle');
            if (subtitle && result.shot_params_impact) {
                const impact = result.shot_params_impact;
                const impactText = impact > 1 ? `+${((impact - 1) * 100).toFixed(0)}%` : `-${((1 - impact) * 100).toFixed(0)}%`;
                subtitle.textContent = `*Updates as you move positions* (Params: ${impactText})`;
            }

            // Update color based on xG value
            this.xgDisplay.className = 'xg-value ';
            if (xg >= 0.25) {
                this.xgDisplay.className += 'high';
            } else if (xg >= 0.08) {
                this.xgDisplay.className += 'medium';
            } else {
                this.xgDisplay.className += 'low';
            }

            // Update PSxG calculator with xG value for combined display (manual mode)
            if (window.psxgCalculator) {
                window.psxgCalculator.currentXGValue = xg;
                window.psxgCalculator.currentShotIsGoal = null; // Unknown outcome in manual mode
                window.psxgCalculator.currentShotIsOnTarget = true; // Assume on target
                window.psxgCalculator.updateCombinedDisplay();
            }
        } catch (error) {
            console.error('Error updating live xG:', error);
            this.xgDisplay.textContent = 'Error';
            this.xgDisplay.className = 'xg-value low';
        }
    }

    async calculateXGFromAPI() {
        try {
            const apiUrl = (this.apiUrlInput && this.apiUrlInput.value) || 'http://localhost:8000/calculate_xg';
            const shotParams = this.getShotParameters();
            
            const requestData = {
                shot_x: this.positions.shot.x / 10,
                shot_y: this.positions.shot.y / 10,
                gk_x: this.positions.gk.x / 10,
                gk_y: this.positions.gk.y / 10,
                defenders: this.positions.defenders.map(def => [def.x / 10, def.y / 10]),
                shot_params: shotParams,
                target_goal: document.querySelector('input[name="target"]:checked').value
            };
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            if (response.ok) {
                const data = await response.json();
                return data;  // Return full data object
            } else {
                console.error('API request failed:', response.statusText);
                return { xg: 0.1, shot_params_impact: 1.0 }; // Fallback value
            }
        } catch (error) {
            console.error('API request error:', error);
            return { xg: 0.1, shot_params_impact: 1.0 }; // Fallback value
        }
    }

    async calculateXG() {
        try {
            const result = await this.calculateXGFromAPI();
            this.displayResult(result.xg);
        } catch (error) {
            console.error('Error calculating xG:', error);
            this.displayResult(0.1); // Fallback
        }
    }

    // Remove the standalone and API-specific methods since we only use API now

    handleSituationChange(situation) {
        // If penalty is selected, move shot to penalty spot
        if (situation === 'Penalty') {
            const targetGoal = document.querySelector('input[name="target"]:checked').value;

            if (targetGoal === 'right') {
                // Right goal penalty spot: 11m from goal (94m on x-axis), center (34m on y-axis)
                this.positions.shot.x = 940;  // 94 * 10 for SVG coordinates
                this.positions.shot.y = 340;  // 34 * 10 for SVG coordinates
            } else {
                // Left goal penalty spot: 11m from goal (11m on x-axis), center (34m on y-axis)
                this.positions.shot.x = 110;  // 11 * 10 for SVG coordinates
                this.positions.shot.y = 340;  // 34 * 10 for SVG coordinates
            }

            // Update the visual position
            this.shotPlayer.setAttribute('cx', this.positions.shot.x);
            this.shotPlayer.setAttribute('cy', this.positions.shot.y);

            // Update the display
            this.updateDisplay();

            // Also position GK on the goal line center if not already there
            if (targetGoal === 'right') {
                this.positions.gk.x = 1040;  // Goal line
                this.positions.gk.y = 340;   // Center
            } else {
                this.positions.gk.x = 10;    // Goal line
                this.positions.gk.y = 340;   // Center
            }

            // Update goalkeeper visual position
            this.goalkeeper.setAttribute('cx', this.positions.gk.x);
            this.goalkeeper.setAttribute('cy', this.positions.gk.y);

            // Clear defenders for penalty
            this.clearDefenders();

            // Disable Head option and set to Right Foot if Head was selected
            const bodyPartSelect = document.getElementById('body-part');
            const headOption = bodyPartSelect.querySelector('option[value="Head"]');
            if (headOption) {
                headOption.disabled = true;
                // If Head was selected, switch to Right Foot
                if (bodyPartSelect.value === 'Head') {
                    bodyPartSelect.value = 'Right Foot';
                }
            }
        } else {
            // Re-enable Head option when not a penalty
            const bodyPartSelect = document.getElementById('body-part');
            const headOption = bodyPartSelect.querySelector('option[value="Head"]');
            if (headOption) {
                headOption.disabled = false;
            }
        }
    }

    getShotParameters() {
        return {
            bodyPart: document.getElementById('body-part').value,
            shotType: document.getElementById('shot-type').value,
            situation: document.getElementById('situation').value,
            previousAction: document.getElementById('previous-action').value,
            playerPosition: document.getElementById('player-position').value,
            firstTouch: document.getElementById('first-touch').checked,
            underPressure: document.getElementById('under-pressure').checked,
            matchTime: parseInt(document.getElementById('match-time').value) || 45,
            shotPower: parseInt(document.getElementById('shot-power').value) || 75,
            shotPlacement: (document.getElementById('shot-placement').value !== '' && document.getElementById('shot-placement').value !== null) ? parseInt(document.getElementById('shot-placement').value) : 7,
            scoresDiff: parseInt(document.getElementById('score-diff').value) || 0
        };
    }

    displayResult(xg) {
        const percentage = (xg * 100).toFixed(1) + '%';
        
        // Create a temporary large display
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 50px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            text-align: center;
            z-index: 1000;
            font-size: 2rem;
            font-weight: bold;
        `;
        
        let message = `Expected Goals: ${percentage}`;
        let emoji = '📊';

        if (xg >= 0.80) {
            emoji = '🔥';
            message += '\nAlmost certain goal!';
        } else if (xg >= 0.60) {
            emoji = '🎯';
            message += '\nExcellent chance!';
        } else if (xg >= 0.40) {
            emoji = '⭐';
            message += '\nVery good chance!';
        } else if (xg >= 0.25) {
            emoji = '✨';
            message += '\nGood chance!';
        } else if (xg >= 0.15) {
            emoji = '⚡';
            message += '\nDecent opportunity';
        } else if (xg >= 0.08) {
            emoji = '📈';
            message += '\nHalf-chance';
        } else if (xg >= 0.03) {
            emoji = '📊';
            message += '\nLow probability';
        } else {
            emoji = '🎲';
            message += '\nVery low chance';
        }
        
        resultDiv.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 10px;">${emoji}</div>
            <div style="white-space: pre-line;">${message}</div>
        `;
        
        document.body.appendChild(resultDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            document.body.removeChild(resultDiv);
        }, 3000);
        
        // Update live display (immediate, no throttling needed here)
        this.updateLiveXG();
    }

    createZones() {
        // Create xG grid overlay - DYNAMIC based on current GK/defender positions
        // Grid will show live xG values considering current tactical setup
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gridGroup.id = 'xg-grid';
        gridGroup.style.display = 'none'; // Hidden by default

        // Store zone definitions for dynamic updates
        // RIGHT GOAL zones (x: 995-500)
        const zones = [
            // 6-yard box zones - 15-20% range (actual: 17.3-17.4%)
            { x: 995, y: 248, w: 55, h: 92, xg: '15-20%', color: '#00ff00', opacity: 0.25 },
            { x: 995, y: 340, w: 55, h: 92, xg: '15-20%', color: '#00ff00', opacity: 0.25 },

            // Near 6-yard zones - 8-12% range (actual: 9.1-9.6%)
            { x: 940, y: 248, w: 55, h: 92, xg: '8-12%', color: '#7CFC00', opacity: 0.2 },
            { x: 940, y: 340, w: 55, h: 92, xg: '8-12%', color: '#7CFC00', opacity: 0.2 },

            // Penalty area - center - 4-6% range (actual: 5.2%)
            { x: 885, y: 280, w: 55, h: 120, xg: '4-6%', color: '#FFFF00', opacity: 0.15 },

            // Penalty area - sides - 3-4% range (actual: 3.3-3.8%)
            { x: 885, y: 200, w: 55, h: 80, xg: '3-4%', color: '#FFD700', opacity: 0.15 },
            { x: 885, y: 400, w: 55, h: 80, xg: '3-4%', color: '#FFD700', opacity: 0.15 },

            // Edge of box - center - 3-5% range (actual: 4.0%)
            { x: 830, y: 280, w: 55, h: 120, xg: '3-5%', color: '#FFA500', opacity: 0.12 },

            // Edge of box - sides - 1-4% range (actual: 1.7-4.0%)
            { x: 830, y: 200, w: 55, h: 80, xg: '1-4%', color: '#FF8C00', opacity: 0.12 },
            { x: 830, y: 400, w: 55, h: 80, xg: '1-4%', color: '#FF8C00', opacity: 0.12 },

            // 20-yard area - 0-2% range (no data in dataset)
            { x: 750, y: 280, w: 80, h: 120, xg: '0-2%', color: '#FF6347', opacity: 0.08 },
            { x: 750, y: 200, w: 80, h: 80, xg: '0-2%', color: '#FF4500', opacity: 0.08 },
            { x: 750, y: 400, w: 80, h: 80, xg: '0-2%', color: '#FF4500', opacity: 0.08 },

            // Long range - 0-1% range (no data in dataset)
            { x: 650, y: 200, w: 100, h: 280, xg: '0-1%', color: '#DC143C', opacity: 0.05 },
            { x: 500, y: 200, w: 150, h: 280, xg: '0-1%', color: '#8B0000', opacity: 0.05 },

            // LEFT GOAL zones (mirrored - x: 0-550)
            // 6-yard box zones
            { x: 0, y: 248, w: 55, h: 92, xg: '15-20%', color: '#00ff00', opacity: 0.25 },
            { x: 0, y: 340, w: 55, h: 92, xg: '15-20%', color: '#00ff00', opacity: 0.25 },

            // Near 6-yard zones
            { x: 55, y: 248, w: 55, h: 92, xg: '8-12%', color: '#7CFC00', opacity: 0.2 },
            { x: 55, y: 340, w: 55, h: 92, xg: '8-12%', color: '#7CFC00', opacity: 0.2 },

            // Penalty area - center
            { x: 110, y: 280, w: 55, h: 120, xg: '4-6%', color: '#FFFF00', opacity: 0.15 },

            // Penalty area - sides
            { x: 110, y: 200, w: 55, h: 80, xg: '3-4%', color: '#FFD700', opacity: 0.15 },
            { x: 110, y: 400, w: 55, h: 80, xg: '3-4%', color: '#FFD700', opacity: 0.15 },

            // Edge of box - center
            { x: 165, y: 280, w: 55, h: 120, xg: '3-5%', color: '#FFA500', opacity: 0.12 },

            // Edge of box - sides
            { x: 165, y: 200, w: 55, h: 80, xg: '1-4%', color: '#FF8C00', opacity: 0.12 },
            { x: 165, y: 400, w: 55, h: 80, xg: '1-4%', color: '#FF8C00', opacity: 0.12 },

            // 20-yard area
            { x: 220, y: 280, w: 80, h: 120, xg: '0-2%', color: '#FF6347', opacity: 0.08 },
            { x: 220, y: 200, w: 80, h: 80, xg: '0-2%', color: '#FF4500', opacity: 0.08 },
            { x: 220, y: 400, w: 80, h: 80, xg: '0-2%', color: '#FF4500', opacity: 0.08 },

            // Long range
            { x: 300, y: 200, w: 100, h: 280, xg: '0-1%', color: '#DC143C', opacity: 0.05 },
            { x: 400, y: 200, w: 150, h: 280, xg: '0-1%', color: '#8B0000', opacity: 0.05 },
        ];

        // Store zones for dynamic updates
        this.gridZones = zones;

        zones.forEach((zone, index) => {
            // Create colored zone rectangle
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', zone.x);
            rect.setAttribute('y', zone.y);
            rect.setAttribute('width', zone.w);
            rect.setAttribute('height', zone.h);
            rect.setAttribute('fill', zone.color);
            rect.setAttribute('opacity', zone.opacity);
            rect.setAttribute('stroke', '#333');
            rect.setAttribute('stroke-width', '1');
            rect.setAttribute('data-zone-id', index);
            gridGroup.appendChild(rect);

            // Create text label for xG percentage
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', zone.x + zone.w / 2);
            text.setAttribute('y', zone.y + zone.h / 2 - 8);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', '#000');
            text.setAttribute('font-size', '11');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('pointer-events', 'none');
            text.setAttribute('data-zone-text', index);
            text.textContent = zone.xg;
            gridGroup.appendChild(text);

            // Create subtitle showing "Live xG" or "Historical avg"
            const subtitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            subtitle.setAttribute('x', zone.x + zone.w / 2);
            subtitle.setAttribute('y', zone.y + zone.h / 2 + 8);
            subtitle.setAttribute('text-anchor', 'middle');
            subtitle.setAttribute('dominant-baseline', 'middle');
            subtitle.setAttribute('fill', '#333');
            subtitle.setAttribute('font-size', '8');
            subtitle.setAttribute('font-style', 'italic');
            subtitle.setAttribute('pointer-events', 'none');
            subtitle.setAttribute('data-zone-subtitle', index);
            subtitle.textContent = '(historical)';
            gridGroup.appendChild(subtitle);
        });

        // Insert grid before players
        this.pitch.insertBefore(gridGroup, this.pitch.querySelector('.player'));

        // Add toggle button listener
        document.getElementById('toggle-xg-grid').addEventListener('click', async () => {
            const grid = document.getElementById('xg-grid');
            const isVisible = grid.style.display === 'none';
            grid.style.display = isVisible ? 'block' : 'none';

            if (isVisible) {
                console.log('📊 xG Grid toggled ON - calculating live values...');

                // Check if we have game data loaded
                if (!this.gameData || !this.gameData.shots || this.gameData.shots.length === 0) {
                    console.warn('⚠️ No game data loaded! Grid will show values for current manual positions.');
                    console.log('💡 Upload a game data file and analyze a shot to see live xG based on actual game positions.');
                }

                await this.updateXGGrid();
            } else {
                console.log('📊 xG Grid toggled OFF');
            }
        });

        // Add Voronoi toggle button listener
        document.getElementById('toggle-voronoi').addEventListener('click', () => {
            this.toggleVoronoi();
        });

        // Initialize Voronoi overlay (hidden by default)
        this.createVoronoiOverlay();
    }

    async updateXGGrid() {
        // Update grid zones with live xG based on current GK and defender positions
        try {
            if (!this.gridZones) {
                console.error('❌ Cannot update xG Grid: gridZones is not initialized');
                return;
            }

            console.log('🔄 Updating xG Grid with current positions...');
            console.log(`   GK: (${this.positions.gk.x}, ${this.positions.gk.y}) SVG coords`);
            console.log(`   Defenders: ${this.positions.defenders.length} defenders`);
            console.log(`   Grid zones: ${this.gridZones.length} zones`);

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < this.gridZones.length; i++) {
                try {
                    const zone = this.gridZones[i];

                    // Calculate center of zone in pitch coordinates
                    const centerX = zone.x + zone.w / 2;
                    const centerY = zone.y + zone.h / 2;

                    // Convert SVG to pitch coordinates
                    const pitchX = (centerX / 1050) * 105;
                    const pitchY = (centerY / 680) * 68;

                    // Get current GK position from actual position object (not sliders)
                    const gkX = this.positions.gk.x / 10;
                    const gkY = this.positions.gk.y / 10;

                    // Get current defender positions from actual positions
                    const defenders = [];
                    for (let def of this.positions.defenders) {
                        defenders.push([def.x / 10, def.y / 10]);
                    }

                    // Get current shot parameters
                    const shotParams = this.getShotParams();

                    // Determine target goal based on zone position
                    const targetGoal = centerX > 525 ? 'right' : 'left';

                    // Calculate xG for this zone
                    const response = await fetch('/calculate_xg', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            shot_x: pitchX,
                            shot_y: pitchY,
                            gk_x: gkX,
                            gk_y: gkY,
                            defenders: defenders,
                            shot_params: shotParams,
                            target_goal: targetGoal
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`API returned status ${response.status}`);
                    }

                    const data = await response.json();
                    const xgValue = (data.xg * 100).toFixed(1);

                    // Update zone text
                    const textElement = document.querySelector(`[data-zone-text="${i}"]`);
                    if (textElement) {
                        const oldText = textElement.textContent;
                        textElement.textContent = `${xgValue}%`;
                        if (i === 0) console.log(`   Zone 0 text: "${oldText}" → "${xgValue}%"`);
                    } else {
                        console.warn(`⚠️ Text element for zone ${i} not found`);
                    }

                    // Update subtitle
                    const subtitleElement = document.querySelector(`[data-zone-subtitle="${i}"]`);
                    if (subtitleElement) {
                        const oldSubtitle = subtitleElement.textContent;
                        subtitleElement.textContent = '(live xG)';
                        if (i === 0) console.log(`   Zone 0 subtitle: "${oldSubtitle}" → "(live xG)"`);
                    } else {
                        console.warn(`⚠️ Subtitle element for zone ${i} not found`);
                    }

                    // Update zone color based on xG value
                    const rectElement = document.querySelector(`[data-zone-id="${i}"]`);
                    if (rectElement) {
                        const xgNum = parseFloat(xgValue);
                        let color, opacity;

                        if (xgNum >= 15) {
                            color = '#00ff00'; opacity = 0.25;
                        } else if (xgNum >= 8) {
                            color = '#7CFC00'; opacity = 0.2;
                        } else if (xgNum >= 4) {
                            color = '#FFFF00'; opacity = 0.15;
                        } else if (xgNum >= 3) {
                            color = '#FFD700'; opacity = 0.15;
                        } else if (xgNum >= 1) {
                            color = '#FFA500'; opacity = 0.12;
                        } else {
                            color = '#FF6347'; opacity = 0.08;
                        }

                        rectElement.setAttribute('fill', color);
                        rectElement.setAttribute('opacity', opacity);
                    } else {
                        console.warn(`⚠️ Rect element for zone ${i} not found`);
                    }

                    successCount++;
                } catch (error) {
                    console.error(`❌ Error calculating xG for zone ${i}:`, error);
                    errorCount++;
                }
            }

            console.log(`✅ xG Grid update complete: ${successCount} zones updated, ${errorCount} errors`);
        } catch (error) {
            console.error('❌ Fatal error in updateXGGrid:', error);
        }
    }

    createVoronoiOverlay() {
        // Create Voronoi group if it doesn't exist
        let voronoiGroup = document.getElementById('voronoi-overlay');
        if (!voronoiGroup) {
            voronoiGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            voronoiGroup.setAttribute('id', 'voronoi-overlay');
            voronoiGroup.style.display = 'none';
            // Insert before players
            this.pitch.insertBefore(voronoiGroup, this.pitch.querySelector('.player'));
        }
    }

    toggleVoronoi() {
        const voronoiGroup = document.getElementById('voronoi-overlay');
        if (voronoiGroup.style.display === 'none') {
            // Show Voronoi - regenerate based on current defender positions
            this.drawVoronoi();
            voronoiGroup.style.display = 'block';
        } else {
            // Hide Voronoi
            voronoiGroup.style.display = 'none';
        }
    }

    updateVoronoiIfVisible() {
        const voronoiGroup = document.getElementById('voronoi-overlay');
        if (voronoiGroup && voronoiGroup.style.display !== 'none') {
            this.drawVoronoi();
        }
    }

    drawVoronoi() {
        const voronoiGroup = document.getElementById('voronoi-overlay');
        voronoiGroup.innerHTML = ''; // Clear existing

        // If no defenders, show message
        if (this.positions.defenders.length === 0) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', 525);
            text.setAttribute('y', 340);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', '#00BCD4');
            text.setAttribute('font-size', '18');
            text.setAttribute('font-weight', 'bold');
            text.textContent = 'No defenders - Add defenders to see Voronoi zones';
            voronoiGroup.appendChild(text);
            return;
        }

        // All points including GK and shot
        const allPoints = [
            { x: this.positions.shot.x, y: this.positions.shot.y, type: 'shot', label: 'Shot', color: '#000' },
            { x: this.positions.gk.x, y: this.positions.gk.y, type: 'gk', label: 'GK', color: '#FF5722' },
            ...this.positions.defenders.map((d, i) => ({
                x: d.x,
                y: d.y,
                type: 'defender',
                label: `D${i+1}`,
                color: '#00BCD4'
            }))
        ];

        // Define pitch boundaries for clipping
        const pitchBounds = {
            minX: 0,
            maxX: 1050,
            minY: 0,
            maxY: 680
        };

        // For each point, compute its Voronoi cell
        allPoints.forEach((point, idx) => {
            // Create a grid of test points to approximate the Voronoi cell
            const cellPolygon = this.computeVoronoiCell(point, allPoints, pitchBounds);

            if (cellPolygon.length > 0) {
                // Draw the polygon
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const pointsStr = cellPolygon.map(p => `${p.x},${p.y}`).join(' ');
                polygon.setAttribute('points', pointsStr);

                // Color based on type
                let fillColor, strokeColor;
                if (point.type === 'defender') {
                    fillColor = 'rgba(0, 188, 212, 0.2)';
                    strokeColor = '#00BCD4';
                } else if (point.type === 'gk') {
                    fillColor = 'rgba(255, 87, 34, 0.2)';
                    strokeColor = '#FF5722';
                } else {
                    fillColor = 'rgba(100, 100, 100, 0.15)';
                    strokeColor = '#666';
                }

                polygon.setAttribute('fill', fillColor);
                polygon.setAttribute('stroke', strokeColor);
                polygon.setAttribute('stroke-width', '2');
                polygon.setAttribute('pointer-events', 'none');
                voronoiGroup.appendChild(polygon);

                // Add label at center of mass of polygon
                const centroid = this.computeCentroid(cellPolygon);
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', centroid.x);
                text.setAttribute('y', centroid.y);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'middle');
                text.setAttribute('fill', point.color);
                text.setAttribute('font-size', '14');
                text.setAttribute('font-weight', 'bold');
                text.textContent = point.label;
                voronoiGroup.appendChild(text);
            }
        });
    }

    computeVoronoiCell(point, allPoints, bounds) {
        // Compute the Voronoi cell for a point by finding perpendicular bisectors
        // This is a simplified approach - we'll create a polygon by sampling the boundary

        const cellVertices = [];
        const numSamples = 32; // Number of angles to sample
        const maxRadius = 200; // Maximum radius to check

        // For each angle, find the edge of the Voronoi cell
        for (let i = 0; i < numSamples; i++) {
            const angle = (i * 2 * Math.PI) / numSamples;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            // Binary search for the edge of the cell in this direction
            let minR = 0;
            let maxR = maxRadius;

            for (let iter = 0; iter < 20; iter++) {
                const r = (minR + maxR) / 2;
                const testX = point.x + dx * r;
                const testY = point.y + dy * r;

                // Check if this test point is closer to our point than any other
                let closestDist = Math.sqrt(
                    Math.pow(testX - point.x, 2) +
                    Math.pow(testY - point.y, 2)
                );
                let isClosest = true;

                for (const other of allPoints) {
                    if (other === point) continue;
                    const distToOther = Math.sqrt(
                        Math.pow(testX - other.x, 2) +
                        Math.pow(testY - other.y, 2)
                    );
                    if (distToOther < closestDist - 0.5) {
                        isClosest = false;
                        break;
                    }
                }

                if (isClosest) {
                    minR = r;
                } else {
                    maxR = r;
                }
            }

            const finalR = (minR + maxR) / 2;
            let vx = point.x + dx * finalR;
            let vy = point.y + dy * finalR;

            // Clip to pitch bounds
            vx = Math.max(bounds.minX, Math.min(bounds.maxX, vx));
            vy = Math.max(bounds.minY, Math.min(bounds.maxY, vy));

            cellVertices.push({ x: vx, y: vy });
        }

        return cellVertices;
    }

    computeCentroid(polygon) {
        let sumX = 0, sumY = 0;
        for (const vertex of polygon) {
            sumX += vertex.x;
            sumY += vertex.y;
        }
        return {
            x: sumX / polygon.length,
            y: sumY / polygon.length
        };
    }

    showDetailsModal() {
        this.detailsModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeDetailsModal() {
        this.detailsModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }

    showChapterModal() {
        this.chapterModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeChapterModal() {
        this.chapterModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }

    showPhysicsChapterModal() {
        if (this.physicsChapterModal) {
            this.physicsChapterModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    closePhysicsChapterModal() {
        if (this.physicsChapterModal) {
            this.physicsChapterModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    downloadChapter(type) {
        const contentId = type === 'geometry' ? 'geometry-chapter-content' : 'physics-chapter-content';
        const title = type === 'geometry'
            ? 'The Geometry of Pressure: A Tale of xG'
            : 'The Physics of Fate: A Tale of PSxG';
        const fileName = type === 'geometry'
            ? 'the_geometry_of_pressure.html'
            : 'the_physics_of_fate.html';
        const accentColor = type === 'geometry' ? '#9C27B0' : '#E91E63';

        const contentEl = document.getElementById(contentId);
        if (!contentEl) return;

        const chapterBody = contentEl.innerHTML;
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body {
    font-family: Georgia, 'Times New Roman', serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 24px;
    background: #fdfdfd;
    color: #1a1a1a;
    line-height: 1.8;
    font-size: 17px;
  }
  h1 {
    font-size: 32px;
    font-weight: 700;
    color: #111;
    border-bottom: 2px solid ${accentColor};
    padding-bottom: 12px;
    margin-bottom: 24px;
  }
  h2 {
    font-size: 24px;
    font-weight: 600;
    color: #1e3a5f;
    margin-top: 36px;
    margin-bottom: 16px;
  }
  h3 {
    font-size: 20px;
    font-weight: 600;
    color: ${accentColor};
    margin-top: 28px;
    margin-bottom: 12px;
  }
  p {
    margin-bottom: 14px;
  }
  em {
    color: #374151;
  }
  strong {
    color: #111;
  }
  blockquote {
    border-left: 3px solid ${accentColor};
    margin: 20px 0;
    padding: 12px 20px;
    background: #f0f7ff;
    border-radius: 0 8px 8px 0;
    font-style: italic;
    color: #1e3a5f;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
  }
  th {
    background: #f1f5f9;
    font-weight: 600;
  }
  th, td {
    border: 1px solid #d1d5db;
    padding: 8px 12px;
    text-align: left;
  }
  code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
  }
  .footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
    font-size: 13px;
    color: #94a3b8;
    text-align: center;
  }
</style>
</head>
<body>
<h1>${title}</h1>
${chapterBody}
<div class="footer">${title} - Generated from Football Analytics Dashboard</div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showExplainModal() {
        // Generate dynamic scenario analysis
        this.generateScenarioExplanation();
        this.explainModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeExplainModal() {
        this.explainModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }

    generateScenarioExplanation() {
        const scenarioDiv = document.getElementById('scenario-analysis');

        // Get current scenario details
        const shotX = Math.round(this.positions.shot.x / 10);
        const shotY = Math.round(this.positions.shot.y / 10);
        const gkX = Math.round(this.positions.gk.x / 10);
        const gkY = Math.round(this.positions.gk.y / 10);
        const defenderCount = this.positions.defenders.length;
        const targetGoal = document.querySelector('input[name="target"]:checked').value;
        const currentXG = this.xgDisplay.textContent;

        // Get shot parameters
        const bodyPart = document.getElementById('body-part').value;
        const shotType = document.getElementById('shot-type').value;
        const situation = document.getElementById('situation').value;
        const previousAction = document.getElementById('previous-action').value;
        const playerPosition = document.getElementById('player-position').value;
        const matchTime = parseInt(document.getElementById('match-time').value) || 45;
        const shotPower = parseInt(document.getElementById('shot-power').value) || 75;
        const shotPlacement = parseInt(document.getElementById('shot-placement').value) || 7;
        const scoreDiff = parseInt(document.getElementById('score-diff').value) || 0;
        const firstTouch = document.getElementById('first-touch').checked;
        const underPressure = document.getElementById('under-pressure').checked;

        // Calculate distance and angle (using EXACT same formula as pitch visualization)
        const goalX = targetGoal === 'right' ? 105 : 0;
        const shotXMeters = this.positions.shot.x / 10;
        const goalXMeters = goalX;
        const distance = Math.abs(goalXMeters - shotXMeters);
        const angle = Math.atan2(7.32, distance + 0.1) * (180 / Math.PI);

        // Analyze defenders in corridor
        const blockingAnalysis = this.analyzeDefenderBlocking(
            targetGoal === 'right' ? 1050 : 0,
            340,
            306.6,
            373.4
        );
        const defendersInCorridor = blockingAnalysis.filter(d => d.onShotLine).length;

        // Determine shot quality category
        let qualityCategory, qualityColor, qualityIcon;
        const xgValue = parseFloat(currentXG) / 100;
        if (xgValue >= 0.20) {
            qualityCategory = "Excellent Chance";
            qualityColor = "#4CAF50";
            qualityIcon = "🎯";
        } else if (xgValue >= 0.08) {
            qualityCategory = "Decent Opportunity";
            qualityColor = "#FF9800";
            qualityIcon = "⚡";
        } else {
            qualityCategory = "Difficult Shot";
            qualityColor = "#F44336";
            qualityIcon = "📊";
        }

        // Generate explanation
        let html = `
            <div style="background: linear-gradient(135deg, ${qualityColor}22 0%, ${qualityColor}11 100%); padding: 25px; border-radius: 10px; border-left: 5px solid ${qualityColor};">
                <h3 style="color: ${qualityColor}; margin-top: 0;">${qualityIcon} Current Scenario: ${qualityCategory}</h3>
                <div style="font-size: 48px; font-weight: bold; color: ${qualityColor}; text-align: center; margin: 20px 0;">
                    ${currentXG} xG
                </div>
            </div>

            <h3 style="color: #4CAF50; margin-top: 30px;">📍 Scenario Breakdown</h3>

            <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3; color: #000;">
                <h4 style="color: #2196F3; margin-top: 0;">🎯 Position & Geometry</h4>
                <p style="color: #000;"><strong>Shot Position:</strong> (${shotX}, ${shotY}) meters</p>
                <p style="color: #000;"><strong>Target Goal:</strong> ${targetGoal === 'right' ? 'Right Goal ⚽→' : 'Left Goal ←⚽'}</p>
                <p style="color: #000;"><strong>Distance to Goal:</strong> ${distance.toFixed(1)} meters</p>
                <p style="color: #000;"><strong>Shooting Angle:</strong> ${angle.toFixed(1)}°</p>
            </div>

            <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF9800; color: #000;">
                <h4 style="color: #FF9800; margin-top: 0;">🛡️ Defensive Setup</h4>
                <p style="color: #000;"><strong>Goalkeeper Position:</strong> (${gkX}, ${gkY}) meters</p>
                <p style="color: #000;"><strong>Total Defenders:</strong> ${defenderCount}</p>
                <p style="color: #000;"><strong>Defenders Blocking Shot:</strong> ${defendersInCorridor}</p>
            </div>

            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; color: #000;">
                <h4 style="color: #4CAF50; margin-top: 0;">⚽ Shot Parameters</h4>
                <p style="color: #000;"><strong>Body Part:</strong> ${bodyPart}</p>
                <p style="color: #000;"><strong>Shot Type:</strong> ${shotType}</p>
                <p style="color: #000;"><strong>Shot Power:</strong> ${shotPower}/100 ${shotPower >= 85 ? '(Strong 💪)' : shotPower >= 70 ? '(Above Average ⚡)' : shotPower >= 60 ? '(Normal ✓)' : '(Weak 📉)'}</p>
                <p style="color: #000;"><strong>Shot Placement:</strong> ${shotPlacement}/10 ${shotPlacement >= 9 ? '(Perfect 🎯)' : shotPlacement >= 7 ? '(Good ✓)' : shotPlacement >= 5 ? '(Average ~)' : '(Poor ❌)'}</p>
                <p style="color: #000;"><strong>First Touch:</strong> ${firstTouch ? 'Yes ⚡' : 'No'}</p>
                <p style="color: #000;"><strong>Under Pressure:</strong> ${underPressure ? 'Yes 😰' : 'No'}</p>
            </div>

            <div style="background: #fce4ec; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #E91E63; color: #000;">
                <h4 style="color: #E91E63; margin-top: 0;">🎮 Game Context</h4>
                <p style="color: #000;"><strong>Situation:</strong> ${situation}</p>
                <p style="color: #000;"><strong>Previous Action:</strong> ${previousAction}</p>
                <p style="color: #000;"><strong>Player Position:</strong> ${playerPosition}</p>
                <p style="color: #000;"><strong>Match Time:</strong> ${matchTime} minutes ${matchTime >= 90 ? '(Injury Time ⏱️)' : matchTime >= 75 ? '(Late Game 🔥)' : matchTime >= 45 ? '(Second Half)' : '(First Half)'}</p>
                <p style="color: #000;"><strong>Score Difference:</strong> ${scoreDiff > 0 ? `Winning by ${scoreDiff} ✅` : scoreDiff < 0 ? `Losing by ${Math.abs(scoreDiff)} ⚠️` : 'Drawing (0-0) ⚖️'}</p>
            </div>

            <h3 style="color: #4CAF50; margin-top: 30px;">🔍 What's Happening Here?</h3>
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3; color: #000;">
        `;

        // Add contextual explanation based on scenario
        if (distance < 10) {
            html += `<p style="color: #000;"><strong>✅ Very close to goal</strong> - At ${distance.toFixed(1)} meters, you're in a prime scoring position. Shots from this distance typically have high conversion rates.</p>`;
        } else if (distance < 18) {
            html += `<p style="color: #000;"><strong>⚡ Moderate distance</strong> - At ${distance.toFixed(1)} meters, you're in the penalty area. This is a decent shooting position if the angle and defensive pressure allow.</p>`;
        } else {
            html += `<p style="color: #000;"><strong>📊 Long range</strong> - At ${distance.toFixed(1)} meters, this is a long-distance shot. Even with perfect execution, the probability is lower due to distance.</p>`;
        }

        if (angle > 30) {
            html += `<p style="color: #000;"><strong>✅ Wide shooting angle</strong> - With ${angle.toFixed(1)}° angle, you can see a lot of the goal. This significantly increases your chances.</p>`;
        } else if (angle > 20) {
            html += `<p style="color: #000;"><strong>⚡ Moderate angle</strong> - ${angle.toFixed(1)}° gives you a reasonable view of the goal, though not ideal.</p>`;
        } else {
            html += `<p style="color: #000;"><strong>❌ Narrow angle</strong> - At only ${angle.toFixed(1)}°, you have a very limited view of the goal. This makes it much harder to score.</p>`;
        }

        if (defendersInCorridor === 0) {
            html += `<p style="color: #000;"><strong>✅ Clear shot path</strong> - No defenders are blocking your shot corridor. This is an excellent situation!</p>`;
        } else if (defendersInCorridor === 1) {
            html += `<p style="color: #000;"><strong>⚠️ One defender blocking</strong> - There's 1 defender in your shot corridor, reducing your xG. You'll need to shoot around or through them.</p>`;
        } else {
            html += `<p style="color: #000;"><strong>❌ Multiple defenders blocking</strong> - ${defendersInCorridor} defenders are in your shot corridor. This significantly reduces your xG as they create a defensive wall.</p>`;
        }

        const gkCenterY = 34;
        const gkOffset = Math.abs(gkY - gkCenterY);
        if (gkOffset > 3) {
            html += `<p style="color: #000;"><strong>✅ Goalkeeper out of position!</strong> - The GK is ${gkOffset.toFixed(1)}m off-center. This creates a significant gap you can exploit.</p>`;
        } else if (gkOffset > 1) {
            html += `<p style="color: #000;"><strong>⚡ Goalkeeper slightly off</strong> - The GK is ${gkOffset.toFixed(1)}m from center. There's a small gap but they can still react.</p>`;
        } else {
            html += `<p style="color: #000;"><strong>Goalkeeper well-positioned</strong> - The GK is centered and ready. You'll need precise placement to beat them.</p>`;
        }

        html += `</div>`;

        // Add contextual insights based on parameters
        html += `
            <h3 style="color: #4CAF50; margin-top: 30px;">💡 Contextual Insights</h3>
            <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9C27B0; color: #000;">
        `;

        // Shot quality insights
        if (shotPower >= 85 && shotPlacement >= 7) {
            html += `<p style="color: #000;">💪 <strong>High-quality shot execution:</strong> With power ${shotPower} and placement ${shotPlacement}, this is a well-struck shot that maximizes the base xG.</p>`;
        } else if (shotPower < 60 || shotPlacement < 5) {
            html += `<p style="color: #000;">⚠️ <strong>Shot quality concern:</strong> Lower power (${shotPower}) or placement (${shotPlacement}) significantly reduces the chance of scoring, even from good positions.</p>`;
        }

        // Body part impact
        if (bodyPart === 'Head' && distance > 10) {
            html += `<p style="color: #000;">🤕 <strong>Header from distance:</strong> Headers are significantly less accurate from ${distance.toFixed(1)}m. Headers work best in the 6-yard box.</p>`;
        } else if (bodyPart === 'Head' && distance <= 6) {
            html += `<p style="color: #000;">🎯 <strong>Perfect header position:</strong> Headers from the 6-yard box have high conversion rates - this is ideal positioning!</p>`;
        }

        // Situation context
        if (situation === 'Penalty') {
            html += `<p style="color: #000;">🎯 <strong>Penalty situation:</strong> From the penalty spot with no defenders, this shot has inherently high xG (~76-80%). Only GK positioning and shot execution matter here.</p>`;
        } else if (situation === 'Counter') {
            html += `<p style="color: #000;">⚡ <strong>Counter-attack advantage:</strong> Counter-attacks typically have ~33% higher xG because defenses are disorganized and out of position.</p>`;
        } else if (situation === 'Corner') {
            html += `<p style="color: #000;">📐 <strong>Set-piece opportunity:</strong> Corners create crowded box scenarios. Success depends heavily on positioning and timing.</p>`;
        }

        // Previous action context
        if (previousAction === 'Through Ball') {
            html += `<p style="color: #000;">🎯 <strong>Through ball advantage:</strong> Through balls split defenses and create 1v1 situations, boosting xG by ~24%.</p>`;
        } else if (previousAction === 'Cross') {
            html += `<p style="color: #000;">📊 <strong>Cross scenario:</strong> Crosses have lower conversion (~7%) due to difficulty of timing and technique.</p>`;
        }

        // Pressure and touch
        if (firstTouch && underPressure) {
            html += `<p style="color: #000;">😰 <strong>High-difficulty scenario:</strong> Taking a first-touch shot while under pressure is extremely difficult. This reduces xG by ~15-20%.</p>`;
        } else if (firstTouch) {
            html += `<p style="color: #000;">⚡ <strong>First-touch shot:</strong> First-time finishes require excellent technique but can catch GKs off-guard.</p>`;
        } else if (underPressure) {
            html += `<p style="color: #000;">😰 <strong>Defensive pressure:</strong> Being pressed by defenders reduces accuracy and decision-making time, lowering xG.</p>`;
        }

        // Match time context
        if (matchTime >= 90) {
            html += `<p style="color: #000;">⏱️ <strong>Injury time desperation:</strong> Late-game shots often come with increased urgency ${scoreDiff < 0 ? 'especially when losing' : ''}. Players take more risks.</p>`;
        } else if (matchTime >= 75) {
            html += `<p style="color: #000;">🔥 <strong>Late-game pressure:</strong> The last 15 minutes see more attacking intent and fatigue, affecting both attack and defense.</p>`;
        }

        // Score difference context
        if (scoreDiff <= -2) {
            html += `<p style="color: #000;">⚠️ <strong>Desperation mode:</strong> Being down by ${Math.abs(scoreDiff)} goals creates pressure to shoot even from poor positions. Risk tolerance increases.</p>`;
        } else if (scoreDiff >= 2) {
            html += `<p style="color: #000;">✅ <strong>Comfortable lead:</strong> With a ${scoreDiff}-goal cushion, players can be more selective and patient with shots.</p>`;
        }

        // Player position insight
        if (playerPosition === 'Striker') {
            html += `<p style="color: #000;">⚽ <strong>Striker advantage:</strong> Strikers have +9% higher conversion rates due to specialized finishing skills and positioning.</p>`;
        } else if (playerPosition === 'Defender' && distance > 20) {
            html += `<p style="color: #000;">🛡️ <strong>Defender long shot:</strong> Defenders rarely score from distance (-26% modifier). This is a low-percentage attempt.</p>`;
        }

        html += `</div>`;

        // Explanation summary
        html += `
            <h3 style="color: #4CAF50; margin-top: 30px;">📖 Explanation</h3>
            <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF9800; color: #000;">
                <p style="color: #000;"><strong>"In this scenario, we have..."</strong></p>
                <ol style="color: #000;">
                    <li><strong>Position:</strong> A ${playerPosition} is ${distance.toFixed(1)} meters from goal with a ${angle.toFixed(1)}° shooting angle</li>
                    <li><strong>Technique:</strong> Using ${bodyPart} with ${shotType.toLowerCase()} shot, power ${shotPower}/100, placement ${shotPlacement}/10</li>
                    <li><strong>Context:</strong> ${situation} in the ${matchTime}' minute, ${scoreDiff === 0 ? 'game tied' : scoreDiff > 0 ? 'team winning' : 'team losing'}</li>
                    <li><strong>Defense:</strong> ${defendersInCorridor > 0 ? defendersInCorridor + ' defender(s) blocking the shot path' : 'A clear path to goal with no defenders blocking'}</li>
                    <li><strong>Result:</strong> All these factors combine to give us ${currentXG} xG - if we took this exact shot 100 times with identical conditions, we'd expect about ${Math.round(xgValue * 100)} goals</li>
                </ol>
                <p style="margin-top: 15px; padding: 15px; background: white; border-radius: 5px; color: #000;">
                    💡 <strong>Key Teaching Point:</strong> xG is a <em>context-driven probability</em>. Every factor matters - from geometry (distance, angle) to technique (power, body part) to game situation (time, score). This is why identical positions can have different xG values based on these contextual modifiers.
                </p>
            </div>

            <h3 style="color: #FF6B35; margin-top: 30px;">🎲 What Could Change the Outcome?</h3>
            <div style="background: #fff8f0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF6B35; color: #000;">
                <p style="color: #000;"><strong>This is ${currentXG} xG, but the actual outcome could be different because...</strong></p>
        `;

        // Generate counter-arguments based on scenario
        const counterArgs = [];

        // Shot quality variations
        if (shotPower >= 70) {
            counterArgs.push(`⚡ <strong>Power doesn't guarantee accuracy:</strong> Even with ${shotPower}/100 power, the ball could sail over the bar or wide if the player mistimes the strike.`);
        } else {
            counterArgs.push(`📉 <strong>Low power could surprise the keeper:</strong> At ${shotPower}/100 power, this might look like a weak shot, but a well-placed low-power finish can catch GKs off-guard (think panenka penalties).`);
        }

        // Goalkeeper unpredictability
        if (gkOffset > 2) {
            counterArgs.push(`🧤 <strong>Goalkeeper reaction time:</strong> Even though the GK is ${gkOffset.toFixed(1)}m off-center, a world-class keeper can still make an incredible diving save - xG doesn't account for GK quality.`);
        } else {
            counterArgs.push(`🧤 <strong>GK mistake potential:</strong> Even perfectly positioned goalkeepers make errors - fumbles, slips, misjudgments. A routine save could turn into a goal.`);
        }

        // Defender impact
        if (defendersInCorridor > 0) {
            counterArgs.push(`🛡️ <strong>Deflections are unpredictable:</strong> The ${defendersInCorridor} defender(s) in the corridor could accidentally deflect the ball <em>into</em> the goal (own goal) or block it completely - deflections are random.`);
        } else {
            counterArgs.push(`🏃 <strong>Last-second defensive intervention:</strong> Even with no defenders currently blocking, a sliding tackle or desperate lunge could still block the shot before it's taken.`);
        }

        // Distance factor
        if (distance < 10) {
            counterArgs.push(`😰 <strong>Pressure from proximity:</strong> Being just ${distance.toFixed(1)}m from goal means immense pressure. Players often panic and rush their finish from close range.`);
        } else {
            counterArgs.push(`🎯 <strong>Long-range miracles:</strong> From ${distance.toFixed(1)}m out, even low-xG shots can result in spectacular goals if the ball dips, swerves, or catches the wind perfectly.`);
        }

        // Situation context
        if (situation === 'Penalty') {
            counterArgs.push(`😨 <strong>Penalty pressure:</strong> Despite ~76-80% conversion rates, the mental pressure of a penalty can cause even elite players to miss. Psychology isn't in the xG model.`);
        } else if (situation === 'Counter') {
            counterArgs.push(`⏱️ <strong>Counter-attack chaos:</strong> Counter situations are fluid - defenders recovering at full sprint could close down angles faster than the model predicts.`);
        }

        // Match time psychology
        if (matchTime >= 90) {
            counterArgs.push(`⏱️ <strong>Injury time madness:</strong> In the dying minutes, players make irrational decisions - rushing shots, hesitating, or trying to be heroes. Fatigue also affects execution.`);
        } else if (matchTime <= 10) {
            counterArgs.push(`🆕 <strong>Early game nerves:</strong> In the opening minutes, players might not be fully warmed up or in rhythm, affecting shot quality unpredictably.`);
        }

        // Score difference psychology
        if (scoreDiff <= -2) {
            counterArgs.push(`😤 <strong>Desperation shooting:</strong> Being down ${Math.abs(scoreDiff)} goals creates desperation - players might rush or force shots, reducing actual conversion below the xG.`);
        } else if (scoreDiff >= 2) {
            counterArgs.push(`😌 <strong>Complacency factor:</strong> With a ${scoreDiff}-goal lead, players might lack the killer instinct and shoot half-heartedly or showboat instead of finishing clinically.`);
        }

        // Body part unpredictability
        if (bodyPart === 'Head') {
            counterArgs.push(`🤕 <strong>Header variance:</strong> Headers depend heavily on neck strength, timing, and contact point - even slight mistiming can send the ball anywhere.`);
        } else if (bodyPart === 'Weak Foot') {
            counterArgs.push(`👟 <strong>Weak foot surprise:</strong> While typically less accurate, some players practice their weak foot extensively - the xG might underestimate their actual ability.`);
        }

        // Environmental factors
        counterArgs.push(`🌧️ <strong>Environmental unknowns:</strong> Weather (rain, wind, snow), pitch condition, ball pressure, and crowd noise all affect outcomes but aren't captured in xG.`);

        // Player skill variance
        counterArgs.push(`⭐ <strong>Player quality matters:</strong> xG treats all players equally, but Messi taking this shot vs a League Two striker? Completely different actual conversion rates.`);

        // Randomness
        if (xgValue < 0.15) {
            counterArgs.push(`🎲 <strong>Low-probability magic:</strong> Even ${currentXG} xG shots score sometimes! Unexpected bounces, GK errors, or perfect technique can defy the odds.`);
        } else if (xgValue > 0.50) {
            counterArgs.push(`🤦 <strong>High-probability misses:</strong> Even ${currentXG} xG chances get missed! Slips, poor touches, hitting the post, or incredible saves happen.`);
        }

        // Display counter-arguments
        html += '<ul style="color: #000; line-height: 1.8;">';
        counterArgs.slice(0, 6).forEach(arg => {
            html += `<li style="margin-bottom: 10px;">${arg}</li>`;
        });
        html += '</ul>';

        html += `
                <p style="margin-top: 20px; padding: 15px; background: #ffe0e0; border-radius: 5px; color: #000; border-left: 3px solid #d32f2f;">
                    ⚠️ <strong>The Bottom Line:</strong> xG tells us the <em>probability</em> based on historical data from thousands of similar shots. But football is beautiful because it's unpredictable - individual skill, luck, psychology, and chaos all play a role. That's why a 90% xG shot can miss and a 2% xG shot can become a legendary goal!
                </p>
            </div>
        `;

        // Add PSxG Explanation Section
        html += this.generatePSxGExplanation(distance);

        scenarioDiv.innerHTML = html;
    }

    // Generate PSxG Explanation Section
    generatePSxGExplanation(shotDistance) {
        // Get PSxG data from the PSxGCalculator if available
        if (!window.psxgCalculator) {
            return `
                <h3 style="color: #9C27B0; margin-top: 30px;">🎯 PSxG (Post-Shot Expected Goals)</h3>
                <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9C27B0; color: #000;">
                    <p style="color: #000;">PSxG calculator not available. Drag the ball in the Goal Frame View to see PSxG analysis.</p>
                </div>
            `;
        }

        const calc = window.psxgCalculator;
        const ballX = calc.ballX;
        const ballY = calc.ballY;
        const gkX = calc.gkX;
        const gkY = calc.gkY;
        const shotSpeed = calc.shotSpeed;
        const distance = shotDistance || calc.shotDistance || 15;

        // Calculate physics values
        const horizontalDist = Math.abs(ballX - gkX);
        const verticalDist = Math.abs(ballY - Math.max(0, gkY));
        const gkDiveDistance = Math.sqrt(horizontalDist * horizontalDist + verticalDist * verticalDist);

        // Ball travel time
        const speedMs = shotSpeed / 3.6;
        const ballTravelTime = distance / speedMs;

        // GK reach time
        const GK_REACTION_TIME = 0.15;
        const GK_DIVE_SPEED_H = 4.0;
        const GK_DIVE_SPEED_V = 2.5;
        const diveTimeH = horizontalDist / GK_DIVE_SPEED_H;
        const diveTimeV = verticalDist / GK_DIVE_SPEED_V;
        const gkReachTime = GK_REACTION_TIME + Math.max(diveTimeH, diveTimeV);

        // Time margin
        const timeMargin = gkReachTime - ballTravelTime;

        // Get zone
        const GOAL_WIDTH = 7.32;
        const GOAL_HEIGHT = 2.44;
        const col = ballX < GOAL_WIDTH / 4 ? 0 : ballX < GOAL_WIDTH / 2 ? 1 : ballX < 3 * GOAL_WIDTH / 4 ? 2 : 3;
        const row = ballY > GOAL_HEIGHT * 2/3 ? 0 : ballY > GOAL_HEIGHT / 3 ? 1 : 2;
        const zoneNames = [
            ['Top Left', 'Top Center-L', 'Top Center-R', 'Top Right'],
            ['Mid Left', 'Mid Center-L', 'Mid Center-R', 'Mid Right'],
            ['Low Left', 'Low Center-L', 'Low Center-R', 'Low Right']
        ];
        const zone = zoneNames[row][col];

        // Calculate PSxG using same formula as PSxGCalculator
        let psxg;
        if (timeMargin > 0.3) {
            psxg = 0.95;
        } else if (timeMargin > 0.15) {
            psxg = 0.75 + (timeMargin - 0.15) * 1.33;
        } else if (timeMargin > 0.05) {
            psxg = 0.55 + (timeMargin - 0.05) * 2.0;
        } else if (timeMargin > -0.05) {
            psxg = 0.15 + (timeMargin + 0.05) * 4.0;
        } else if (timeMargin > -0.15) {
            psxg = 0.08 + (timeMargin + 0.15) * 0.70;
        } else if (timeMargin > -0.3) {
            psxg = 0.03 + (timeMargin + 0.3) * 0.33;
        } else {
            psxg = 0.03;
        }

        // Apply bonuses
        if (ballY > 2.0) psxg = Math.min(0.99, psxg + 0.12);
        if (ballX < 0.5 || ballX > GOAL_WIDTH - 0.5) psxg = Math.min(0.99, psxg + 0.10);
        if (gkDiveDistance < 0.5) psxg = Math.max(0.03, psxg * 0.2);
        psxg = Math.max(0.01, Math.min(0.99, psxg));

        // Determine difficulty
        let difficulty, difficultyColor;
        if (timeMargin > 0.2) { difficulty = 'Very Hard'; difficultyColor = '#4CAF50'; }
        else if (timeMargin > 0.05) { difficulty = 'Hard'; difficultyColor = '#8BC34A'; }
        else if (timeMargin > -0.1) { difficulty = 'Medium'; difficultyColor = '#FF9800'; }
        else { difficulty = 'Easy'; difficultyColor = '#f44336'; }

        // Margin interpretation
        let marginExplanation, marginColor;
        if (timeMargin > 0) {
            marginExplanation = `Ball arrives ${Math.abs(timeMargin).toFixed(2)}s BEFORE GK can reach → Goal likely`;
            marginColor = '#4CAF50';
        } else {
            marginExplanation = `GK arrives ${Math.abs(timeMargin).toFixed(2)}s BEFORE ball → Save likely`;
            marginColor = '#f44336';
        }

        // Get current xG for comparison
        const currentXG = parseFloat(this.xgDisplay.textContent) / 100 || 0;
        const shotQuality = psxg - currentXG;
        let qualityLabel, qualityColor;
        if (shotQuality > 0.1) { qualityLabel = 'Excellent placement! 🎯'; qualityColor = '#4CAF50'; }
        else if (shotQuality > 0) { qualityLabel = 'Good placement ✓'; qualityColor = '#8BC34A'; }
        else if (shotQuality > -0.2) { qualityLabel = 'Average placement ~'; qualityColor = '#FF9800'; }
        else { qualityLabel = 'Poor placement ❌'; qualityColor = '#f44336'; }

        return `
            <h3 style="color: #9C27B0; margin-top: 30px;">🎯 PSxG (Post-Shot Expected Goals) Calculation</h3>

            <div style="background: linear-gradient(135deg, #9C27B022 0%, #9C27B011 100%); padding: 25px; border-radius: 10px; border-left: 5px solid #9C27B0; margin: 20px 0;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center;">
                    <div style="background: #1a237e; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 12px; color: #90CAF9;">xG (Pre-Shot)</div>
                        <div style="font-size: 28px; font-weight: bold; color: #4CAF50;">${(currentXG * 100).toFixed(1)}%</div>
                    </div>
                    <div style="background: #4a148c; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 12px; color: #CE93D8;">PSxG (Post-Shot)</div>
                        <div style="font-size: 28px; font-weight: bold; color: #E040FB;">${(psxg * 100).toFixed(1)}%</div>
                    </div>
                    <div style="background: #1b5e20; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 12px; color: #A5D6A7;">Shot Quality</div>
                        <div style="font-size: 28px; font-weight: bold; color: ${qualityColor};">${shotQuality >= 0 ? '+' : ''}${(shotQuality * 100).toFixed(1)}%</div>
                        <div style="font-size: 11px; color: ${qualityColor};">${qualityLabel}</div>
                    </div>
                </div>
            </div>

            <h4 style="color: #9C27B0; margin-top: 25px;">📊 Step-by-Step Physics Calculation</h4>

            <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 15px 0; color: #000;">
                <h5 style="color: #7B1FA2; margin-top: 0;">Step 1: Input Data</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 8px; color: #000;"><strong>Ball Position</strong></td>
                        <td style="padding: 8px; color: #000;">X: ${ballX.toFixed(2)}m | Y: ${ballY.toFixed(2)}m</td>
                        <td style="padding: 8px; color: #666;">(${zone})</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 8px; color: #000;"><strong>GK Position</strong></td>
                        <td style="padding: 8px; color: #000;">X: ${gkX.toFixed(2)}m | Y: ${Math.max(0, gkY).toFixed(2)}m</td>
                        <td style="padding: 8px; color: #666;">(Ground level)</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 8px; color: #000;"><strong>Shot Speed</strong></td>
                        <td style="padding: 8px; color: #000;">${shotSpeed} km/h</td>
                        <td style="padding: 8px; color: #666;">= ${speedMs.toFixed(1)} m/s</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; color: #000;"><strong>Shot Distance</strong></td>
                        <td style="padding: 8px; color: #000;">${distance.toFixed(1)}m</td>
                        <td style="padding: 8px; color: #666;">(from pitch)</td>
                    </tr>
                </table>
            </div>

            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 15px 0; color: #000;">
                <h5 style="color: #2E7D32; margin-top: 0;">Step 2: GK Dive Distance</h5>
                <div style="font-family: monospace; background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <div>Horizontal: |${ballX.toFixed(2)} - ${gkX.toFixed(2)}| = <strong>${horizontalDist.toFixed(2)}m</strong></div>
                    <div>Vertical: |${ballY.toFixed(2)} - ${Math.max(0, gkY).toFixed(2)}| = <strong>${verticalDist.toFixed(2)}m</strong></div>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                        Total: √(${horizontalDist.toFixed(2)}² + ${verticalDist.toFixed(2)}²) = <strong style="color: #2E7D32;">${gkDiveDistance.toFixed(2)}m</strong>
                    </div>
                </div>
            </div>

            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 15px 0; color: #000;">
                <h5 style="color: #1565C0; margin-top: 0;">Step 3: Time Calculations</h5>
                <div style="font-family: monospace; background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <div><strong>Ball Travel Time:</strong></div>
                    <div style="margin-left: 20px;">${distance.toFixed(1)}m ÷ ${speedMs.toFixed(1)} m/s = <strong style="color: #1565C0;">${ballTravelTime.toFixed(2)}s</strong></div>

                    <div style="margin-top: 15px;"><strong>GK Reach Time:</strong></div>
                    <div style="margin-left: 20px;">Reaction: ${GK_REACTION_TIME}s</div>
                    <div style="margin-left: 20px;">Horizontal dive: ${horizontalDist.toFixed(2)}m ÷ ${GK_DIVE_SPEED_H} m/s = ${diveTimeH.toFixed(2)}s</div>
                    <div style="margin-left: 20px;">Vertical dive: ${verticalDist.toFixed(2)}m ÷ ${GK_DIVE_SPEED_V} m/s = ${diveTimeV.toFixed(2)}s</div>
                    <div style="margin-left: 20px; margin-top: 5px;">Total: ${GK_REACTION_TIME}s + max(${diveTimeH.toFixed(2)}, ${diveTimeV.toFixed(2)}) = <strong style="color: #1565C0;">${gkReachTime.toFixed(2)}s</strong></div>
                </div>
            </div>

            <div style="background: ${timeMargin > 0 ? '#e8f5e9' : '#ffebee'}; padding: 20px; border-radius: 8px; margin: 15px 0; color: #000;">
                <h5 style="color: ${marginColor}; margin-top: 0;">Step 4: Time Margin (Critical!)</h5>
                <div style="font-family: monospace; background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <div>Margin = GK Time - Ball Time</div>
                    <div>Margin = ${gkReachTime.toFixed(2)}s - ${ballTravelTime.toFixed(2)}s = <strong style="color: ${marginColor}; font-size: 18px;">${timeMargin >= 0 ? '+' : ''}${timeMargin.toFixed(2)}s</strong></div>
                    <div style="margin-top: 10px; padding: 10px; background: ${timeMargin > 0 ? '#c8e6c9' : '#ffcdd2'}; border-radius: 5px;">
                        📌 ${marginExplanation}
                    </div>
                </div>
            </div>

            <div style="background: #fce4ec; padding: 20px; border-radius: 8px; margin: 15px 0; color: #000;">
                <h5 style="color: #C2185B; margin-top: 0;">Step 5: PSxG Result</h5>
                <div style="font-family: monospace; background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <div>Based on margin ${timeMargin >= 0 ? '+' : ''}${timeMargin.toFixed(2)}s:</div>
                    <div style="margin: 15px 0; text-align: center;">
                        <span style="font-size: 36px; font-weight: bold; color: #9C27B0;">${(psxg * 100).toFixed(1)}%</span>
                        <span style="color: #666; margin-left: 10px;">PSxG</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                        <span>Save Difficulty: <strong style="color: ${difficultyColor};">${difficulty}</strong></span>
                        <span>Zone: <strong>${zone}</strong></span>
                    </div>
                </div>
            </div>

            <h4 style="color: #9C27B0; margin-top: 25px;">📈 PSxG Scale Reference</h4>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; color: #000;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr style="background: #e0e0e0;">
                        <th style="padding: 8px; text-align: left;">Time Margin</th>
                        <th style="padding: 8px; text-align: left;">PSxG Range</th>
                        <th style="padding: 8px; text-align: left;">Scenario</th>
                    </tr>
                    <tr style="background: ${timeMargin > 0.15 ? '#c8e6c9' : '#fff'};">
                        <td style="padding: 8px;">> +0.15s</td>
                        <td style="padding: 8px; color: #4CAF50;">75-95%</td>
                        <td style="padding: 8px;">Ball beats GK → Almost certain goal</td>
                    </tr>
                    <tr style="background: ${timeMargin > 0.05 && timeMargin <= 0.15 ? '#c8e6c9' : '#fff'};">
                        <td style="padding: 8px;">+0.05s to +0.15s</td>
                        <td style="padding: 8px; color: #8BC34A;">55-75%</td>
                        <td style="padding: 8px;">Ball likely beats GK</td>
                    </tr>
                    <tr style="background: ${timeMargin > -0.05 && timeMargin <= 0.05 ? '#fff3e0' : '#fff'};">
                        <td style="padding: 8px;">-0.05s to +0.05s</td>
                        <td style="padding: 8px; color: #FF9800;">15-55%</td>
                        <td style="padding: 8px;">Close call - could go either way</td>
                    </tr>
                    <tr style="background: ${timeMargin > -0.15 && timeMargin <= -0.05 ? '#ffebee' : '#fff'};">
                        <td style="padding: 8px;">-0.15s to -0.05s</td>
                        <td style="padding: 8px; color: #FF5722;">8-15%</td>
                        <td style="padding: 8px;">GK likely saves</td>
                    </tr>
                    <tr style="background: ${timeMargin <= -0.15 ? '#ffebee' : '#fff'};">
                        <td style="padding: 8px;">< -0.15s</td>
                        <td style="padding: 8px; color: #f44336;">3-8%</td>
                        <td style="padding: 8px;">GK has plenty of time → Easy save</td>
                    </tr>
                </table>
            </div>

            <div style="background: #e8eaf6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3F51B5; color: #000;">
                <h4 style="color: #3F51B5; margin-top: 0;">💡 Key Insight: xG vs PSxG</h4>
                <p style="color: #000;"><strong>xG (${(currentXG * 100).toFixed(1)}%)</strong> measures the quality of the <em>chance</em> - position, angle, defenders.</p>
                <p style="color: #000;"><strong>PSxG (${(psxg * 100).toFixed(1)}%)</strong> measures the quality of the <em>execution</em> - where in the goal the ball is heading.</p>
                <p style="color: #000; margin-top: 15px; padding: 10px; background: white; border-radius: 5px;">
                    <strong>Shot Quality = PSxG - xG = ${shotQuality >= 0 ? '+' : ''}${(shotQuality * 100).toFixed(1)}%</strong><br>
                    <span style="color: ${qualityColor};">${shotQuality > 0 ? '✓ Player executed better than the chance deserved' : shotQuality < -0.1 ? '✗ Player wasted a good chance with poor placement' : '~ Execution matched the opportunity'}</span>
                </p>
            </div>
        `;
    }

    // Handle CSV file upload
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const csvText = e.target.result;
            this.parseGameData(csvText);
        };
        reader.readAsText(file);
    }

    // Parse CSV data
    parseGameData(csvText) {
        // Normalize line endings and split
        const lines = csvText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        this.gameData = {
            headers: headers,
            shots: []
        };

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue; // Skip empty lines
            const values = lines[i].split(',');
            const shot = {};
            headers.forEach((header, index) => {
                shot[header] = values[index] ? values[index].trim() : '';
            });
            this.gameData.shots.push(shot);
        }

        // Sort shots by match_minute (chronological order)
        this.gameData.shots.sort((a, b) => {
            const minuteA = parseFloat(a.match_minute) || 0;
            const minuteB = parseFloat(b.match_minute) || 0;
            return minuteA - minuteB;
        });

        // Show analyze button
        this.analyzeShotsBtn.style.display = 'inline-block';

        alert(`Loaded ${this.gameData.shots.length} shots from the game! (Sorted by match minute)`);
    }

    // Show simple message on pitch center
    showPitchMessage(message, color = '#FFC107') {
        const existingLabel = document.getElementById('shot-info-label');
        if (existingLabel) {
            existingLabel.remove();
        }

        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.id = 'shot-info-label';

        const centerX = 525;
        const centerY = 120;

        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('x', centerX - 150);
        bgRect.setAttribute('y', centerY - 20);
        bgRect.setAttribute('width', '300');
        bgRect.setAttribute('height', '40');
        bgRect.setAttribute('fill', '#000');
        bgRect.setAttribute('opacity', '0.85');
        bgRect.setAttribute('rx', '8');
        bgRect.setAttribute('stroke', color);
        bgRect.setAttribute('stroke-width', '2');
        labelGroup.appendChild(bgRect);

        const messageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        messageText.setAttribute('x', centerX);
        messageText.setAttribute('y', centerY + 5);
        messageText.setAttribute('text-anchor', 'middle');
        messageText.setAttribute('fill', color);
        messageText.setAttribute('font-size', '18');
        messageText.setAttribute('font-weight', 'bold');
        messageText.textContent = message;
        labelGroup.appendChild(messageText);

        this.pitch.appendChild(labelGroup);
    }

    // Show match summary on pitch
    showMatchSummaryOnPitch(team1Name, team1Goals, team1XG, team2Name, team2Goals, team2XG) {
        const existingLabel = document.getElementById('shot-info-label');
        if (existingLabel) {
            existingLabel.remove();
        }

        // Check if we have PSxG data
        const xgData = this.teamXGData || {};
        const hasPSxG = xgData.hasPSxGData;

        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.id = 'shot-info-label';

        const centerX = 525;
        const centerY = 100;
        const boxHeight = hasPSxG ? 110 : 70;

        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('x', centerX - 200);
        bgRect.setAttribute('y', centerY - 35);
        bgRect.setAttribute('width', '400');
        bgRect.setAttribute('height', boxHeight);
        bgRect.setAttribute('fill', '#000');
        bgRect.setAttribute('opacity', '0.9');
        bgRect.setAttribute('rx', '8');
        bgRect.setAttribute('stroke', '#4CAF50');
        bgRect.setAttribute('stroke-width', '3');
        labelGroup.appendChild(bgRect);

        // Title
        const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        titleText.setAttribute('x', centerX);
        titleText.setAttribute('y', centerY - 15);
        titleText.setAttribute('text-anchor', 'middle');
        titleText.setAttribute('fill', '#FFC107');
        titleText.setAttribute('font-size', '14');
        titleText.setAttribute('font-weight', 'bold');
        titleText.textContent = '⚽ MATCH SUMMARY ⚽';
        labelGroup.appendChild(titleText);

        // Score line
        const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        scoreText.setAttribute('x', centerX);
        scoreText.setAttribute('y', centerY + 5);
        scoreText.setAttribute('text-anchor', 'middle');
        scoreText.setAttribute('fill', '#fff');
        scoreText.setAttribute('font-size', '16');
        scoreText.setAttribute('font-weight', 'bold');
        scoreText.textContent = `${team1Name} ${team1Goals} - ${team2Goals} ${team2Name}`;
        labelGroup.appendChild(scoreText);

        // xG line
        const xgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        xgText.setAttribute('x', centerX);
        xgText.setAttribute('y', centerY + 25);
        xgText.setAttribute('text-anchor', 'middle');
        xgText.setAttribute('fill', '#4CAF50');
        xgText.setAttribute('font-size', '14');
        xgText.textContent = `xG: ${team1XG.toFixed(2)} - ${team2XG.toFixed(2)}`;
        labelGroup.appendChild(xgText);

        // PSxG line (if available)
        if (hasPSxG) {
            const psxgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            psxgText.setAttribute('x', centerX);
            psxgText.setAttribute('y', centerY + 45);
            psxgText.setAttribute('text-anchor', 'middle');
            psxgText.setAttribute('fill', '#E040FB');
            psxgText.setAttribute('font-size', '14');
            const t1PSxG = xgData.team1PSxG || 0;
            const t2PSxG = xgData.team2PSxG || 0;
            psxgText.textContent = `PSxG: ${t1PSxG.toFixed(2)} - ${t2PSxG.toFixed(2)}`;
            labelGroup.appendChild(psxgText);

            // Variance line
            const varianceText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            varianceText.setAttribute('x', centerX);
            varianceText.setAttribute('y', centerY + 65);
            varianceText.setAttribute('text-anchor', 'middle');
            varianceText.setAttribute('font-size', '12');

            const t1Var = xgData.team1Variance;
            const t2Var = xgData.team2Variance;
            const t1VarStr = t1Var !== null ? (t1Var >= 0 ? '+' : '') + t1Var.toFixed(2) : 'N/A';
            const t2VarStr = t2Var !== null ? (t2Var >= 0 ? '+' : '') + t2Var.toFixed(2) : 'N/A';
            const t1Color = t1Var !== null ? (t1Var >= 0 ? '#4CAF50' : '#f44336') : '#888';
            const t2Color = t2Var !== null ? (t2Var >= 0 ? '#4CAF50' : '#f44336') : '#888';

            varianceText.innerHTML = '';
            const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan1.setAttribute('fill', '#888');
            tspan1.textContent = 'Variance: ';
            varianceText.appendChild(tspan1);

            const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan2.setAttribute('fill', t1Color);
            tspan2.textContent = t1VarStr;
            varianceText.appendChild(tspan2);

            const tspan3 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan3.setAttribute('fill', '#888');
            tspan3.textContent = ' - ';
            varianceText.appendChild(tspan3);

            const tspan4 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan4.setAttribute('fill', t2Color);
            tspan4.textContent = t2VarStr;
            varianceText.appendChild(tspan4);

            labelGroup.appendChild(varianceText);
        }

        this.pitch.appendChild(labelGroup);
    }

    // Show shot analysis modal
    async showShotAnalysisModal() {
        if (!this.gameData) {
            alert('Please upload a game data file first!');
            return;
        }

        // Show calculating message on pitch
        this.showPitchMessage('⏳ Calculating xG for all shots...', '#FFC107');

        // Populate game info
        const gameDetails = document.getElementById('game-details');

        // Clear previous data first
        gameDetails.innerHTML = '<p>⏳ Loading match data...</p>';

        const matchId = this.gameData.shots[0].match_id;
        const totalShots = this.gameData.shots.length;

        // Get team names from metadata (if available) or from unique teams in data
        let team1Name = this.gameData.shots[0]?.team1_name;
        let team2Name = this.gameData.shots[0]?.team2_name;

        // If team names not in metadata, extract from unique team values
        if (!team1Name || !team2Name) {
            const uniqueTeams = [...new Set(this.gameData.shots.map(s => s.team || s.team_name))];
            team1Name = uniqueTeams[0] || 'Team 1';
            team2Name = uniqueTeams[1] || 'Team 2';
        }

        // Filter shots by actual team names
        const team1Shots = this.gameData.shots.filter(s => (s.team || s.team_name) === team1Name);
        const team2Shots = this.gameData.shots.filter(s => (s.team || s.team_name) === team2Name);

        // Count goals by team (or use metadata if available)
        const team1Goals = this.gameData.shots[0]?.team1_goals
            ? parseInt(this.gameData.shots[0].team1_goals)
            : team1Shots.filter(shot => shot.goal_scored === 'True').length;
        const team2Goals = this.gameData.shots[0]?.team2_goals
            ? parseInt(this.gameData.shots[0].team2_goals)
            : team2Shots.filter(shot => shot.goal_scored === 'True').length;
        const totalGoals = team1Goals + team2Goals;

        gameDetails.innerHTML = `
            <strong>Match ID:</strong> ${matchId}<br>
            <strong>Score:</strong> ${team1Name} ${team1Goals} - ${team2Goals} ${team2Name}<br>
            <strong>Total Shots:</strong> ${totalShots} (${team1Name}: ${team1Shots.length}, ${team2Name}: ${team2Shots.length})<br>
            <strong>Total Goals:</strong> ${totalGoals}<br>
            <strong>Overall Conversion:</strong> ${((totalGoals / totalShots) * 100).toFixed(1)}%
        `;

        // Store match info for later use when navigating shots
        this.currentMatchInfo = {
            team1Name: team1Name,
            team2Name: team2Name,
            team1Goals: team1Goals,
            team2Goals: team2Goals
        };

        // Calculate xG for all shots and verify accuracy
        const xgData = await this.calculateTeamXG(team1Shots, team2Shots, team1Name, team2Name, team1Goals, team2Goals);

        // Store xG data for later use
        this.teamXGData = xgData;

        // Show final score summary on pitch
        if (xgData) {
            this.showMatchSummaryOnPitch(team1Name, team1Goals, xgData.team1XG, team2Name, team2Goals, xgData.team2XG);
        }

        // Populate shots list
        const shotsContainer = document.getElementById('shots-container');
        shotsContainer.innerHTML = '';

        this.gameData.shots.forEach((shot, index) => {
            const shotItem = document.createElement('div');
            shotItem.className = 'shot-item';
            shotItem.style.cssText = `
                padding: 12px;
                margin: 8px 0;
                background: ${shot.goal_scored === 'True' ? '#2d5f2d' : '#2c2c2c'};
                border-left: 4px solid ${shot.goal_scored === 'True' ? '#4CAF50' : '#FF9800'};
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.2s;
            `;

            shotItem.onmouseover = () => shotItem.style.background = shot.goal_scored === 'True' ? '#3d7f3d' : '#3c3c3c';
            shotItem.onmouseout = () => shotItem.style.background = shot.goal_scored === 'True' ? '#2d5f2d' : '#2c2c2c';

            const teamName = shot.team || shot.team_name || 'Team undefined';
            const targetGoalIcon = shot.target_goal === 'left' ? '←⚽' : '⚽→';

            shotItem.innerHTML = `
                <strong>${shot.player_name || 'Player ' + shot.player_id}</strong> (${teamName}) ${targetGoalIcon} - Min ${shot.match_minute}'<br>
                <small>
                    Position: (${parseFloat(shot.x_coord).toFixed(1)}, ${parseFloat(shot.y_coord).toFixed(1)}) |
                    ${shot.body_part} | ${shot.shot_type} |
                    ${shot.goal_scored === 'True' ? '⚽ GOAL' : '❌ Miss'}
                </small>
            `;

            shotItem.onclick = () => this.analyzeShotFromGame(shot, index);
            shotsContainer.appendChild(shotItem);
        });

        this.shotAnalysisModal.style.display = 'block';

        // Show navigation buttons (main only)
        this.nextShotBtnMain.style.display = 'inline-block';
        this.prevShotBtnMain.style.display = 'inline-block';
        this.currentShotIndex = 0;
        this.updateNavigationButtons();
    }

    // Navigate between shots
    navigateShot(direction) {
        if (!this.gameData || !this.gameData.shots) return;

        this.currentShotIndex += direction;

        // Wrap around
        if (this.currentShotIndex < 0) {
            this.currentShotIndex = this.gameData.shots.length - 1;
        } else if (this.currentShotIndex >= this.gameData.shots.length) {
            this.currentShotIndex = 0;
        }

        const shot = this.gameData.shots[this.currentShotIndex];
        this.analyzeShotFromGame(shot, this.currentShotIndex);
        this.updateNavigationButtons();
    }

    // Update navigation button states
    updateNavigationButtons() {
        if (!this.gameData || !this.gameData.shots) return;

        const totalShots = this.gameData.shots.length;

        // Update main button - icon only with title tooltip
        this.nextShotBtnMain.textContent = `⏭️`;
        this.nextShotBtnMain.title = `Next (${this.currentShotIndex + 1}/${totalShots})`;
        this.prevShotBtnMain.textContent = `⏮️`;
        this.prevShotBtnMain.title = `Previous (${this.currentShotIndex + 1}/${totalShots})`;
    }

    // Close shot analysis modal
    closeShotAnalysisModal() {
        this.shotAnalysisModal.style.display = 'none';
    }

    // Calculate xG and PSxG for both teams
    async calculateTeamXG(team1Shots, team2Shots, team1Name, team2Name, team1Goals, team2Goals) {
        const teamXGSummary = document.getElementById('team-xg-summary');
        const xgComparison = document.getElementById('xg-comparison');
        const xgAnalysis = document.getElementById('xg-analysis');

        // Clear previous data first
        xgComparison.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">⏳ Calculating xG & PSxG for all shots... This may take a moment.</p>';
        xgAnalysis.innerHTML = '';
        teamXGSummary.style.display = 'block';

        let team1XG = 0;
        let team2XG = 0;
        let team1PSxG = 0;
        let team2PSxG = 0;
        let team1OnTarget = 0;
        let team2OnTarget = 0;
        let failedCount = 0;

        // Arrays to store xG values and outcomes for accuracy calculation
        const allXGValues = [];
        const allOutcomes = [];
        const allShots = [...team1Shots, ...team2Shots];

        // Calculate xG and PSxG for Team 1
        for (let i = 0; i < team1Shots.length; i++) {
            xgComparison.innerHTML = `<p style="text-align: center; grid-column: 1 / -1;">⏳ Calculating ${team1Name} shots... (${i + 1}/${team1Shots.length})</p>`;
            const xg = await this.calculateShotXG(team1Shots[i]);
            if (xg === null) {
                failedCount++;
            } else {
                team1XG += xg;
                allXGValues.push(xg);
                allOutcomes.push(team1Shots[i].goal_scored === 'True' ? 1 : 0);

                // Calculate PSxG if data available
                const psxg = this.calculateShotPSxG(team1Shots[i], xg);
                if (psxg !== null) {
                    team1PSxG += psxg;
                    team1OnTarget++;
                }
            }
        }

        // Calculate xG and PSxG for Team 2
        for (let i = 0; i < team2Shots.length; i++) {
            xgComparison.innerHTML = `<p style="text-align: center; grid-column: 1 / -1;">⏳ Calculating ${team2Name} shots... (${i + 1}/${team2Shots.length})</p>`;
            const xg = await this.calculateShotXG(team2Shots[i]);
            if (xg === null) {
                failedCount++;
            } else {
                team2XG += xg;
                allXGValues.push(xg);
                allOutcomes.push(team2Shots[i].goal_scored === 'True' ? 1 : 0);

                // Calculate PSxG if data available
                const psxg = this.calculateShotPSxG(team2Shots[i], xg);
                if (psxg !== null) {
                    team2PSxG += psxg;
                    team2OnTarget++;
                }
            }
        }

        // Check if API failed
        if (failedCount > 0) {
            const apiUrl = (this.apiUrlInput && this.apiUrlInput.value) || 'http://localhost:8000/calculate_xg';
            xgComparison.innerHTML = `<p style="text-align: center; grid-column: 1 / -1; color: #FF5722;">
                ⚠️ Warning: ${failedCount} shots failed to calculate. Make sure the API server is running at ${apiUrl}
            </p>`;
            return;
        }

        // Calculate model accuracy
        this.calculateModelAccuracy(allXGValues, allOutcomes, allShots);

        // Calculate variances
        const team1Variance = team1OnTarget > 0 ? team1PSxG - team1XG : null;
        const team2Variance = team2OnTarget > 0 ? team2PSxG - team2XG : null;
        const hasPSxGData = team1OnTarget > 0 || team2OnTarget > 0;

        // Display team xG/PSxG comparison
        xgComparison.innerHTML = `
            <div style="text-align: center; padding: 15px; background: #2c2c2c; border-radius: 5px;">
                <h4 style="margin-top: 0; color: #4CAF50;">${team1Name}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr ${hasPSxGData ? '1fr' : ''}; gap: 10px; margin: 10px 0;">
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 5px;">
                        <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${team1XG.toFixed(2)}</div>
                        <div style="font-size: 11px; color: #888;">xG</div>
                    </div>
                    ${hasPSxGData ? `
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 5px;">
                        <div style="font-size: 24px; font-weight: bold; color: #E040FB;">${team1OnTarget > 0 ? team1PSxG.toFixed(2) : 'N/A'}</div>
                        <div style="font-size: 11px; color: #888;">PSxG (${team1OnTarget} on target)</div>
                    </div>
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 5px;">
                        <div style="font-size: 24px; font-weight: bold; color: ${team1Variance !== null ? (team1Variance >= 0 ? '#4CAF50' : '#f44336') : '#888'};">
                            ${team1Variance !== null ? (team1Variance >= 0 ? '+' : '') + team1Variance.toFixed(2) : 'N/A'}
                        </div>
                        <div style="font-size: 11px; color: #888;">Variance</div>
                    </div>
                    ` : `
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 5px;">
                        <div style="font-size: 24px; font-weight: bold;">${team1Goals}</div>
                        <div style="font-size: 11px; color: #888;">Goals</div>
                    </div>
                    `}
                </div>
                <div style="margin-top: 8px; font-size: 14px;">
                    <span style="font-weight: bold;">${team1Goals}</span> Goals |
                    <span style="color: ${team1Goals > team1XG ? '#4CAF50' : team1Goals < team1XG ? '#FF9800' : '#fff'};">
                        ${team1Goals > team1XG ? '✅ Over' : team1Goals < team1XG ? '⚠️ Under' : '✓ Even'}
                    </span>
                    (${team1Goals > team1XG ? '+' : ''}${(team1Goals - team1XG).toFixed(2)})
                </div>
                ${team1Variance !== null ? `
                <div style="margin-top: 5px; font-size: 12px; color: ${team1Variance >= 0 ? '#4CAF50' : '#f44336'};">
                    ${team1Variance >= 0 ? '🎯 Good shot placement' : '❌ Poor shot placement'}
                </div>
                ` : ''}
            </div>
            <div style="text-align: center; padding: 15px; background: #2c2c2c; border-radius: 5px;">
                <h4 style="margin-top: 0; color: #FF5722;">${team2Name}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr ${hasPSxGData ? '1fr' : ''}; gap: 10px; margin: 10px 0;">
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 5px;">
                        <div style="font-size: 24px; font-weight: bold; color: #FF5722;">${team2XG.toFixed(2)}</div>
                        <div style="font-size: 11px; color: #888;">xG</div>
                    </div>
                    ${hasPSxGData ? `
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 5px;">
                        <div style="font-size: 24px; font-weight: bold; color: #E040FB;">${team2OnTarget > 0 ? team2PSxG.toFixed(2) : 'N/A'}</div>
                        <div style="font-size: 11px; color: #888;">PSxG (${team2OnTarget} on target)</div>
                    </div>
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 5px;">
                        <div style="font-size: 24px; font-weight: bold; color: ${team2Variance !== null ? (team2Variance >= 0 ? '#4CAF50' : '#f44336') : '#888'};">
                            ${team2Variance !== null ? (team2Variance >= 0 ? '+' : '') + team2Variance.toFixed(2) : 'N/A'}
                        </div>
                        <div style="font-size: 11px; color: #888;">Variance</div>
                    </div>
                    ` : `
                    <div style="background: #1a1a1a; padding: 10px; border-radius: 5px;">
                        <div style="font-size: 24px; font-weight: bold;">${team2Goals}</div>
                        <div style="font-size: 11px; color: #888;">Goals</div>
                    </div>
                    `}
                </div>
                <div style="margin-top: 8px; font-size: 14px;">
                    <span style="font-weight: bold;">${team2Goals}</span> Goals |
                    <span style="color: ${team2Goals > team2XG ? '#4CAF50' : team2Goals < team2XG ? '#FF9800' : '#fff'};">
                        ${team2Goals > team2XG ? '✅ Over' : team2Goals < team2XG ? '⚠️ Under' : '✓ Even'}
                    </span>
                    (${team2Goals > team2XG ? '+' : ''}${(team2Goals - team2XG).toFixed(2)})
                </div>
                ${team2Variance !== null ? `
                <div style="margin-top: 5px; font-size: 12px; color: ${team2Variance >= 0 ? '#4CAF50' : '#f44336'};">
                    ${team2Variance >= 0 ? '🎯 Good shot placement' : '❌ Poor shot placement'}
                </div>
                ` : ''}
            </div>
        `;

        // Generate analysis text
        const xgDiff = Math.abs(team1XG - team2XG);
        const team1Efficiency = team1XG > 0 ? ((team1Goals / team1XG) * 100).toFixed(1) : 'N/A';
        const team2Efficiency = team2XG > 0 ? ((team2Goals / team2XG) * 100).toFixed(1) : 'N/A';

        let analysisText = '<strong>📊 Match Analysis:</strong><br>';

        // Who should have won based on xG
        if (xgDiff > 0.5) {
            const dominantTeam = team1XG > team2XG ? team1Name : team2Name;
            const dominantXG = team1XG > team2XG ? team1XG : team2XG;
            analysisText += `<strong>${dominantTeam}</strong> created better chances (${dominantXG.toFixed(2)} vs ${(team1XG > team2XG ? team2XG : team1XG).toFixed(2)} xG).<br>`;
        } else {
            analysisText += `Both teams created similar chances (${team1XG.toFixed(2)} vs ${team2XG.toFixed(2)} xG).<br>`;
        }

        // Result vs Expected
        const xgWinner = team1XG > team2XG ? team1Name : team2XG > team1XG ? team2Name : 'Draw';
        const actualWinner = team1Goals > team2Goals ? team1Name : team2Goals > team1Goals ? team2Name : 'Draw';

        if (xgWinner !== actualWinner && xgWinner !== 'Draw' && actualWinner !== 'Draw') {
            analysisText += `⚠️ xG predicted <strong>${xgWinner}</strong>, but <strong>${actualWinner}</strong> won.<br>`;
        } else if (xgWinner === actualWinner && xgWinner !== 'Draw') {
            analysisText += `✅ Result matches xG - <strong>${actualWinner}</strong> deserved to win.<br>`;
        }

        // PSxG Analysis
        if (hasPSxGData) {
            analysisText += `<br><strong>🎯 Shot Placement Analysis:</strong><br>`;
            if (team1Variance !== null) {
                analysisText += `${team1Name}: ${team1Variance >= 0 ? '✅' : '❌'} ${team1Variance >= 0 ? '+' : ''}${team1Variance.toFixed(2)} variance (${team1OnTarget} on-target shots)<br>`;
            }
            if (team2Variance !== null) {
                analysisText += `${team2Name}: ${team2Variance >= 0 ? '✅' : '❌'} ${team2Variance >= 0 ? '+' : ''}${team2Variance.toFixed(2)} variance (${team2OnTarget} on-target shots)<br>`;
            }

            // Who had better finishing
            if (team1Variance !== null && team2Variance !== null) {
                const betterFinisher = team1Variance > team2Variance ? team1Name : team2Name;
                analysisText += `<strong>${betterFinisher}</strong> had better shot placement overall.`;
            }
        }

        // Efficiency
        analysisText += `<br><br><strong>⚡ Finishing Efficiency:</strong><br>`;
        analysisText += `${team1Name}: ${team1Efficiency}% (${team1Goals} from ${team1XG.toFixed(2)} xG)<br>`;
        analysisText += `${team2Name}: ${team2Efficiency}% (${team2Goals} from ${team2XG.toFixed(2)} xG)`;

        xgAnalysis.innerHTML = analysisText;

        // Return data for display on pitch
        return {
            team1XG: team1XG,
            team2XG: team2XG,
            team1PSxG: team1PSxG,
            team2PSxG: team2PSxG,
            team1Variance: team1Variance,
            team2Variance: team2Variance,
            hasPSxGData: hasPSxGData
        };
    }

    // Calculate PSxG for a single shot (using CSV data)
    calculateShotPSxG(shot, xg) {
        const shotEndX = parseFloat(shot.shot_end_x);
        const shotEndY = parseFloat(shot.shot_end_y);
        const shotSpeed = parseFloat(shot.shot_speed) || 85;

        // Handle various formats for on_target (string, boolean, etc.)
        const onTargetValue = shot.on_target;
        const onTarget = onTargetValue === true ||
                         onTargetValue === 'True' ||
                         onTargetValue === 'true' ||
                         onTargetValue === '1' ||
                         onTargetValue === 1 ||
                         (!isNaN(shotEndX) && !isNaN(shotEndY) && shotEndX > 0 && shotEndY > 0);

        // If not on target or missing end coordinates, no PSxG
        if (!onTarget || isNaN(shotEndX) || isNaN(shotEndY) || (shotEndX === 0 && shotEndY === 0)) {
            return null;
        }

        // Get shot distance (use default if not available)
        const shotDistance = parseFloat(shot.distance_to_goal) || 15;

        // GK position in goal frame (estimate from pitch position or use defaults)
        const gkX = 3.66; // Center of goal
        const gkY = 0.30; // Ground level

        // Calculate physics
        const GOAL_WIDTH = 7.32;
        const GOAL_HEIGHT = 2.44;
        const ballX = Math.max(0, Math.min(GOAL_WIDTH, shotEndX));
        const ballY = Math.max(0, Math.min(GOAL_HEIGHT, shotEndY));

        const horizontalDist = Math.abs(ballX - gkX);
        const verticalDist = Math.abs(ballY - gkY);
        const gkDiveDistance = Math.sqrt(horizontalDist * horizontalDist + verticalDist * verticalDist);

        const speedMs = shotSpeed / 3.6;
        const ballTravelTime = shotDistance / speedMs;

        const GK_REACTION_TIME = 0.15;
        const GK_DIVE_SPEED_H = 4.0;
        const GK_DIVE_SPEED_V = 2.5;
        const gkReachTime = GK_REACTION_TIME + Math.max(horizontalDist / GK_DIVE_SPEED_H, verticalDist / GK_DIVE_SPEED_V);

        const timeMargin = gkReachTime - ballTravelTime;

        // Calculate PSxG using same formula
        let psxg;
        if (timeMargin > 0.3) {
            psxg = 0.95;
        } else if (timeMargin > 0.15) {
            psxg = 0.75 + (timeMargin - 0.15) * 1.33;
        } else if (timeMargin > 0.05) {
            psxg = 0.55 + (timeMargin - 0.05) * 2.0;
        } else if (timeMargin > -0.05) {
            psxg = 0.15 + (timeMargin + 0.05) * 4.0;
        } else if (timeMargin > -0.15) {
            psxg = 0.08 + (timeMargin + 0.15) * 0.70;
        } else if (timeMargin > -0.3) {
            psxg = 0.03 + (timeMargin + 0.3) * 0.33;
        } else {
            psxg = 0.03;
        }

        // Apply bonuses
        if (ballY > 2.0) psxg = Math.min(0.99, psxg + 0.12);
        if (ballX < 0.5 || ballX > GOAL_WIDTH - 0.5) psxg = Math.min(0.99, psxg + 0.10);
        if (gkDiveDistance < 0.5) psxg = Math.max(0.03, psxg * 0.2);

        return Math.max(0.01, Math.min(0.99, psxg));
    }

    // Calculate xG for a single shot (helper function)
    async calculateShotXG(shot) {
        try {
            // Prepare defenders array
            const defenders = [];
            for (let i = 1; i <= 8; i++) {
                const defX = parseFloat(shot[`def${i}_x`]);
                const defY = parseFloat(shot[`def${i}_y`]);
                if (!isNaN(defX) && !isNaN(defY) && defX > 0 && defY > 0) {
                    defenders.push([defX, defY]);
                }
            }

            // Prepare shot parameters
            const shotParams = {
                body_part: shot.body_part || 'Right Foot',
                shot_type: shot.shot_type || 'Shot',
                situation: shot.situation || 'Open Play',
                previous_action: shot.previous_action || 'Pass',
                player_position: shot.player_position || 'Forward',
                first_touch: shot.first_touch === 'True',
                under_pressure: shot.under_pressure === 'True',
                match_time: parseInt(shot.match_minute) || 45,
                shot_power: parseFloat(shot.shot_power) || 75,
                shot_placement: parseFloat(shot.shot_placement) || 5,
                score_diff: parseInt(shot.match_score_diff) || 0
            };

            // Prepare shot data for API in the format it expects
            const shotData = {
                shot_x: parseFloat(shot.x_coord),
                shot_y: parseFloat(shot.y_coord),
                gk_x: parseFloat(shot.gk_x),
                gk_y: parseFloat(shot.gk_y),
                defenders: defenders,
                shot_params: shotParams,
                target_goal: shot.target_goal || 'right'
            };

            // Call API to get xG
            const apiUrl = (this.apiUrlInput && this.apiUrlInput.value) || 'http://localhost:8000/calculate_xg';
            console.log('Calling API:', apiUrl, 'with data:', shotData);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shotData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('API response:', result);
                return result.xg || 0;
            } else {
                console.error('API call failed with status:', response.status);
                return null; // Return null to indicate failure
            }
        } catch (error) {
            console.error('Error calculating xG for shot:', error);
            return null; // Return null to indicate failure
        }
    }

    // Analyze individual shot from game
    async analyzeShotFromGame(shot, index) {
        // Update current shot index
        this.currentShotIndex = index;
        this.updateNavigationButtons();

        // First, set the target goal based on the shot data
        const targetGoal = shot.target_goal || 'right'; // Default to right if not specified

        // Get current target goal setting
        const currentTarget = document.querySelector('input[name="target"]:checked').value;

        // Only switch if needed
        if (currentTarget !== targetGoal) {
            // Set the radio button
            document.querySelector(`input[name="target"][value="${targetGoal}"]`).checked = true;

            // Update the target goal in the calculator
            this.updateTargetGoal();
        }

        // Apply shot parameters to the pitch
        const shotX = parseFloat(shot.x_coord) * 10; // Scale to SVG coordinates
        const shotY = parseFloat(shot.y_coord) * 10;
        const gkX = parseFloat(shot.gk_x) * 10;
        const gkY = parseFloat(shot.gk_y) * 10;

        // Update positions
        this.positions.shot.x = shotX;
        this.positions.shot.y = shotY;
        this.positions.gk.x = gkX;
        this.positions.gk.y = gkY;

        // Update SVG elements for shot and goalkeeper
        this.shotPlayer.setAttribute('cx', shotX);
        this.shotPlayer.setAttribute('cy', shotY);
        this.goalkeeper.setAttribute('cx', gkX);
        this.goalkeeper.setAttribute('cy', gkY);

        // Add shot info label with match summary above player name
        const existingLabel = document.getElementById('shot-info-label');
        if (existingLabel) {
            existingLabel.remove();
        }

        const playerName = shot.player_name || `Player ${shot.player_id}`;
        const teamName = shot.team || 'Team';
        const outcome = shot.goal_scored === 'True' ? '⚽ GOAL' : '❌ MISS';
        const outcomeColor = shot.goal_scored === 'True' ? '#4CAF50' : '#F44336';

        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.id = 'shot-info-label';

        const centerX = 525;
        const centerY = 100;

        // Get match summary - use shot data (which contains the correct match info for each shot)
        const team1Name = shot.team1_name || this.currentMatchInfo?.team1Name || 'Team 1';
        const team2Name = shot.team2_name || this.currentMatchInfo?.team2Name || 'Team 2';
        const team1Goals = shot.team1_goals ? parseInt(shot.team1_goals) : (this.currentMatchInfo?.team1Goals ?? 0);
        const team2Goals = shot.team2_goals ? parseInt(shot.team2_goals) : (this.currentMatchInfo?.team2Goals ?? 0);

        // Get xG values if available
        const hasXG = this.teamXGData && this.teamXGData.team1XG !== undefined;
        const team1XG = hasXG ? this.teamXGData.team1XG : 0;
        const team2XG = hasXG ? this.teamXGData.team2XG : 0;

        // Background rectangle (taller to fit xG line)
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('x', centerX - 180);
        bgRect.setAttribute('y', centerY - 45);
        bgRect.setAttribute('width', '360');
        bgRect.setAttribute('height', hasXG ? 110 : 95);
        bgRect.setAttribute('fill', '#000');
        bgRect.setAttribute('opacity', '0.9');
        bgRect.setAttribute('rx', '8');
        bgRect.setAttribute('stroke', outcomeColor);
        bgRect.setAttribute('stroke-width', '3');
        labelGroup.appendChild(bgRect);

        // Score line (top)
        const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        scoreText.setAttribute('x', centerX);
        scoreText.setAttribute('y', centerY - 25);
        scoreText.setAttribute('text-anchor', 'middle');
        scoreText.setAttribute('fill', '#FFC107');
        scoreText.setAttribute('font-size', '14');
        scoreText.setAttribute('font-weight', 'bold');
        scoreText.textContent = `${team1Name} ${team1Goals} - ${team2Goals} ${team2Name}`;
        labelGroup.appendChild(scoreText);

        // xG line (if available)
        if (hasXG) {
            const xgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            xgText.setAttribute('x', centerX);
            xgText.setAttribute('y', centerY - 8);
            xgText.setAttribute('text-anchor', 'middle');
            xgText.setAttribute('fill', '#4CAF50');
            xgText.setAttribute('font-size', '12');
            xgText.textContent = `xG: ${team1XG.toFixed(2)} - ${team2XG.toFixed(2)}`;
            labelGroup.appendChild(xgText);
        }

        // Separator line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', centerX - 160);
        line.setAttribute('y1', centerY + 3);
        line.setAttribute('x2', centerX + 160);
        line.setAttribute('y2', centerY + 3);
        line.setAttribute('stroke', '#444');
        line.setAttribute('stroke-width', '1');
        labelGroup.appendChild(line);

        // Player name (adjusted position)
        const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.setAttribute('x', centerX);
        nameText.setAttribute('y', centerY + 18);
        nameText.setAttribute('text-anchor', 'middle');
        nameText.setAttribute('fill', '#fff');
        nameText.setAttribute('font-size', '16');
        nameText.setAttribute('font-weight', 'bold');
        nameText.textContent = `${playerName} (${teamName})`;
        labelGroup.appendChild(nameText);

        // Outcome text (adjusted position)
        const outcomeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        outcomeText.setAttribute('x', centerX);
        outcomeText.setAttribute('y', centerY + 40);
        outcomeText.setAttribute('text-anchor', 'middle');
        outcomeText.setAttribute('fill', outcomeColor);
        outcomeText.setAttribute('font-size', '20');
        outcomeText.setAttribute('font-weight', 'bold');
        outcomeText.textContent = outcome;
        labelGroup.appendChild(outcomeText);

        // Check if StatsBomb xG is available (will be used later after xG calculation)
        const hasStatsBombXG = shot.statsbomb_xg !== undefined && shot.statsbomb_xg !== null && shot.statsbomb_xg !== '';

        this.pitch.appendChild(labelGroup);

        // Clear existing defenders
        this.clearDefenders();

        // Add defenders from shot data
        for (let i = 1; i <= 8; i++) {
            const defX = parseFloat(shot[`def${i}_x`]);
            const defY = parseFloat(shot[`def${i}_y`]);

            if (!isNaN(defX) && !isNaN(defY) && defX > 0 && defY > 0) {
                const scaledDefX = defX * 10;
                const scaledDefY = defY * 10;

                // Create the defender visual element
                this.createDefender(scaledDefX, scaledDefY);

                // Add to positions array
                this.positions.defenders.push({
                    x: scaledDefX,
                    y: scaledDefY
                });
            }
        }

        // Update the visual display
        this.updateDisplay();

        // Update Voronoi overlay if it's visible
        this.updateVoronoiIfVisible();

        // Set shot parameters
        document.getElementById('body-part').value = shot.body_part || 'Right Foot';
        document.getElementById('shot-type').value = shot.shot_type || 'Shot';

        // Set situation - add it to dropdown if it doesn't exist
        const situationSelect = document.getElementById('situation');
        const situationValue = shot.situation || 'Open Play';
        const situationExists = Array.from(situationSelect.options).some(opt => opt.value === situationValue);

        if (!situationExists && situationValue && situationValue !== 'Open Play') {
            // Add the new situation as an option
            const newOption = document.createElement('option');
            newOption.value = situationValue;
            newOption.textContent = situationValue;
            situationSelect.appendChild(newOption);
        }
        situationSelect.value = situationValue;

        // Set previous action - add it to dropdown if it doesn't exist
        const previousActionSelect = document.getElementById('previous-action');
        const previousActionValue = shot.previous_action || 'Pass';
        const previousActionExists = Array.from(previousActionSelect.options).some(opt => opt.value === previousActionValue);

        if (!previousActionExists && previousActionValue && previousActionValue !== 'Pass') {
            const newOption = document.createElement('option');
            newOption.value = previousActionValue;
            newOption.textContent = previousActionValue;
            previousActionSelect.appendChild(newOption);
        }
        previousActionSelect.value = previousActionValue;

        // Set player position - add it to dropdown if it doesn't exist
        const positionSelect = document.getElementById('player-position');
        const positionValue = shot.player_position || 'Forward';
        const positionExists = Array.from(positionSelect.options).some(opt => opt.value === positionValue);

        if (!positionExists && positionValue && positionValue !== 'Forward') {
            // Add the new position as an option
            const newOption = document.createElement('option');
            newOption.value = positionValue;
            newOption.textContent = positionValue;
            positionSelect.appendChild(newOption);
        }
        positionSelect.value = positionValue;
        document.getElementById('match-time').value = shot.match_minute || 45;
        document.getElementById('shot-power').value = shot.shot_power || 75;
        document.getElementById('shot-placement').value = shot.shot_placement || 5;

        // Use score difference directly from CSV (already calculated from shooter's perspective)
        const scoreDiff = shot.match_score_diff !== undefined && shot.match_score_diff !== null && shot.match_score_diff !== ''
            ? parseInt(shot.match_score_diff)
            : 0;

        document.getElementById('score-diff').value = scoreDiff;

        // Update the visual score display boxes (use score at time of shot if available)
        if (shot.team1_name && shot.team2_name) {
            document.getElementById('team1-display-name').textContent = shot.team1_name;
            document.getElementById('team2-display-name').textContent = shot.team2_name;
            // Use score at time of shot if available, otherwise fall back to final score
            document.getElementById('team1-display-score').textContent = shot.team1_goals_at_shot !== undefined ? shot.team1_goals_at_shot : (shot.team1_goals || 0);
            document.getElementById('team2-display-score').textContent = shot.team2_goals_at_shot !== undefined ? shot.team2_goals_at_shot : (shot.team2_goals || 0);
        }
        document.getElementById('first-touch').checked = shot.first_touch === 'True';
        document.getElementById('under-pressure').checked = shot.under_pressure === 'True';

        // Update display to reflect the new positions (updates sliders and position text)
        this.updateDisplay();

        // Update slider displays for shot quality
        document.getElementById('shot-power-value').textContent = shot.shot_power || 75;
        document.getElementById('shot-placement-value').textContent = shot.shot_placement || 5;

        // Calculate xG and get the result directly
        let calculatedXG = 0;
        try {
            const result = await this.calculateXGFromAPI();
            calculatedXG = result.xg;
            this.displayResult(calculatedXG);
        } catch (error) {
            console.error('Error calculating xG:', error);
            calculatedXG = 0.1;
            this.displayResult(calculatedXG);
        }

        // Pass xG value and outcome to PSxG calculator for combined display
        if (window.psxgCalculator) {
            const isGoal = shot.goal_scored === 'True';
            const isOnTarget = isGoal || shot.on_target === 'True';
            window.psxgCalculator.setCurrentXG(calculatedXG, isGoal, isOnTarget);
        }

        // Update pitch label with calculated xG comparison (only for StatsBomb data)
        const pitchLabel = document.getElementById('shot-info-label');
        if (pitchLabel) {
            // Always remove old comparison text first
            const oldComparison = pitchLabel.querySelector('.xg-comparison');
            if (oldComparison) {
                oldComparison.remove();
            }

            // Only add comparison if StatsBomb xG is available
            if (hasStatsBombXG) {
                const ourXG = (calculatedXG * 100).toFixed(1) + '%';
                const statsbombXG = (parseFloat(shot.statsbomb_xg) * 100).toFixed(1) + '%';

                const comparisonText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                comparisonText.setAttribute('class', 'xg-comparison');
                comparisonText.setAttribute('x', 525);
                comparisonText.setAttribute('y', 158);
                comparisonText.setAttribute('text-anchor', 'middle');
                comparisonText.setAttribute('fill', '#FFD700');
                comparisonText.setAttribute('font-size', '13');
                comparisonText.setAttribute('font-weight', 'bold');
                comparisonText.textContent = `Our xG: ${ourXG} | StatsBomb: ${statsbombXG}`;
                pitchLabel.appendChild(comparisonText);
            }
        }

        // Update xG grid if it's visible
        const xgGrid = document.getElementById('xg-grid');
        console.log(`📊 xG Grid status: ${xgGrid ? (xgGrid.style.display === 'none' ? 'hidden' : 'visible') : 'not found'}`);

        if (xgGrid && xgGrid.style.display !== 'none') {
            console.log('🔄 Grid is visible - updating for shot #' + (index + 1) + '...');
            await this.updateXGGrid();
        } else if (xgGrid && this.currentShotIndex === 0) {
            // Show hint on first shot
            console.log('💡 Tip: Toggle the xG Grid to see how shot probabilities change across the pitch with current GK/defender positions!');
        }

        // Show result in modal (if elements exist)
        const resultDiv = document.getElementById('shot-xg-result');
        const detailsDiv = document.getElementById('xg-result-details');

        const actualOutcome = shot.goal_scored === 'True' ? '⚽ GOAL' : '❌ Miss';
        const currentXG = this.xgDisplay.textContent;

        // Reuse hasStatsBombXG variable from earlier in function
        const statsbombXGDisplay = hasStatsBombXG ? `${(parseFloat(shot.statsbomb_xg) * 100).toFixed(1)}%` : 'N/A';

        // Only update modal elements if they exist
        if (detailsDiv) {
        detailsDiv.innerHTML = `
            <h4>Shot #${index + 1} - ${shot.player_name || 'Player ' + shot.player_id}</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 15px;">
                <div>
                    <strong>Our Model xG:</strong><br>
                    <span style="font-size: 24px; color: #4CAF50;">${currentXG}</span>
                </div>
                <div>
                    <strong>StatsBomb xG:</strong><br>
                    <span style="font-size: 24px; color: ${hasStatsBombXG ? '#2196F3' : '#666'};">${statsbombXGDisplay}</span>
                </div>
                <div>
                    <strong>Actual Outcome:</strong><br>
                    <span style="font-size: 24px;">${actualOutcome}</span>
                </div>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #1e1e1e; border-radius: 5px;">
                <strong>Shot Details:</strong><br>
                Position: (${parseFloat(shot.x_coord).toFixed(1)}, ${parseFloat(shot.y_coord).toFixed(1)})<br>
                Distance: ${parseFloat(shot.distance_to_goal).toFixed(1)}m | Angle: ${parseFloat(shot.angle_to_goal).toFixed(1)}°<br>
                Defenders Between: ${shot.defenders_between}<br>
                ${shot.body_part} | ${shot.shot_type} | ${shot.situation}<br>
                Match Minute: ${shot.match_minute}'
            </div>
            <div style="margin-top: 15px; padding: 15px; background: ${shot.goal_scored === 'True' ? '#2d5f2d' : '#3d2f2d'}; border-radius: 5px;">
                <strong>Verification:</strong><br>
                ${this.getVerificationText(parseFloat(currentXG.replace('%', '')) / 100, shot.goal_scored === 'True')}
            </div>
        `;
        }

        if (resultDiv) {
            resultDiv.style.display = 'block';
        }

        // Update goal frame visualization
        console.log('=== PSxG Goal Frame Update ===');
        console.log(`window.psxgCalculator exists: ${!!window.psxgCalculator}`);
        if (window.psxgCalculator) {
            let shotEndX = parseFloat(shot.shot_end_x);
            let shotEndY = parseFloat(shot.shot_end_y);
            let shotSpeedVal = parseFloat(shot.shot_speed) || 85;
            const isGoal = shot.goal_scored === 'True';
            const hasEndpointData = !isNaN(shotEndX) && !isNaN(shotEndY) && shotEndX >= 0 && shotEndY >= 0;

            console.log(`Shot data: goal_scored="${shot.goal_scored}", isGoal=${isGoal}`);
            console.log(`Endpoint data: shot_end_x=${shot.shot_end_x}, shot_end_y=${shot.shot_end_y}, hasEndpointData=${hasEndpointData}`);

            // If no endpoint data but shot was a goal, estimate the ball position
            if (!hasEndpointData && isGoal) {
                // Estimate ball position based on shot angle and position
                const shotXCoord = parseFloat(shot.x_coord);
                const shotYCoord = parseFloat(shot.y_coord);
                const goalCenterY = 34; // Center of goal (680/2 / 10)

                // Calculate angle from shot to goal center
                const angleToGoalCenter = Math.atan2(goalCenterY - shotYCoord, 105 - shotXCoord);

                // Estimate horizontal position in goal (0-7.32m) based on shot Y position
                // If shot is from center, ball likely goes center; if from side, likely goes opposite
                const normalizedShotY = (shotYCoord - 30.3) / (37.7 - 30.3); // Normalize to 0-1 within goal width
                const randomOffset = (Math.random() - 0.5) * 2; // Add some randomness

                // Ball X: tends to go towards far post but with variation
                shotEndX = 3.66 + (0.5 - normalizedShotY) * 2.5 + randomOffset;
                shotEndX = Math.max(0.5, Math.min(6.82, shotEndX)); // Clamp within goal

                // Ball Y: goals often go low or into corners
                // Use shot power/placement if available, otherwise estimate
                const shotPower = parseFloat(shot.shot_power) || 75;
                const shotPlacement = parseFloat(shot.shot_placement) || 5;

                if (shotPlacement > 7) {
                    // High placement - upper part of goal
                    shotEndY = 1.5 + Math.random() * 0.8;
                } else if (shotPlacement < 3) {
                    // Low placement - lower part of goal
                    shotEndY = 0.2 + Math.random() * 0.5;
                } else {
                    // Mid placement
                    shotEndY = 0.5 + Math.random() * 1.2;
                }

                // Estimate shot speed based on power
                shotSpeedVal = 50 + (shotPower / 100) * 70; // 50-120 km/h range

                console.log(`📊 Estimated goal position: Ball(${shotEndX.toFixed(2)}m, ${shotEndY.toFixed(2)}m) Speed: ${shotSpeedVal.toFixed(0)}km/h`);
            }

            const onTarget = isGoal || hasEndpointData || shot.on_target === 'True';

            if (onTarget && (hasEndpointData || isGoal)) {
                // Shot was on target - update goal frame with ball position
                console.log(`🎯 On-target shot: Ball(${shotEndX.toFixed(2)}, ${shotEndY.toFixed(2)}) Speed: ${shotSpeedVal.toFixed(0)}km/h`);

                // Also estimate GK position based on pitch GK position
                const gkPitchX = parseFloat(shot.gk_x) || 104;
                const gkPitchY = parseFloat(shot.gk_y) || 34;

                // Convert GK pitch Y to goal frame X (0-7.32m)
                // Pitch Y 30.3-37.7 maps to goal 0-7.32m
                const gkGoalX = ((gkPitchY - 30.3) / (37.7 - 30.3)) * 7.32;
                const clampedGkX = Math.max(0.5, Math.min(6.82, gkGoalX));

                // GK Y in goal frame (height) - assume standing on ground
                const gkGoalY = 0.3;

                // Use actual shot distance from CSV instead of default 15
                const actualDistance = parseFloat(shot.distance_to_goal) || 15;
                window.psxgCalculator.shotDistance = actualDistance;
                if (window.psxgCalculator.shotDistPsxgSlider) {
                    window.psxgCalculator.shotDistPsxgSlider.value = actualDistance;
                }
                if (window.psxgCalculator.shotDistPsxgValue) {
                    window.psxgCalculator.shotDistPsxgValue.textContent = Math.round(actualDistance);
                }

                window.psxgCalculator.setPositions(shotEndX, shotEndY, shotSpeedVal, clampedGkX, gkGoalY);

                // Mark if this is estimated data
                if (!hasEndpointData && window.psxgCalculator.ballZoneSpan) {
                    const currentZone = window.psxgCalculator.ballZoneSpan.textContent;
                    window.psxgCalculator.ballZoneSpan.innerHTML = `${currentZone} <small style="color:#FF9800">(est.)</small>`;
                }
            } else {
                // Shot was off-target
                console.log(`❌ Off-target shot - no PSxG applicable`);
                if (window.psxgCalculator.psxgDisplay) {
                    window.psxgCalculator.psxgDisplay.textContent = 'N/A';
                    window.psxgCalculator.psxgDisplay.className = 'psxg-value';
                    window.psxgCalculator.psxgDisplay.style.color = '#888';
                }
                // Mark PSxG as N/A for combined display
                window.psxgCalculator.currentPSxGValue = null;
                window.psxgCalculator.updateCombinedDisplay();
                if (window.psxgCalculator.ballPositionSpan) {
                    window.psxgCalculator.ballPositionSpan.innerHTML = '<span style="color:#f44336">Off target</span>';
                }
                if (window.psxgCalculator.ballZoneSpan) {
                    window.psxgCalculator.ballZoneSpan.innerHTML = '<span style="color:#f44336">Miss</span>';
                }
            }
        }

        // Close the modal to show the pitch visualization
        this.closeShotAnalysisModal();
    }

    getVerificationText(xg, isGoal) {
        const xgPercent = (xg * 100).toFixed(1);

        if (isGoal) {
            if (xg > 0.50) {
                return `✅ High xG (${xgPercent}%) shot resulted in a goal - as expected!`;
            } else if (xg > 0.15) {
                return `✅ Medium xG (${xgPercent}%) shot scored - good execution!`;
            } else {
                return `🎯 Low xG (${xgPercent}%) shot scored - exceptional finish against the odds!`;
            }
        } else {
            if (xg > 0.50) {
                return `⚠️ High xG (${xgPercent}%) shot missed - unlucky or poor execution.`;
            } else if (xg > 0.15) {
                return `✓ Medium xG (${xgPercent}%) shot missed - within expected variance.`;
            } else {
                return `✓ Low xG (${xgPercent}%) shot missed - expected outcome.`;
            }
        }
    }

    // Calculate and display model accuracy metrics
    calculateModelAccuracy(xgValues, outcomes, shots) {
        const modelAccuracyDiv = document.getElementById('model-accuracy');
        const accuracyMetrics = document.getElementById('accuracy-metrics');
        const calibrationChart = document.getElementById('calibration-chart');

        // Calculate basic metrics
        const totalShots = xgValues.length;
        const totalGoals = outcomes.reduce((a, b) => a + b, 0);
        const totalXG = xgValues.reduce((a, b) => a + b, 0);

        // Calculate Log Loss (Brier Score)
        let brierScore = 0;
        for (let i = 0; i < xgValues.length; i++) {
            brierScore += Math.pow(xgValues[i] - outcomes[i], 2);
        }
        brierScore = brierScore / totalShots;

        // Calculate calibration by binning predictions
        const bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
        const binData = bins.slice(0, -1).map((binStart, idx) => {
            const binEnd = bins[idx + 1];
            const binShots = [];
            const binGoals = [];

            for (let i = 0; i < xgValues.length; i++) {
                if (xgValues[i] >= binStart && xgValues[i] < binEnd) {
                    binShots.push(xgValues[i]);
                    binGoals.push(outcomes[i]);
                }
            }

            const avgXG = binShots.length > 0 ? binShots.reduce((a, b) => a + b, 0) / binShots.length : 0;
            const actualRate = binGoals.length > 0 ? binGoals.reduce((a, b) => a + b, 0) / binGoals.length : 0;

            return {
                range: `${(binStart * 100).toFixed(0)}-${(binEnd * 100).toFixed(0)}%`,
                count: binShots.length,
                avgXG: avgXG,
                actualRate: actualRate,
                diff: Math.abs(avgXG - actualRate)
            };
        }).filter(bin => bin.count > 0);

        // Calculate accuracy at different thresholds
        const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5];
        const accuracyAtThresholds = thresholds.map(threshold => {
            let correct = 0;
            for (let i = 0; i < xgValues.length; i++) {
                const predicted = xgValues[i] >= threshold ? 1 : 0;
                if (predicted === outcomes[i]) correct++;
            }
            return {
                threshold: (threshold * 100).toFixed(0) + '%',
                accuracy: ((correct / totalShots) * 100).toFixed(1)
            };
        });

        // Display metrics
        accuracyMetrics.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="background: #1e1e1e; padding: 15px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px; color: #aaa; margin-bottom: 5px;">Brier Score</div>
                    <div style="font-size: 28px; font-weight: bold; color: ${brierScore < 0.15 ? '#4CAF50' : brierScore < 0.25 ? '#FF9800' : '#FF5722'};">
                        ${brierScore.toFixed(4)}
                    </div>
                    <div style="font-size: 12px; color: #aaa; margin-top: 5px;">
                        ${brierScore < 0.15 ? '✅ Excellent' : brierScore < 0.25 ? '✓ Good' : '⚠️ Needs Improvement'}
                    </div>
                </div>
                <div style="background: #1e1e1e; padding: 15px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px; color: #aaa; margin-bottom: 5px;">Total xG vs Goals</div>
                    <div style="font-size: 28px; font-weight: bold;">
                        ${totalXG.toFixed(2)} vs ${totalGoals}
                    </div>
                    <div style="font-size: 12px; color: #aaa; margin-top: 5px;">
                        Diff: ${(totalGoals - totalXG).toFixed(2)}
                    </div>
                </div>
                <div style="background: #1e1e1e; padding: 15px; border-radius: 5px; text-align: center;">
                    <div style="font-size: 14px; color: #aaa; margin-bottom: 5px;">Sample Size</div>
                    <div style="font-size: 28px; font-weight: bold; color: #2196F3;">
                        ${totalShots}
                    </div>
                    <div style="font-size: 12px; color: #aaa; margin-top: 5px;">
                        ${totalGoals} goals (${((totalGoals / totalShots) * 100).toFixed(1)}%)
                    </div>
                </div>
            </div>

            <div style="margin-top: 20px; padding: 15px; background: #1e1e1e; border-radius: 5px;">
                <h4 style="margin-top: 0;">Accuracy at Different Thresholds</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                    ${accuracyAtThresholds.map(item => `
                        <div style="padding: 10px; background: #2c2c2c; border-radius: 4px; text-align: center;">
                            <div style="font-size: 12px; color: #aaa;">Threshold: ${item.threshold}</div>
                            <div style="font-size: 20px; font-weight: bold; color: #4CAF50; margin-top: 5px;">
                                ${item.accuracy}%
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Display calibration chart
        calibrationChart.innerHTML = `
            <h4 style="margin-top: 0;">Calibration Analysis</h4>
            <p style="color: #aaa; font-size: 14px;">This shows how well predicted xG matches actual goal conversion rates in different ranges.</p>
            <div style="margin-top: 15px;">
                ${binData.map(bin => {
                    const barWidth = Math.max((bin.avgXG * 100), 5);
                    const actualWidth = Math.max((bin.actualRate * 100), 5);
                    return `
                        <div style="margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span style="font-size: 14px; color: #fff;">xG Range: ${bin.range}</span>
                                <span style="font-size: 14px; color: #aaa;">${bin.count} shots</span>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <div style="font-size: 12px; color: #4CAF50; margin-bottom: 3px;">
                                    Predicted: ${(bin.avgXG * 100).toFixed(1)}%
                                </div>
                                <div style="height: 20px; background: #2c2c2c; border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${barWidth}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #66BB6A); transition: width 0.3s;"></div>
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #FF9800; margin-bottom: 3px;">
                                    Actual: ${(bin.actualRate * 100).toFixed(1)}%
                                </div>
                                <div style="height: 20px; background: #2c2c2c; border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${actualWidth}%; height: 100%; background: linear-gradient(90deg, #FF9800, #FFB74D); transition: width 0.3s;"></div>
                                </div>
                            </div>
                            <div style="margin-top: 5px; font-size: 12px; color: ${bin.diff < 0.1 ? '#4CAF50' : bin.diff < 0.2 ? '#FF9800' : '#FF5722'};">
                                Difference: ${(bin.diff * 100).toFixed(1)}% ${bin.diff < 0.1 ? '✓' : bin.diff < 0.2 ? '!' : '⚠️'}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="margin-top: 20px; padding: 15px; background: #2c2c2c; border-radius: 5px;">
                <strong>📝 Interpretation:</strong><br>
                <ul style="margin: 10px 0; padding-left: 20px; color: #ccc;">
                    <li><strong>Brier Score:</strong> Lower is better. < 0.15 is excellent, < 0.25 is good. Measures prediction accuracy.</li>
                    <li><strong>Calibration:</strong> Green bars should closely match orange bars. Shows if model is well-calibrated.</li>
                    <li><strong>Perfect calibration:</strong> If model predicts 30% xG, actual conversion should be ~30%.</li>
                    ${brierScore < 0.15
                        ? '<li style="color: #4CAF50;">✅ Your model shows excellent predictive performance!</li>'
                        : brierScore < 0.25
                        ? '<li style="color: #FF9800;">✓ Your model shows good performance with room for improvement.</li>'
                        : '<li style="color: #FF5722;">⚠️ Model may need retraining or more data for better accuracy.</li>'}
                </ul>
            </div>
        `;

        modelAccuracyDiv.style.display = 'block';
    }
}

// ============================================
// PSxG Calculator Class
// ============================================

class PSxGCalculator {
    constructor() {
        // Goal dimensions (in meters, scaled to SVG)
        this.GOAL_WIDTH = 7.32;
        this.GOAL_HEIGHT = 2.44;
        this.SVG_WIDTH = 732;
        this.SVG_HEIGHT = 244;
        this.SCALE_X = this.SVG_WIDTH / this.GOAL_WIDTH;
        this.SCALE_Y = this.SVG_HEIGHT / this.GOAL_HEIGHT;

        // Current positions (in meters)
        this.ballX = 5.50;  // meters from left post
        this.ballY = 1.94;  // meters from ground (SVG y is inverted)
        this.gkX = 3.66;    // center of goal
        this.gkY = 0.44;    // ground level

        // Shot parameters
        this.shotSpeed = 85;  // km/h
        this.shotDistance = 15;  // meters from goal

        // API endpoint
        this.API_BASE = window.location.origin;

        // Initialize
        this.initElements();
        this.initDragHandlers();
        this.initEventListeners();
        this.updateDisplay();

        // Load zone heatmap on startup
        this.updateZonePSxG();
    }

    initElements() {
        this.goalFrame = document.getElementById('goal-frame');
        this.psxgBall = document.getElementById('psxg-ball');
        this.psxgGK = document.getElementById('psxg-gk');
        this.psxgDisplay = document.getElementById('psxg-display');
        this.ballPositionSpan = document.getElementById('ball-position');
        this.psxgGKPositionSpan = document.getElementById('psxg-gk-position');
        this.ballZoneSpan = document.getElementById('ball-zone');
        this.shotSpeedSlider = document.getElementById('shot-speed');
        this.shotSpeedValue = document.getElementById('shot-speed-value');
        this.shotDistPsxgSlider = document.getElementById('shot-dist-psxg');
        this.shotDistPsxgValue = document.getElementById('shot-dist-psxg-value');

        // Breakdown elements
        this.gkDiveDistSpan = document.getElementById('gk-dive-dist');
        this.ballTravelTimeSpan = document.getElementById('ball-travel-time');
        this.gkReachTimeSpan = document.getElementById('gk-reach-time');
        this.timeMarginSpan = document.getElementById('time-margin');
        this.saveDifficultySpan = document.getElementById('save-difficulty');

        // Combined result elements
        this.combinedXgVal = document.getElementById('combined-xg-val');
        this.combinedPsxgVal = document.getElementById('combined-psxg-val');
        this.combinedResultVal = document.getElementById('combined-result-val');
    }

    initDragHandlers() {
        if (!this.goalFrame) return;

        let isDragging = false;
        let currentElement = null;
        let animationFrameId = null;
        let lastPos = { x: 0, y: 0 };

        // Get SVG point from screen coordinates
        const getMousePosition = (e) => {
            const svg = this.goalFrame;
            const pt = svg.createSVGPoint();

            if (e.touches && e.touches.length > 0) {
                pt.x = e.touches[0].clientX;
                pt.y = e.touches[0].clientY;
            } else {
                pt.x = e.clientX;
                pt.y = e.clientY;
            }

            // Transform to SVG coordinates
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            return { x: svgP.x, y: svgP.y };
        };

        const startDrag = (e) => {
            const target = e.target.closest('.draggable-psxg');
            if (target) {
                isDragging = true;
                currentElement = target;
                currentElement.classList.add('dragging');
                lastPos = getMousePosition(e);
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const updatePosition = () => {
            if (!isDragging || !currentElement) return;

            const type = currentElement.dataset.type;

            // Goal area boundaries (inside the posts)
            const minX = 20;
            const maxX = this.SVG_WIDTH - 20;
            const minY = 20;
            const maxY = this.SVG_HEIGHT - 20;

            const clampedX = Math.max(minX, Math.min(maxX, lastPos.x));
            const clampedY = Math.max(minY, Math.min(maxY, lastPos.y));

            if (type === 'ball') {
                // Move all ball elements using transform for smooth movement
                const circles = currentElement.querySelectorAll('circle');
                const label = currentElement.querySelector('text');

                circles.forEach(circle => {
                    circle.setAttribute('cx', clampedX);
                    circle.setAttribute('cy', clampedY);
                });
                if (label) {
                    label.setAttribute('x', clampedX);
                    label.setAttribute('y', clampedY + 28);
                }

                // Update position in meters (y is inverted - top of SVG is high in goal)
                this.ballX = clampedX / this.SCALE_X;
                this.ballY = (this.SVG_HEIGHT - clampedY) / this.SCALE_Y;

            } else if (type === 'gk') {
                // Move GK - constrain Y to be near ground level
                const gkMinY = 100;  // GK can't be too high
                const gkMaxY = this.SVG_HEIGHT - 50;
                const gkClampedY = Math.max(gkMinY, Math.min(gkMaxY, clampedY));

                const ellipse = currentElement.querySelector('ellipse');
                const rect = currentElement.querySelector('rect');
                const headCircle = currentElement.querySelectorAll('circle')[0];
                const glove1 = currentElement.querySelectorAll('circle')[1];
                const glove2 = currentElement.querySelectorAll('circle')[2];
                const text = currentElement.querySelector('text');

                // Position GK centered on drag point
                if (ellipse) {
                    ellipse.setAttribute('cx', clampedX);
                    ellipse.setAttribute('cy', gkClampedY + 50);
                }
                if (rect) {
                    rect.setAttribute('x', clampedX - 15);
                    rect.setAttribute('y', gkClampedY);
                }
                if (headCircle) {
                    headCircle.setAttribute('cx', clampedX);
                    headCircle.setAttribute('cy', gkClampedY - 12);
                }
                if (glove1) {
                    glove1.setAttribute('cx', clampedX - 21);
                    glove1.setAttribute('cy', gkClampedY + 15);
                }
                if (glove2) {
                    glove2.setAttribute('cx', clampedX + 21);
                    glove2.setAttribute('cy', gkClampedY + 15);
                }
                if (text) {
                    text.setAttribute('x', clampedX);
                    text.setAttribute('y', gkClampedY + 68);
                }

                // Update GK position in meters
                this.gkX = clampedX / this.SCALE_X;
                this.gkY = Math.max(0, (this.SVG_HEIGHT - gkClampedY - 25) / this.SCALE_Y);
            }

            this.updateDisplay();
            this.calculatePSxGLive();
        };

        const drag = (e) => {
            if (!isDragging || !currentElement) return;
            e.preventDefault();
            e.stopPropagation();

            lastPos = getMousePosition(e);

            // Use requestAnimationFrame for smooth updates
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            animationFrameId = requestAnimationFrame(updatePosition);
        };

        const endDrag = (e) => {
            const wasGK = currentElement && currentElement.dataset.type === 'gk';
            if (currentElement) {
                currentElement.classList.remove('dragging');
            }
            isDragging = false;
            currentElement = null;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            // Update zone PSxG heatmap when GK drag ends
            if (wasGK) {
                this.updateZonePSxG();
            }
        };

        // Mouse events
        this.goalFrame.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);  // Listen on document for smoother tracking
        document.addEventListener('mouseup', endDrag);

        // Touch events
        this.goalFrame.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', endDrag);
        document.addEventListener('touchcancel', endDrag);
    }

    initEventListeners() {
        // Shot speed slider
        if (this.shotSpeedSlider) {
            this.shotSpeedSlider.addEventListener('input', (e) => {
                this.shotSpeed = parseInt(e.target.value);
                if (this.shotSpeedValue) this.shotSpeedValue.textContent = this.shotSpeed;
                this.calculatePSxGLive();
            });
        }

        // Shot distance slider (optional - shot distance can be inferred from pitch)
        if (this.shotDistPsxgSlider) {
            this.shotDistPsxgSlider.addEventListener('input', (e) => {
                this.shotDistance = parseInt(e.target.value);
                if (this.shotDistPsxgValue) this.shotDistPsxgValue.textContent = this.shotDistance;
                this.calculatePSxGLive();
            });
        }

        // Calculate PSxG button
        const calculatePsxgBtn = document.getElementById('calculate-psxg');
        if (calculatePsxgBtn) {
            calculatePsxgBtn.addEventListener('click', () => this.calculatePSxG());
        }

        // Calculate Combined button
        const calculateCombinedBtn = document.getElementById('calculate-combined');
        if (calculateCombinedBtn) {
            calculateCombinedBtn.addEventListener('click', () => this.calculateCombined());
        }
    }

    updateDisplay() {
        // Update position displays with clearer X/Y format
        if (this.ballPositionSpan) {
            this.ballPositionSpan.innerHTML = `X: <b>${this.ballX.toFixed(2)}m</b> | Y: <b>${this.ballY.toFixed(2)}m</b>`;
        }
        if (this.psxgGKPositionSpan) {
            this.psxgGKPositionSpan.innerHTML = `X: <b>${this.gkX.toFixed(2)}m</b> | Y: <b>${Math.max(0, this.gkY).toFixed(2)}m</b>`;
        }

        // Update zone
        if (this.ballZoneSpan) {
            this.ballZoneSpan.textContent = this.getZone(this.ballX, this.ballY);
        }

        // Also update the combined result display with current values
        this.updateCombinedDisplay();
    }

    /**
     * Set the current xG value (called from xG calculator when shot is analyzed)
     */
    setCurrentXG(xgValue, isGoal = null, isOnTarget = null) {
        // Ensure it's a valid number
        const numValue = parseFloat(xgValue);
        this.currentXGValue = isNaN(numValue) ? 0 : numValue;
        this.currentShotIsGoal = isGoal;
        this.currentShotIsOnTarget = isOnTarget;
        // Don't update combined display here - wait for setPositions to set PSxG
    }

    /**
     * Set the current PSxG value directly (avoids timing issues)
     */
    setCurrentPSxG(psxgValue) {
        const numValue = parseFloat(psxgValue);
        this.currentPSxGValue = isNaN(numValue) ? null : numValue;
        this.updateCombinedDisplay();
    }

    updateCombinedDisplay() {
        // Use stored xG value if available, otherwise try to read from DOM
        let currentXG = this.currentXGValue || 0;

        if (!currentXG || currentXG === 0) {
            // Fallback: try to read from DOM
            const xgDisplay = document.getElementById('xg-display');
            if (xgDisplay) {
                const xgText = xgDisplay.textContent || xgDisplay.innerText || '';
                let match = xgText.match(/([\d.]+)\s*%/);
                if (!match) {
                    match = xgText.match(/([\d.]+)/);
                }
                if (match) {
                    const value = parseFloat(match[1]);
                    if (!isNaN(value)) {
                        currentXG = value > 1 ? value / 100 : value;
                    }
                }
            }
        }

        // Use stored PSxG value if available, otherwise read from display
        let currentPSxG = this.currentPSxGValue;
        let psxgIsNA = currentPSxG === null;

        if (currentPSxG === null || currentPSxG === undefined) {
            // Fallback: try to read from display
            if (this.psxgDisplay) {
                const psxgText = this.psxgDisplay.textContent || '';
                if (psxgText.includes('N/A') || psxgText.includes('--')) {
                    psxgIsNA = true;
                    currentPSxG = 0;
                } else {
                    const match = psxgText.match(/([\d.]+)\s*%?/);
                    if (match) {
                        const value = parseFloat(match[1]);
                        if (!isNaN(value)) {
                            currentPSxG = value > 1 ? value / 100 : value;
                            psxgIsNA = false;
                        }
                    }
                }
            }
        }

        // Ensure values are valid numbers
        currentXG = isNaN(currentXG) ? 0 : currentXG;
        currentPSxG = isNaN(currentPSxG) ? 0 : currentPSxG;

        // Get outcome info
        const isGoal = this.currentShotIsGoal;
        const isOnTarget = this.currentShotIsOnTarget !== false && !psxgIsNA;

        // Update display values
        if (this.combinedXgVal) {
            this.combinedXgVal.textContent = `${(currentXG * 100).toFixed(1)}%`;
        }
        if (this.combinedPsxgVal) {
            if (psxgIsNA) {
                this.combinedPsxgVal.textContent = 'N/A';
            } else {
                this.combinedPsxgVal.textContent = `${(currentPSxG * 100).toFixed(1)}%`;
            }
        }

        const qualityLabel = document.getElementById('shot-quality-label');

        // Handle different scenarios based on outcome
        if (this.combinedResultVal) {
            if (psxgIsNA || !isOnTarget) {
                // OFF TARGET - no PSxG calculation possible
                this.combinedResultVal.textContent = 'N/A';
                this.combinedResultVal.style.color = '#f44336';
                if (qualityLabel) {
                    qualityLabel.textContent = '❌ Off Target';
                    qualityLabel.style.color = '#f44336';
                }
            } else if (currentXG > 0 || currentPSxG > 0) {
                const difference = (currentPSxG - currentXG) * 100;
                const sign = difference >= 0 ? '+' : '';
                this.combinedResultVal.textContent = `${sign}${difference.toFixed(1)}%`;

                // Outcome-aware messaging
                if (qualityLabel) {
                    if (isGoal === true) {
                        // GOAL scored
                        if (difference >= 10) {
                            qualityLabel.textContent = '⚽ Clinical Finish!';
                            qualityLabel.style.color = '#4CAF50';
                            this.combinedResultVal.style.color = '#4CAF50';
                        } else if (difference >= -10) {
                            qualityLabel.textContent = '⚽ Good Conversion';
                            qualityLabel.style.color = '#8BC34A';
                            this.combinedResultVal.style.color = '#8BC34A';
                        } else {
                            qualityLabel.textContent = '⚽ Lucky Goal';
                            qualityLabel.style.color = '#FF9800';
                            this.combinedResultVal.style.color = '#FF9800';
                        }
                    } else if (isGoal === false) {
                        // MISS (but on target - saved)
                        if (difference >= 20) {
                            qualityLabel.textContent = '🧤 Unlucky - Great Shot';
                            qualityLabel.style.color = '#2196F3';
                            this.combinedResultVal.style.color = '#2196F3';
                        } else if (difference >= 0) {
                            qualityLabel.textContent = '🧤 Saved - Good Effort';
                            qualityLabel.style.color = '#FF9800';
                            this.combinedResultVal.style.color = '#FF9800';
                        } else {
                            qualityLabel.textContent = '❌ Poor Placement';
                            qualityLabel.style.color = '#f44336';
                            this.combinedResultVal.style.color = '#f44336';
                        }
                    } else {
                        // Unknown outcome - just show difference
                        if (difference >= 20) {
                            qualityLabel.textContent = 'Excellent placement';
                            qualityLabel.style.color = '#4CAF50';
                            this.combinedResultVal.style.color = '#4CAF50';
                        } else if (difference >= 0) {
                            qualityLabel.textContent = 'Good placement';
                            qualityLabel.style.color = '#8BC34A';
                            this.combinedResultVal.style.color = '#8BC34A';
                        } else if (difference >= -20) {
                            qualityLabel.textContent = 'Below average';
                            qualityLabel.style.color = '#FF9800';
                            this.combinedResultVal.style.color = '#FF9800';
                        } else {
                            qualityLabel.textContent = 'Poor placement';
                            qualityLabel.style.color = '#f44336';
                            this.combinedResultVal.style.color = '#f44336';
                        }
                    }
                }
            } else {
                this.combinedResultVal.textContent = '--%';
                this.combinedResultVal.style.color = '#888';
                if (qualityLabel) {
                    qualityLabel.textContent = 'PSxG - xG';
                    qualityLabel.style.color = '#888';
                }
            }
        }
    }

    /**
     * Fetch PSxG for all 12 zones from API and update the zone heatmap
     * Called on page load and when GK position changes
     */
    async updateZonePSxG() {
        console.log(`🎨 Updating zone PSxG heatmap for GK at (${this.gkX.toFixed(2)}, ${this.gkY.toFixed(2)})`);

        try {
            const response = await fetch(`${this.API_BASE}/calculate_zone_psxg`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gk_x: this.gkX,
                    gk_y: this.gkY,
                    shot_speed: this.shotSpeed,
                    shot_distance: this.shotDistance
                })
            });

            if (!response.ok) {
                console.error('Zone PSxG API error:', response.status);
                this.renderFallbackZones();
                return;
            }

            const data = await response.json();
            console.log('🎨 Zone PSxG API response:', data);

            if (data.success && data.zones) {
                this.renderZoneHeatmap(data.zones);
                console.log('✅ Zone heatmap updated with', data.zones.length, 'zones');
            } else {
                console.warn('Zone PSxG response missing data, using fallback');
                this.renderFallbackZones();
            }
        } catch (error) {
            console.error('Error fetching zone PSxG:', error);
            // On error, use fallback static values
            this.renderFallbackZones();
        }
    }

    /**
     * Render zone colors and labels based on PSxG values
     */
    renderZoneHeatmap(zones) {
        zones.forEach(zone => {
            const rectId = `zone-${zone.row}-${zone.col}`;
            const labelId = `zone-label-${zone.row}-${zone.col}`;

            const rect = document.getElementById(rectId);
            const label = document.getElementById(labelId);

            if (rect) {
                rect.setAttribute('fill', this.getZoneColor(zone.psxg));
            }
            if (label) {
                label.textContent = zone.psxg.toFixed(2);
            }
        });
    }

    /**
     * Get color for zone based on PSxG value
     * High PSxG (hard to save) = Pink/Red
     * Medium PSxG = Yellow/Orange
     * Low PSxG (easy to save) = Green
     */
    getZoneColor(psxg) {
        if (psxg >= 0.80) {
            // Very high - brand red
            return 'rgba(255, 111, 122, 0.65)';
        } else if (psxg >= 0.65) {
            // High - red
            return 'rgba(255, 111, 122, 0.50)';
        } else if (psxg >= 0.50) {
            // Medium-high - amber
            return 'rgba(251, 191, 61, 0.55)';
        } else if (psxg >= 0.35) {
            // Medium - amber (lighter)
            return 'rgba(251, 191, 61, 0.42)';
        } else if (psxg >= 0.25) {
            // Medium-low - green (lighter)
            return 'rgba(49, 231, 168, 0.42)';
        } else {
            // Low - green (easy to save)
            return 'rgba(49, 231, 168, 0.55)';
        }
    }

    /**
     * Fallback zone rendering when API is unavailable
     */
    renderFallbackZones() {
        const fallbackValues = [
            // Row 0 (bottom)
            { row: 0, col: 0, psxg: 0.48 },
            { row: 0, col: 1, psxg: 0.18 },
            { row: 0, col: 2, psxg: 0.18 },
            { row: 0, col: 3, psxg: 0.48 },
            // Row 1 (middle)
            { row: 1, col: 0, psxg: 0.65 },
            { row: 1, col: 1, psxg: 0.28 },
            { row: 1, col: 2, psxg: 0.28 },
            { row: 1, col: 3, psxg: 0.65 },
            // Row 2 (top)
            { row: 2, col: 0, psxg: 0.92 },
            { row: 2, col: 1, psxg: 0.72 },
            { row: 2, col: 2, psxg: 0.72 },
            { row: 2, col: 3, psxg: 0.92 }
        ];
        this.renderZoneHeatmap(fallbackValues);
    }

    // Set positions programmatically (used when loading shots from CSV)
    setPositions(ballX, ballY, shotSpeed, gkX = null, gkY = null) {
        console.log(`🎯 setPositions called: ballX=${ballX}, ballY=${ballY}, speed=${shotSpeed}, gkX=${gkX}, gkY=${gkY}`);
        console.log(`🔍 Elements: psxgBall=${!!this.psxgBall}, psxgGK=${!!this.psxgGK}`);

        // Re-fetch elements if they weren't found during init
        if (!this.psxgBall) {
            this.psxgBall = document.getElementById('psxg-ball');
            console.log(`🔄 Re-fetched psxg-ball: ${!!this.psxgBall}`);
        }
        if (!this.psxgGK) {
            this.psxgGK = document.getElementById('psxg-gk');
            console.log(`🔄 Re-fetched psxg-gk: ${!!this.psxgGK}`);
        }

        // Update ball position (clamp to goal dimensions)
        this.ballX = Math.max(0, Math.min(this.GOAL_WIDTH, ballX));
        this.ballY = Math.max(0, Math.min(this.GOAL_HEIGHT, ballY));

        // Update GK position if provided
        if (gkX !== null) {
            this.gkX = Math.max(0, Math.min(this.GOAL_WIDTH, gkX));
        }
        if (gkY !== null) {
            this.gkY = Math.max(0, Math.min(this.GOAL_HEIGHT, gkY));
        }

        // Update shot speed
        if (shotSpeed && shotSpeed > 0) {
            this.shotSpeed = Math.max(40, Math.min(150, shotSpeed));
            if (this.shotSpeedSlider) {
                this.shotSpeedSlider.value = this.shotSpeed;
            }
            if (this.shotSpeedValue) {
                this.shotSpeedValue.textContent = this.shotSpeed;
            }
        }

        // Update SVG ball position (ball is a group with circles inside)
        if (this.psxgBall) {
            const svgX = this.ballX * this.SCALE_X;
            const svgY = this.SVG_HEIGHT - (this.ballY * this.SCALE_Y);
            console.log(`🏀 Moving ball to SVG coords: (${svgX.toFixed(0)}, ${svgY.toFixed(0)})`);

            // Update all circles inside the ball group
            const circles = this.psxgBall.querySelectorAll('circle');
            console.log(`   Found ${circles.length} circles in ball group`);
            circles.forEach(circle => {
                circle.setAttribute('cx', svgX);
                circle.setAttribute('cy', svgY);
            });

            // Update ball label
            const label = this.psxgBall.querySelector('text');
            if (label) {
                label.setAttribute('x', svgX);
                label.setAttribute('y', svgY + 28);
            }
        } else {
            console.log('❌ psxgBall element NOT FOUND!');
        }

        // Update SVG GK position (GK is a group with multiple elements)
        if (this.psxgGK) {
            const gkSvgX = this.gkX * this.SCALE_X;
            const gkSvgY = this.SVG_HEIGHT - (Math.max(0, this.gkY) * this.SCALE_Y) - 25;
            const clampedY = Math.max(100, Math.min(this.SVG_HEIGHT - 50, gkSvgY));
            console.log(`🧤 Moving GK to SVG coords: (${gkSvgX.toFixed(0)}, ${clampedY.toFixed(0)})`);

            const ellipse = this.psxgGK.querySelector('ellipse');
            const rect = this.psxgGK.querySelector('rect');
            const circles = this.psxgGK.querySelectorAll('circle');
            const text = this.psxgGK.querySelector('text');
            console.log(`   Found: ellipse=${!!ellipse}, rect=${!!rect}, circles=${circles.length}, text=${!!text}`);

            if (ellipse) {
                ellipse.setAttribute('cx', gkSvgX);
                ellipse.setAttribute('cy', clampedY + 50);
            }
            if (rect) {
                rect.setAttribute('x', gkSvgX - 15);
                rect.setAttribute('y', clampedY);
            }
            if (circles[0]) {
                circles[0].setAttribute('cx', gkSvgX);
                circles[0].setAttribute('cy', clampedY - 12);
            }
            if (circles[1]) {
                circles[1].setAttribute('cx', gkSvgX - 21);
                circles[1].setAttribute('cy', clampedY + 15);
            }
            if (circles[2]) {
                circles[2].setAttribute('cx', gkSvgX + 21);
                circles[2].setAttribute('cy', clampedY + 15);
            }
            if (text) {
                text.setAttribute('x', gkSvgX);
                text.setAttribute('y', clampedY + 68);
            }
        } else {
            console.log('❌ psxgGK element NOT FOUND!');
        }

        // Update displays and recalculate
        this.updateDisplay();
        this.calculatePSxGLive();

        // Update zone heatmap based on new GK position
        this.updateZonePSxG();

        console.log(`📍 PSxG positions set: Ball(${this.ballX.toFixed(2)}m, ${this.ballY.toFixed(2)}m) GK(${this.gkX.toFixed(2)}m, ${this.gkY.toFixed(2)}m) Speed: ${this.shotSpeed}km/h`);
    }

    getZone(x, y) {
        // Determine zone based on ball position
        const col = x < this.GOAL_WIDTH / 4 ? 0 : x < this.GOAL_WIDTH / 2 ? 1 : x < 3 * this.GOAL_WIDTH / 4 ? 2 : 3;
        const row = y > this.GOAL_HEIGHT * 2/3 ? 0 : y > this.GOAL_HEIGHT / 3 ? 1 : 2;

        const zoneNames = [
            ['Top Left', 'Top Center-L', 'Top Center-R', 'Top Right'],
            ['Mid Left', 'Mid Center-L', 'Mid Center-R', 'Mid Right'],
            ['Low Left', 'Low Center-L', 'Low Center-R', 'Low Right']
        ];

        return zoneNames[row][col];
    }

    async calculatePSxGLive() {
        // Quick client-side PSxG estimation for live updates
        const psxg = this.estimatePSxG();
        this.updatePSxGDisplay(psxg);
    }

    estimatePSxG() {
        // Client-side PSxG estimation based on physics
        const gkDiveDistance = Math.sqrt(
            Math.pow(this.ballX - this.gkX, 2) +
            Math.pow(this.ballY - Math.max(0, this.gkY), 2)
        );

        // Ball travel time (shot speed in km/h to m/s)
        const speedMs = this.shotSpeed / 3.6;
        const ballTravelTime = this.shotDistance / speedMs;

        // GK reaction and dive time
        const GK_REACTION_TIME = 0.15;
        const GK_DIVE_SPEED_H = 4.0;  // m/s horizontal
        const GK_DIVE_SPEED_V = 2.5;  // m/s vertical

        const horizontalDist = Math.abs(this.ballX - this.gkX);
        const verticalDist = Math.abs(this.ballY - Math.max(0, this.gkY));

        const diveTime = GK_REACTION_TIME + Math.max(
            horizontalDist / GK_DIVE_SPEED_H,
            verticalDist / GK_DIVE_SPEED_V
        );

        // Time margin = diveTime - ballTravelTime
        // timeMargin > 0: GK needs MORE time than ball takes = ball arrives FIRST = goal likely
        // timeMargin < 0: GK needs LESS time = GK arrives FIRST = save likely
        const timeMargin = diveTime - ballTravelTime;

        // Update breakdown display
        this.updateBreakdown(gkDiveDistance, ballTravelTime, diveTime, timeMargin);

        // Calculate PSxG based on time margin and position
        // Continuous formula: PSxG increases smoothly as margin increases
        // margin > 0: ball arrives before GK = goal likely = high PSxG
        // margin < 0: GK arrives before ball = save likely = low PSxG
        let psxg;
        if (timeMargin > 0.3) {
            // GK needs 0.3s+ more - almost certain goal
            psxg = 0.95;
        } else if (timeMargin > 0.15) {
            // GK needs 0.15-0.3s more - very likely goal (0.75 to 0.95)
            psxg = 0.75 + (timeMargin - 0.15) * 1.33;
        } else if (timeMargin > 0.05) {
            // GK needs 0.05-0.15s more - likely goal (0.55 to 0.75)
            psxg = 0.55 + (timeMargin - 0.05) * 2.0;
        } else if (timeMargin > -0.05) {
            // Close call ±0.05s - could go either way (0.15 to 0.55)
            psxg = 0.15 + (timeMargin + 0.05) * 4.0;
        } else if (timeMargin > -0.15) {
            // GK has 0.05-0.15s spare - likely save (0.08 to 0.15)
            psxg = 0.08 + (timeMargin + 0.15) * 0.70;
        } else if (timeMargin > -0.3) {
            // GK has 0.15-0.3s spare - probable save (0.03 to 0.08)
            psxg = 0.03 + (timeMargin + 0.3) * 0.33;
        } else {
            // GK has 0.3s+ spare - easy save
            psxg = 0.03;
        }

        // Bonus for top corners (harder to save - GK can't jump as fast as dive)
        if (this.ballY > 2.0) {
            psxg = Math.min(0.99, psxg + 0.12);
        }

        // Bonus for shots near posts (hard to reach extremes)
        if (this.ballX < 0.5 || this.ballX > this.GOAL_WIDTH - 0.5) {
            psxg = Math.min(0.99, psxg + 0.10);
        }

        // Penalty for shots right at GK (easy save)
        if (gkDiveDistance < 0.5) {
            psxg = Math.max(0.03, psxg * 0.2);
        }

        return Math.max(0.01, Math.min(0.99, psxg));
    }

    updateBreakdown(gkDiveDistance, ballTravelTime, gkReachTime, timeMargin) {
        if (this.gkDiveDistSpan) {
            this.gkDiveDistSpan.textContent = `${gkDiveDistance.toFixed(2)}m`;
        }
        if (this.ballTravelTimeSpan) {
            this.ballTravelTimeSpan.textContent = `${ballTravelTime.toFixed(2)}s`;
        }
        if (this.gkReachTimeSpan) {
            this.gkReachTimeSpan.textContent = `${gkReachTime.toFixed(2)}s`;
        }
        if (this.timeMarginSpan) {
            // timeMargin > 0: GK needs MORE time (ball beats GK) = goal likely = GREEN (good for attacker)
            // timeMargin < 0: GK has SPARE time (GK beats ball) = save likely = RED (bad for attacker)
            const sign = timeMargin >= 0 ? '+' : '';
            this.timeMarginSpan.textContent = `${sign}${timeMargin.toFixed(2)}s`;
            this.timeMarginSpan.style.color = timeMargin > 0 ? '#4CAF50' : '#f44336';
        }
        if (this.saveDifficultySpan) {
            // Save difficulty from GK perspective (positive timeMargin = hard for GK to save)
            let difficulty;
            if (timeMargin > 0.2) difficulty = 'Very Hard';
            else if (timeMargin > 0.05) difficulty = 'Hard';
            else if (timeMargin > -0.1) difficulty = 'Medium';
            else difficulty = 'Easy';
            this.saveDifficultySpan.textContent = difficulty;

            // Color code the difficulty
            this.saveDifficultySpan.style.color =
                difficulty === 'Very Hard' ? '#4CAF50' :
                difficulty === 'Hard' ? '#8BC34A' :
                difficulty === 'Medium' ? '#FF9800' : '#f44336';
        }
    }

    updatePSxGDisplay(psxg) {
        if (!this.psxgDisplay) return;

        const percentage = (psxg * 100).toFixed(1);
        this.psxgDisplay.textContent = `${percentage}%`;

        // Update color class
        this.psxgDisplay.classList.remove('high', 'medium', 'low');
        if (psxg >= 0.5) {
            this.psxgDisplay.classList.add('high');
        } else if (psxg >= 0.25) {
            this.psxgDisplay.classList.add('medium');
        } else {
            this.psxgDisplay.classList.add('low');
        }

        // Store PSxG value and update combined display
        this.setCurrentPSxG(psxg);
    }

    async calculatePSxG() {
        try {
            const response = await fetch(`${this.API_BASE}/calculate_psxg`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shot_end_x: this.ballX,
                    shot_end_y: this.ballY,
                    shot_speed: this.shotSpeed,
                    gk_x: this.gkX,
                    gk_y: Math.max(0, this.gkY),
                    shot_distance: this.shotDistance
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            this.updatePSxGDisplay(data.psxg);

            // Update breakdown from API response
            if (data.gk_dive_distance !== undefined) {
                this.updateBreakdown(
                    data.gk_dive_distance,
                    data.ball_travel_time,
                    data.gk_reach_time,
                    data.time_margin
                );
            }

            if (data.save_difficulty && this.saveDifficultySpan) {
                this.saveDifficultySpan.textContent = data.save_difficulty;
            }

            console.log('PSxG calculated:', data);

        } catch (error) {
            console.error('Error calculating PSxG:', error);
            // Fall back to client-side calculation
            this.calculatePSxGLive();
        }
    }

    async calculateCombined() {
        // Get current xG from the xG calculator display
        const xgDisplay = document.getElementById('xg-display');
        let currentXG = 0;

        if (xgDisplay) {
            const xgText = xgDisplay.textContent || xgDisplay.innerText || '';
            let match = xgText.match(/([\d.]+)\s*%/);
            if (!match) {
                match = xgText.match(/([\d.]+)/);
            }
            if (match) {
                const value = parseFloat(match[1]);
                if (!isNaN(value)) {
                    currentXG = value > 1 ? value / 100 : value;
                }
            }
        }

        // Get current PSxG from display
        let currentPSxG = this.estimatePSxG();
        if (this.psxgDisplay) {
            const psxgText = this.psxgDisplay.textContent || '';
            const match = psxgText.match(/([\d.]+)\s*%?/);
            if (match) {
                const value = parseFloat(match[1]);
                if (!isNaN(value)) {
                    currentPSxG = value > 1 ? value / 100 : value;
                }
            }
        }

        // Calculate shot quality (difference)
        const difference = (currentPSxG - currentXG) * 100;

        // Update display
        if (this.combinedXgVal) {
            this.combinedXgVal.textContent = `${(currentXG * 100).toFixed(1)}%`;
        }
        if (this.combinedPsxgVal) {
            this.combinedPsxgVal.textContent = `${(currentPSxG * 100).toFixed(1)}%`;
        }
        if (this.combinedResultVal) {
            const sign = difference >= 0 ? '+' : '';
            this.combinedResultVal.textContent = `${sign}${difference.toFixed(1)}%`;

            if (difference >= 20) {
                this.combinedResultVal.style.color = '#4CAF50';
            } else if (difference >= 0) {
                this.combinedResultVal.style.color = '#8BC34A';
            } else if (difference >= -20) {
                this.combinedResultVal.style.color = '#FF9800';
            } else {
                this.combinedResultVal.style.color = '#f44336';
            }
        }

        console.log(`Shot Quality: ${(currentPSxG * 100).toFixed(1)}% - ${(currentXG * 100).toFixed(1)}% = ${difference >= 0 ? '+' : ''}${difference.toFixed(1)}%`);
    }
}

// Initialize the calculator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.xgCalculator = new XGCalculator();
    window.psxgCalculator = new PSxGCalculator();
});
