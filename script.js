document.addEventListener('DOMContentLoaded', () => {

    // DOM 요소
    const wrapper = document.getElementById('wrapper');
    const introSequence = document.getElementById('intro-sequence');
    const scenes = document.querySelectorAll('.scene');
    const startGameButton = document.getElementById('start-game-button');
    const gameContainer = document.getElementById('game-container');
    const player = document.getElementById('player');
    const boss = document.getElementById('boss');
    const uiContainer = document.getElementById('ui-container');
    const playerHpBar = document.getElementById('player-hp-bar');
    const bossHpBar = document.getElementById('boss-hp-bar');
    const playerHpValue = document.getElementById('player-hp-value');
    const bossHpValue = document.getElementById('boss-hp-value');
    const currentScoreValue = document.getElementById('current-score-value');
    const endingScreen = document.getElementById('ending-screen');
    const restartButton = document.getElementById('restart-button');
    const dashboard = document.getElementById('dashboard');
    const dashRifleLvl = document.getElementById('dash-rifle-lvl');
    const dashSpeedLvl = document.getElementById('dash-speed-lvl');
    const dashSuperWeapon = document.getElementById('dash-super-weapon');
    const dashSuperTimer = document.getElementById('dash-super-timer');

    // 게임 상태 및 설정
    let playerStats, bossInstance, minionsDefeated, currentScore, gameLoopId;
    let playerBullets = [], enemies = [], enemyBullets = [], items = [];
    let mouseX = window.innerWidth / 2;
    let isGameOver = false;
    let patterns = [], bossAttackInterval;
    let isBerserk = false;
    let isSuperWeaponActive = false;
    let superWeaponCountdown;

    const basePlayerStats = { life: 100, maxLife: 100, attackPower: 1, rifleLevel: 1, attackSpeed: 1.0, maxAttackSpeed: 5.0 };
    const baseBossStats = { life: 2000, maxLife: 2000, attackPower: 10 };
    const minionStats = { life: 1, attackPower: 2, collisionDamage: 20 };
    
    // 인트로 로직
    introSequence.classList.add('active');
    let currentSceneIndex = 0;
    introSequence.addEventListener('click', (e) => {
        if (currentSceneIndex >= scenes.length - 1 || e.target === startGameButton) return;
        scenes[currentSceneIndex].classList.remove('active');
        currentSceneIndex++;
        scenes[currentSceneIndex].classList.add('active');
    });

    startGameButton.addEventListener('click', () => {
        introSequence.style.display = 'none';
        gameContainer.style.display = 'block';
        initGame();
    });
    
    restartButton.addEventListener('click', () => {
        endingScreen.style.display = 'none';
        gameContainer.style.display = 'block';
        initGame();
    });

    // 게임 초기화
    function initGame() {
        playerStats = { ...basePlayerStats };
        bossInstance = { element: boss, ...baseBossStats };
        minionsDefeated = 0;
        currentScore = 0;
        isGameOver = false;
        isBerserk = false;
        isSuperWeaponActive = false;
        if(superWeaponCountdown) clearInterval(superWeaponCountdown);
        dashSuperWeapon.style.display = 'none';
        
        [...playerBullets, ...enemies, ...enemyBullets, ...items].forEach(obj => obj.element.remove());
        playerBullets = [], enemies = [], enemyBullets = [], items = [];

        player.style.left = '50%';
        player.style.transform = 'translateX(-50%)';
        boss.style.display = 'block';
        boss.className = '';

        updateUI();
        
        patterns.forEach(p => clearInterval(p));
        if(bossAttackInterval) clearInterval(bossAttackInterval);
        startPatterns();

        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    // 게임 루프
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
    
    // 게임 패턴
    function startPatterns() {
        patterns = [];
        const createAttackInterval = () => setInterval(() => { if(!isGameOver) createPlayerBullet() }, 1000 / playerStats.attackSpeed);
        patterns.push(createAttackInterval());
        
        bossAttackInterval = setInterval(() => { if(!isGameOver) createBossSpreadShot() }, 2000);
        
        patterns.push(setInterval(() => {
            if(!isGameOver) {
                enemies.forEach(enemy => createEnemyBullet(enemy.element, 90));
            }
        }, 3000));
        
        patterns.push(setInterval(() => { if(!isGameOver) createMinion() }, 5000));
    }

    // 객체 생성
    function createPlayerBullet() {
        if (isSuperWeaponActive) {
            const numBullets = 10;
            const angleSpread = 120;
            const startAngle = 210;
            for (let i = 0; i < numBullets; i++) {
                const angle = startAngle + (i * (angleSpread / (numBullets - 1)));
                const rad = angle * (Math.PI / 180);
                const speed = 8;
                const bullet = document.createElement('div');
                bullet.className = 'player-bullet';
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

    // 객체 이동
    function movePlayer() {
        let newLeft = mouseX - gameContainer.getBoundingClientRect().left - player.offsetWidth / 2;
        const minLeft = 0;
        const maxLeft = gameContainer.offsetWidth - player.offsetWidth;
        newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
        player.style.left = newLeft + 'px';
    }
    function moveObjects(objects) {
        objects.forEach(obj => {
            obj.x += obj.speedX; obj.y += obj.speedY;
            obj.element.style.left = (obj.x - obj.element.offsetWidth / 2) + 'px';
            obj.element.style.top = (obj.y - obj.element.offsetHeight / 2) + 'px';
        });
    }
    
    // 충돌 감지
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
                        minionsDefeated++;
                        currentScore += 100;
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

    // 아이템 효과
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
        else if (type === 'rifle' && playerStats.rifleLevel < 5) playerStats.rifleLevel++;
        else if (type === 'speed' && playerStats.attackSpeed < playerStats.maxAttackSpeed) {
            playerStats.attackSpeed = parseFloat((playerStats.attackSpeed + 0.5).toFixed(1));
            patterns.forEach(p => clearInterval(p)); startPatterns();
        }
    }

    // 화면 밖 객체 제거
    function cleanupObjects() {
        const cleanup = (arr) => { for (let i = arr.length - 1; i >= 0; i--) { if (arr[i].y < -50 || arr[i].y > gameContainer.offsetHeight + 50 || arr[i].x < -50 || arr[i].x > gameContainer.offsetWidth + 50) { arr[i].element.remove(); arr.splice(i, 1); } } };
        cleanup(playerBullets); cleanup(enemies); cleanup(enemyBullets); cleanup(items);
    }
    
    // UI 및 게임 종료
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
        if(superWeaponCountdown) clearInterval(superWeaponCountdown);

        const winStory = document.getElementById('ending-story-win');
        const loseStory = document.getElementById('ending-story-lose');
        const resultTitle = document.getElementById('result-title');
        if (isWin) {
            winStory.style.display = 'block'; loseStory.style.display = 'none';
            resultTitle.innerText = "MISSION CLEAR!";
        } else {
            winStory.style.display = 'none'; loseStory.style.display = 'block';
            resultTitle.innerText = "GAME OVER";
        }
        const finalLives = Math.max(0, playerStats.life);
        document.getElementById('result-lives').innerText = `${finalLives} (x10점)`;
        document.getElementById('result-minions').innerText = `${minionsDefeated} (x100점)`;
        const finalScore = (finalLives * 10) + (minionsDefeated * 100);
        document.getElementById('final-score').innerText = finalScore;
        boss.style.display = 'none';
        setTimeout(() => {
            gameContainer.style.display = 'none';
            endingScreen.style.display = 'flex';
        }, 1500);
    }
    
    window.addEventListener('mousemove', e => { mouseX = e.clientX; });
});
