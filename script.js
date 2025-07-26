document.addEventListener('DOMContentLoaded', () => {

    // --- DOM 요소 ---
    const wrapper = document.getElementById('wrapper');
    const screens = document.querySelectorAll('.screen');
    const titleScreen = document.getElementById('title-screen');
    const helpScreen = document.getElementById('help-screen');
    const introSequence = document.getElementById('intro-sequence');
    const gameContainer = document.getElementById('game-container');
    const endingScreen = document.getElementById('ending-screen');
    const realStartButton = document.getElementById('real-start-button');
    const startGameButton = document.getElementById('start-game-button');
    const restartButton = document.getElementById('restart-button');
    const shareButton = document.getElementById('share-button');
    const player = document.getElementById('player');
    const boss = document.getElementById('boss');
    const playerHpBar = document.getElementById('player-hp-bar');
    const bossHpBar = document.getElementById('boss-hp-bar');
    const playerHpValue = document.getElementById('player-hp-value');
    const bossHpValue = document.getElementById('boss-hp-value');
    const currentScoreValue = document.getElementById('current-score-value');
    const dashboard = document.getElementById('dashboard');
    const dashRifleLvl = document.getElementById('dash-rifle-lvl');
    const dashSpeedLvl = document.getElementById('dash-speed-lvl');
    const dashSuperWeapon = document.getElementById('dash-super-weapon');
    const dashSuperTimer = document.getElementById('dash-super-timer');

    // --- 게임 상태 및 설정 ---
    let playerStats, bossInstance, minionsDefeated, currentScore, gameLoopId;
    let playerBullets = [], enemies = [], enemyBullets = [], items = [];
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let isGameOver = false;
    let patterns = [], bossAttackInterval, bossMoveInterval;
    let isBerserk = false;
    let isSuperWeaponActive = false;
    let superWeaponCountdown;
    let lastFinalScore = 0;

    const basePlayerStats = { life: 200, maxLife: 200, attackPower: 1, rifleLevel: 1, attackSpeed: 1.0, maxAttackSpeed: 5.0 };
    const baseBossStats = { life: 2000, maxLife: 2000, attackPower: 10, moveSpeed: 2, moveDirection: 1 };
    const minionStats = { life: 1, attackPower: 2, collisionDamage: 20 };

    // --- 화면 전환 및 시작 로직 ---
    function showScreen(screenToShow) {
        screens.forEach(screen => screen.classList.remove('active'));
        if(screenToShow) screenToShow.classList.add('active');
    }
    showScreen(titleScreen);
    function handleTitleScreen(event) {
        if (event.type === 'click' || event.type === 'keydown') {
            showScreen(helpScreen);
            window.removeEventListener('keydown', handleTitleScreen);
            window.removeEventListener('click', handleTitleScreen);
        }
    }
    window.addEventListener('keydown', handleTitleScreen);
    window.addEventListener('click', handleTitleScreen);
    realStartButton.addEventListener('click', () => showScreen(introSequence));
    
    let currentSceneIndex = 0;
    introSequence.addEventListener('click', (e) => {
        const introScenes = introSequence.querySelectorAll('.scene');
        if (currentSceneIndex >= introScenes.length - 1 || e.target === startGameButton) return;
        introScenes[currentSceneIndex].classList.remove('active');
        currentSceneIndex++;
        introScenes[currentSceneIndex].classList.add('active');
    });

    startGameButton.addEventListener('click', () => {
        showScreen(null);
        gameContainer.style.display = 'flex';
        initGame();
    });
    
    restartButton.addEventListener('click', () => {
        endingScreen.classList.remove('active');
        gameContainer.style.display = 'flex';
        initGame();
    });
    
    shareButton.addEventListener('click', async () => { /* 이전과 동일 */ });

    // --- 게임 초기화 ---
    function initGame() {
        playerStats = { ...basePlayerStats };
        bossInstance = { element: boss, ...baseBossStats, x: gameContainer.offsetWidth / 2, y: 100 };
        minionsDefeated = 0;
        currentScore = 0;
        isGameOver = false;
        isBerserk = false;
        isSuperWeaponActive = false;
        if(superWeaponCountdown) clearInterval(superWeaponCountdown);
        dashSuperWeapon.style.display = 'none';
        
        [...playerBullets, ...enemies, ...enemyBullets, ...items].forEach(obj => obj.element.remove());
        playerBullets = [], enemies = [], enemyBullets = [], items = [];

        player.style.left = (gameContainer.offsetWidth / 2 - player.offsetWidth / 2) + 'px';
        player.style.top = (gameContainer.offsetHeight - player.offsetHeight - 30) + 'px';
        boss.style.display = 'block';
        boss.className = '';
        
        updateUI();
        
        patterns.forEach(p => clearInterval(p));
        if(bossAttackInterval) clearInterval(bossAttackInterval);
        if(bossMoveInterval) clearInterval(bossMoveInterval);
        startPatterns();

        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    // --- 게임 루프 ---
    function gameLoop() {
        if (isGameOver) return;
        movePlayer();
        moveObjects(playerBullets);
        moveObjects(enemies);
        moveObjects(enemyBullets);
        moveObjects(items);
        handleCollisions();
        cleanupObjects();
        updateUI();
        gameLoopId = requestAnimationFrame(gameLoop);
    }
    
    // --- 게임 패턴 ---
    function startPatterns() {
        patterns = [];
        const createAttackInterval = () => setInterval(() => { if(!isGameOver) createPlayerBullet() }, 1000 / playerStats.attackSpeed);
        patterns.push(createAttackInterval());
        
        bossAttackInterval = setInterval(() => { if(!isGameOver) createBossSpreadShot() }, 2000);
        
        patterns.push(setInterval(() => {
            if(!isGameOver) { enemies.forEach(enemy => createEnemyBullet(enemy.element, 90)); }
        }, 3000));
        
        patterns.push(setInterval(() => { if(!isGameOver) createMinion() }, 2500)); // 미니언 생성 간격 단축
        
        bossMoveInterval = setInterval(() => { if(!isGameOver) moveBoss() }, 50);
    }

    // --- 객체 생성 ---
    function createPlayerBullet() { /* 이전과 동일 */ }
    function createMinion() { /* 이전과 동일 */ }
    function createEnemyBullet(source, angle) { /* 이전과 동일 */ }
    function createBossSpreadShot() { /* 이전과 동일 */ }
    function createItem(x, y) { /* 이전과 동일 */ }

    // --- 객체 이동 ---
    function movePlayer() {
        const gameRect = gameContainer.getBoundingClientRect();
        let targetX = mouseX - gameRect.left;
        let targetY = mouseY - gameRect.top;

        // 경계 제한
        const minX = player.offsetWidth / 2;
        const maxX = gameContainer.offsetWidth - player.offsetWidth / 2;
        const minY = gameContainer.offsetHeight * 0.25; // 상단 25% 이동 불가
        const maxY = gameContainer.offsetHeight - player.offsetHeight / 2;

        targetX = Math.max(minX, Math.min(targetX, maxX));
        targetY = Math.max(minY, Math.min(targetY, maxY));
        
        player.style.left = (targetX - player.offsetWidth / 2) + 'px';
        player.style.top = (targetY - player.offsetHeight / 2) + 'px';
    }

    function moveBoss() {
        bossInstance.x += bossInstance.moveSpeed * bossInstance.moveDirection;
        if (bossInstance.x > gameContainer.offsetWidth - boss.offsetWidth / 2 || bossInstance.x < boss.offsetWidth / 2) {
            bossInstance.moveDirection *= -1;
        }
        boss.style.left = (bossInstance.x - boss.offsetWidth / 2) + 'px';
    }

    function moveObjects(objects) {
        objects.forEach(obj => {
            obj.x += obj.speedX; obj.y += obj.speedY;
            obj.element.style.left = (obj.x - obj.element.offsetWidth / 2) + 'px';
            obj.element.style.top = (obj.y - obj.element.offsetHeight / 2) + 'px';
        });
    }
    
    // --- 충돌 감지 ---
    function handleHit(target) { target.classList.add('hit'); setTimeout(() => target.classList.remove('hit'), 100); }
    function handleCollisions() {
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const bullet = playerBullets[i];
            if (!bullet) continue;
            const damage = bullet.attackPower || playerStats.attackPower;
            if (isColliding(bullet.element, boss)) {
                handleHit(boss);
                bossInstance.life -= damage;
                if (!isBerserk && bossInstance.life <= baseBossStats.life / 2) {
                    isBerserk = true;
                    clearInterval(bossAttackInterval);
                    bossAttackInterval = setInterval(() => { if(!isGameOver) createBossSpreadShot() }, 1000);
                }
                bullet.element.remove(); playerBullets.splice(i, 1);
                if (bossInstance.life <= 0 && !isGameOver) endGame(true);
                continue;
            }
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if(isColliding(bullet.element, enemy.element)) {
                    handleHit(enemy.element);
                    enemy.life -= damage;
                    bullet.element.remove(); playerBullets.splice(i, 1);
                    if(enemy.life <= 0) {
                        minionsDefeated++; currentScore += 100;
                        if(Math.random() < 0.2) createItem(enemy.x, enemy.y);
                        enemy.element.remove(); enemies.splice(j, 1);
                    }
                    break;
                }
            }
        }
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const bullet = enemyBullets[i];
            if(isColliding(bullet.element, player)) {
                playerStats.life -= baseBossStats.attackPower;
                wrapper.classList.add('shake'); setTimeout(() => wrapper.classList.remove('shake'), 100);
                bullet.element.remove(); enemyBullets.splice(i, 1);
                if(playerStats.life <= 0 && !isGameOver) endGame(false);
            }
        }
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if(isColliding(enemy.element, player)) {
                playerStats.life -= enemy.collisionDamage;
                wrapper.classList.add('shake'); setTimeout(() => wrapper.classList.remove('shake'), 100);
                enemy.element.remove(); enemies.splice(i, 1);
                if(playerStats.life <= 0 && !isGameOver) endGame(false);
            }
        }
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if(isColliding(item.element, player)) {
                applyItemEffect(item.type);
                item.element.remove(); items.splice(i, 1);
            }
        }
    }
    function isColliding(el1, el2) { const r1=el1.getBoundingClientRect(); const r2=el2.getBoundingClientRect(); return !(r1.right<r2.left || r1.left>r2.right || r1.bottom<r2.top || r1.top>r2.bottom); }

    // --- 아이템 효과 ---
    function applyItemEffect(type) {
        if (type === 'superweapon') { /* 이전과 동일 */ }
        else if(type === 'heal') playerStats.life = playerStats.maxLife;
        else if (type === 'rifle' && playerStats.rifleLevel < 5) {
            playerStats.rifleLevel++; playerStats.attackPower += 3;
        }
        else if (type === 'speed' && playerStats.attackSpeed < playerStats.maxAttackSpeed) {
            playerStats.attackSpeed = parseFloat((playerStats.attackSpeed + 0.5).toFixed(1));
            patterns.forEach(p => clearInterval(p)); startPatterns();
        }
    }

    // --- 화면 밖 객체 제거 ---
    function cleanupObjects() { /* 이전과 동일 */ }
    
    // --- UI 및 게임 종료 ---
    function updateUI() { /* 이전과 동일 */ }
    function endGame(isWin) {
        isGameOver = true;
        cancelAnimationFrame(gameLoopId);
        patterns.forEach(p => clearInterval(p));
        if(bossAttackInterval) clearInterval(bossAttackInterval);
        if(bossMoveInterval) clearInterval(bossMoveInterval);
        if(superWeaponCountdown) clearInterval(superWeaponCountdown);

        const winStory = document.getElementById('ending-story-win');
        const loseStory = document.getElementById('ending-story-lose');
        const resultTitle = document.getElementById('result-title');
        if (isWin) {
            winStory.style.display = 'block'; loseStory.style.display = 'none';
            resultTitle.innerText = "MISSION CLEAR!";
            shareButton.style.display = 'inline-block';
        } else {
            winStory.style.display = 'none'; loseStory.style.display = 'block';
            resultTitle.innerText = "GAME OVER";
            shareButton.style.display = 'none';
        }
        const finalLives = Math.max(0, playerStats.life);
        document.getElementById('result-lives').innerText = `${finalLives} (x10점)`;
        document.getElementById('result-minions').innerText = `${minionsDefeated} (x100점)`;
        lastFinalScore = (finalLives * 10) + (minionsDefeated * 100);
        document.getElementById('final-score').innerText = lastFinalScore;
        boss.style.display = 'none';
        setTimeout(() => {
            showScreen(endingScreen);
            gameContainer.style.display = 'none';
        }, 1500);
    }
    
    // 마우스 위치 추적
    window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    window.addEventListener('touchmove', e => { if(e.touches.length > 0) { mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY; }});
});
