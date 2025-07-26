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
    const bgmToggle = document.getElementById('bgm-toggle');
    const bgm = document.getElementById('bgm');

    // --- 게임 상태 및 설정 ---
    let playerStats, bossInstance, minionsDefeated, currentScore, gameLoopId, lastFinalScore = 0;
    let playerBullets = [], enemies = [], enemyBullets = [], items = [];
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let isGameOver = false;
    let patterns = [], bossAttackInterval, bossMoveInterval;
    let isBerserk = false;
    let isSuperWeaponActive = false;
    let superWeaponCountdown;
    let isMusicPlaying = false;
    let currentSceneIndex = 0;

    const basePlayerStats = { life: 200, maxLife: 200, attackPower: 1, rifleLevel: 1, attackSpeed: 1.0, maxAttackSpeed: 5.0 };
    const baseBossStats = { life: 2000, maxLife: 2000, attackPower: 10, moveSpeed: 2, moveDirection: 1 };
    const minionStats = { life: 1, attackPower: 2, collisionDamage: 20 };

    // --- 화면 전환 및 시작 로직 (오류 수정된 최종 버전) ---
    function showScreen(screenToShow) {
        screens.forEach(screen => screen.style.display = 'none'); // 모든 화면을 확실히 숨김
        if (screenToShow) screenToShow.style.display = 'flex'; // 요청된 화면만 flex로 표시
    }

    function initTitleScreen() {
        let titleScreenActive = true;
        showScreen(titleScreen);

        function handleTitleInteraction() {
            if (!titleScreenActive) return;
            titleScreenActive = false;
            
            if (!isMusicPlaying) {
                bgm.play().then(() => { isMusicPlaying = true; }).catch(e => console.log("BGM 자동재생이 차단되었습니다."));
            }
            showScreen(helpScreen);
            window.removeEventListener('keydown', handleTitleInteraction);
            window.removeEventListener('click', handleTitleInteraction);
        }
        window.addEventListener('keydown', handleTitleInteraction);
        window.addEventListener('click', handleTitleInteraction);
    }
    
    initTitleScreen();

    realStartButton.addEventListener('click', () => {
        currentSceneIndex = 0; // 인트로 장면 인덱스를 0으로 리셋
        const introScenes = introSequence.querySelectorAll('.scene');
        introScenes.forEach((scene, index) => {
            if (index === 0) scene.classList.add('active');
            else scene.classList.remove('active');
        });
        showScreen(introSequence);
    });
    
    introSequence.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        const introScenes = introSequence.querySelectorAll('.scene');
        if (currentSceneIndex >= introScenes.length - 1) return;
        introScenes[currentSceneIndex].classList.remove('active');
        currentSceneIndex++;
        introScenes[currentSceneIndex].classList.add('active');
    });

    startGameButton.addEventListener('click', () => {
        showScreen(gameContainer);
        initGame();
    });
    
    restartButton.addEventListener('click', () => {
        initTitleScreen();
    });
    
    shareButton.addEventListener('click', async () => {
        const shareText = `🚀 SUPER HYOJEONG 🚀\n괴물을 물리치고 민열이를 구했다!\n\n내 점수: ${lastFinalScore}점\n\n너도 도전해봐! 👇`;
        const shareData = { title: 'SUPER HYOJEONG', text: shareText, url: window.location.href };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
                alert('점수와 링크가 클립보드에 복사되었어요!');
            }
        } catch (err) {
            console.error('Share failed:', err);
        }
    });

    bgmToggle.addEventListener('click', () => {
        bgm.muted = !bgm.muted;
        if (bgm.muted) {
            bgmToggle.innerText = '🎵 BGM OFF';
            bgmToggle.classList.add('muted');
        } else {
            bgmToggle.innerText = '🎵 BGM ON';
            bgmToggle.classList.remove('muted');
            if (bgm.paused) bgm.play();
        }
    });

    // --- 게임 초기화 ---
    function initGame() {
        playerStats = { ...basePlayerStats };
        bossInstance = { element: boss, ...baseBossStats, x: gameContainer.offsetWidth / 2, y: 100 };
        minionsDefeated = 0; currentScore = 0; isGameOver = false; isBerserk = false;
        isSuperWeaponActive = false;
        
        patterns.forEach(p => clearInterval(p));
        if(bossAttackInterval) clearInterval(bossAttackInterval);
        if(bossMoveInterval) clearInterval(bossMoveInterval);
        if(superWeaponCountdown) clearInterval(superWeaponCountdown);
        patterns = [];
        
        gameContainer.querySelectorAll('.player-bullet, .minion, .enemy-bullet, .item').forEach(el => el.remove());
        playerBullets = [], enemies = [], enemyBullets = [], items = [];

        player.style.left = (gameContainer.offsetWidth / 2 - player.offsetWidth / 2) + 'px';
        player.style.top = (gameContainer.offsetHeight - player.offsetHeight - 30) + 'px';
        boss.style.display = 'block';
        boss.className = '';
        dashSuperWeapon.style.display = 'none';

        updateUI();
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
        const createAttackInterval = () => setInterval(() => { if(!isGameOver) createPlayerBullet() }, 1000 / playerStats.attackSpeed);
        patterns.push(createAttackInterval());
        bossAttackInterval = setInterval(() => { if(!isGameOver) createBossSpreadShot() }, 2000);
        patterns.push(setInterval(() => { if(!isGameOver) { enemies.forEach(enemy => createEnemyBullet(enemy.element, 90)); } }, 3000));
        patterns.push(setInterval(() => { if(!isGameOver) createMinion() }, 2500));
        bossMoveInterval = setInterval(() => { if(!isGameOver) moveBoss() }, 50);
    }

    // --- 객체 생성 ---
    function createPlayerBullet() {
        if (isSuperWeaponActive) {
            const numBullets = 10;
            const angleSpread = 120;
            const startAngle = 210;
            for (let i = 0; i < numBullets; i++) {
                const angle = startAngle + (i * (angleSpread / (numBullets - 1)));
                const rad = angle * (Math.PI / 180);
                const speed = 8;
                const bullet = document.createElement('div'); bullet.className = 'player-bullet';
                bullet.style.left = (player.offsetLeft + player.offsetWidth / 2 - 4) + 'px';
                bullet.style.top = (player.offsetTop) + 'px';
                gameContainer.appendChild(bullet);
                playerBullets.push({ element: bullet, x: bullet.offsetLeft, y: bullet.offsetTop, speedX: speed * Math.cos(rad), speedY: speed * Math.sin(rad), attackPower: 10 });
            }
            return;
        }
        
        const createBullet = (offsetX) => {
            const bullet = document.createElement('div'); bullet.className = 'player-bullet';
            bullet.style.left = (player.offsetLeft + player.offsetWidth / 2 - 4 + offsetX) + 'px';
            bullet.style.top = (player.offsetTop) + 'px';
            gameContainer.appendChild(bullet);
            playerBullets.push({ element: bullet, x: bullet.offsetLeft, y: bullet.offsetTop, speedX: 0, speedY: -10 });
        };
        switch (playerStats.rifleLevel) {
            case 1: createBullet(0); break;
            case 2: createBullet(-8); createBullet(8); break;
            case 3: createBullet(-12); createBullet(0); createBullet(12); break;
            case 4: createBullet(-18); createBullet(-6); createBullet(6); createBullet(18); break;
            case 5: createBullet(-24); createBullet(-12); createBullet(0); createBullet(12); createBullet(24); break;
        }
    }
    function createMinion() {
        const minion = document.createElement('img'); minion.src = 'minion_ingame.png'; minion.className = 'minion';
        const x = Math.random() * (gameContainer.offsetWidth - 40);
        minion.style.left = x + 'px'; minion.style.top = '-40px';
        gameContainer.appendChild(minion);
        enemies.push({ element: minion, x, y: -40, life: minionStats.life, attackPower: minionStats.attackPower, collisionDamage: minionStats.collisionDamage, speedX: 0, speedY: 2 });
    }
    function createEnemyBullet(source, angle) {
        const bullet = document.createElement('div'); bullet.className = 'enemy-bullet';
        const rect = source.getBoundingClientRect();
        const gameRect = gameContainer.getBoundingClientRect();
        const x = rect.left - gameRect.left + rect.width / 2;
        const y = rect.top - gameRect.top + rect.height;
        bullet.style.left = (x - 6) + 'px'; bullet.style.top = (y - 6) + 'px';
        gameContainer.appendChild(bullet);
        const rad = angle * (Math.PI / 180);
        const speed = 5;
        enemyBullets.push({ element: bullet, x, y, speedX: speed * Math.cos(rad), speedY: speed * Math.sin(rad) });
    }
    function createBossSpreadShot() {
        createEnemyBullet(boss, 75); createEnemyBullet(boss, 90); createEnemyBullet(boss, 105);
    }
    function createItem(x, y) {
        let type;
        const rand = Math.random();
        if (rand < 0.05) type = 'superweapon';
        else if (rand < 0.15) type = 'heal';
        else if (rand < 0.60) type = 'rifle';
        else type = 'speed';
        
        const item = document.createElement('div'); item.className = 'item item-' + type;
        if(type === 'superweapon') item.innerHTML = '🔥';
        
        item.style.left = x + 'px'; item.style.top = y + 'px';
        gameContainer.appendChild(item);
        items.push({ element: item, x, y, type, speedX: 0, speedY: 1 });
    }

    // --- 객체 이동 ---
    function movePlayer() {
        const gameRect = gameContainer.getBoundingClientRect();
        let targetX = mouseX - gameRect.left;
        let targetY = mouseY - gameRect.top;
        const minX = player.offsetWidth / 2;
        const maxX = gameContainer.offsetWidth - player.offsetWidth / 2;
        const minY = gameContainer.offsetHeight * 0.25;
        const maxY = gameContainer.offsetHeight - player.offsetHeight / 2;
        targetX = Math.max(minX, Math.min(targetX, maxX));
        targetY = Math.max(minY, Math.min(targetY, maxY));
        player.style.left = (targetX - player.offsetWidth / 2) + 'px';
        player.style.top = (targetY - player.offsetHeight / 2) + 'px';
    }
    function moveBoss() {
        if (isGameOver) return;
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
            const enemy = enemies[j];
            if(isColliding(enemy.element, player)) {
                playerStats.life -= enemy.collisionDamage;
                wrapper.classList.add('shake'); setTimeout(() => wrapper.classList.remove('shake'), 100);
                enemy.element.remove(); enemies.splice(j, 1);
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
        if (type === 'superweapon') {
            if (isSuperWeaponActive) return;
            isSuperWeaponActive = true;
            let duration = 10;
            dashSuperTimer.innerText = duration;
            dashSuperWeapon.style.display = 'block';
            if(superWeaponCountdown) clearInterval(superWeaponCountdown);
            superWeaponCountdown = setInterval(() => {
                duration--;
                dashSuperTimer.innerText = duration;
                if (duration <= 0) {
                    isSuperWeaponActive = false;
                    dashSuperWeapon.style.display = 'none';
                    clearInterval(superWeaponCountdown);
                }
            }, 1000);
        }
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
    function cleanupObjects() {
        const cleanup = (arr) => { for (let i = arr.length - 1; i >= 0; i--) { if (arr[i] && (arr[i].y < -50 || arr[i].y > gameContainer.offsetHeight + 50 || arr[i].x < -50 || arr[i].x > gameContainer.offsetWidth + 50)) { arr[i].element.remove(); arr.splice(i, 1); } } };
        cleanup(playerBullets); cleanup(enemies); cleanup(enemyBullets); cleanup(items);
    }
    
    // --- UI 및 게임 종료 ---
    function updateUI() {
        const playerLife = Math.max(0, playerStats.life);
        const bossLife = Math.max(0, bossInstance.life);
        playerHpBar.style.width = (playerLife / playerStats.maxLife * 100) + '%';
        bossHpBar.style.width = (bossLife / bossInstance.maxLife * 100) + '%';
        playerHpValue.innerText = `${playerLife}/${playerStats.maxLife}`;
        bossHpValue.innerText = `${bossLife}/${bossInstance.maxLife}`;
        currentScoreValue.innerText = currentScore;
        dashRifleLvl.innerText = playerStats.rifleLevel;
        dashSpeedLvl.innerText = playerStats.attackSpeed.toFixed(1);
    }
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
            gameContainer.style.display = 'none';
            showScreen(endingScreen);
        }, 1500);
    }
    
    // --- 마우스 및 터치 위치 추적 ---
    window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    window.addEventListener('touchmove', e => { if(e.touches.length > 0) { e.preventDefault(); mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY; }}, { passive: false });
});
