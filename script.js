document.addEventListener('DOMContentLoaded', () => {

    // DOM 요소
    const introSequence = document.getElementById('intro-sequence');
    const scenes = document.querySelectorAll('.scene');
    const startGameButton = document.getElementById('start-game-button');
    const gameContainer = document.getElementById('game-container');
    const player = document.getElementById('player');
    const boss = document.getElementById('boss');
    const playerHpBar = document.getElementById('player-hp-bar');
    const bossHpBar = document.getElementById('boss-hp-bar');
    const endingScreen = document.getElementById('ending-screen');
    const restartButton = document.getElementById('restart-button');

    // 게임 상태 및 설정
    let playerStats, bossInstance, minionsDefeated, gameLoopId;
    let playerBullets = [], enemies = [], enemyBullets = [], items = [];
    let mouseX = window.innerWidth / 2;
    let isGameOver = false;
    let patterns = [];

    const basePlayerStats = { life: 100, maxLife: 100, attackPower: 1, rifleLevel: 1, attackSpeed: 1.0, maxAttackSpeed: 3.0 };
    const baseBossStats = { life: 2000, maxLife: 2000, attackPower: 10 };
    const minionStats = { life: 1, attackPower: 2 };
    
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
        isGameOver = false;
        
        [...playerBullets, ...enemies, ...enemyBullets, ...items].forEach(obj => obj.element.remove());
        playerBullets = [], enemies = [], enemyBullets = [], items = [];

        player.style.left = '50%';
        player.style.transform = 'translateX(-50%)';
        boss.style.display = 'block';

        updateUI();
        
        patterns.forEach(p => clearInterval(p)); // 이전 패턴 제거
        startPatterns();
        if(gameLoopId) cancelAnimationFrame(gameLoopId); // 이전 루프 취소
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
        patterns.push(setInterval(() => { if(!isGameOver) createEnemyBullet(boss) }, 2000));
        patterns.push(setInterval(() => { if(!isGameOver) createMinion() }, 5000));
    }

    // 객체 생성
    function createPlayerBullet() {
        const createBullet = (offsetX) => {
            const bullet = document.createElement('div'); bullet.className = 'player-bullet';
            bullet.style.left = (player.offsetLeft + player.offsetWidth / 2 - 2.5 + offsetX) + 'px';
            bullet.style.top = (player.offsetTop) + 'px';
            gameContainer.appendChild(bullet);
            playerBullets.push({ element: bullet, y: bullet.offsetTop, speedY: -10 });
        };
        if (playerStats.rifleLevel === 1) createBullet(0);
        else if (playerStats.rifleLevel === 2) { createBullet(-10); createBullet(10); }
        else { createBullet(-15); createBullet(0); createBullet(15); }
    }
    function createMinion() {
        const minion = document.createElement('img');
        minion.src = 'minion_ingame.png'; // 경로 수정
        minion.className = 'minion';
        const x = Math.random() * (gameContainer.offsetWidth - 40);
        minion.style.left = x + 'px'; minion.style.top = '-40px';
        gameContainer.appendChild(minion);
        enemies.push({ element: minion, x, y: -40, life: minionStats.life, speedY: 2 });
    }
    function createEnemyBullet(source) {
        const bullet = document.createElement('div'); bullet.className = 'enemy-bullet';
        const x = source.offsetLeft + source.offsetWidth / 2 - 5; const y = source.offsetTop + source.offsetHeight;
        bullet.style.left = x + 'px'; bullet.style.top = y + 'px';
        gameContainer.appendChild(bullet);
        enemyBullets.push({ element: bullet, y, speedY: 5 });
    }
    function createItem(x, y) {
        const itemTypes = ['heal', 'rifle', 'speed']; const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        const item = document.createElement('div'); item.className = 'item item-' + type;
        item.style.left = x + 'px'; item.style.top = y + 'px';
        gameContainer.appendChild(item);
        items.push({ element: item, y, type, speedY: 1 });
    }

    // 객체 이동
    function movePlayer() {
        let newLeft = mouseX - gameContainer.getBoundingClientRect().left - player.offsetWidth / 2;
        // 게임 컨테이너 경계 체크
        const minLeft = 0;
        const maxLeft = gameContainer.offsetWidth - player.offsetWidth;
        newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
        player.style.left = newLeft + 'px';
    }
    function moveObjects(objects) { objects.forEach(obj => { obj.y += obj.speedY; obj.element.style.top = obj.y + 'px'; }); }
    
    // 충돌 감지
    function handleCollisions() {
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const bullet = playerBullets[i];
            if (!bullet) continue;
            if (isColliding(bullet.element, boss)) {
                bossInstance.life -= playerStats.attackPower;
                bullet.element.remove(); playerBullets.splice(i, 1);
                if (bossInstance.life <= 0 && !isGameOver) endGame(true);
                continue;
            }
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if(isColliding(bullet.element, enemy.element)) {
                    enemy.life -= playerStats.attackPower;
                    bullet.element.remove(); playerBullets.splice(i, 1);
                    if(enemy.life <= 0) {
                        minionsDefeated++;
                        if(Math.random() < 0.3) createItem(enemy.element.offsetLeft, enemy.element.offsetTop);
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
                bullet.element.remove(); enemyBullets.splice(i, 1);
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
        if(type === 'heal') playerStats.life = playerStats.maxLife;
        else if (type === 'rifle' && playerStats.rifleLevel < 3) playerStats.rifleLevel++;
        else if (type === 'speed' && playerStats.attackSpeed < playerStats.maxAttackSpeed) {
            playerStats.attackSpeed += 0.5;
            startPatterns(); // 공격 속도 변경 시 타이머 재설정
        }
    }

    // 화면 밖 객체 제거
    function cleanupObjects() {
        const cleanup = (arr) => { for (let i = arr.length - 1; i >= 0; i--) { if (arr[i].y < -50 || arr[i].y > gameContainer.offsetHeight + 50) { arr[i].element.remove(); arr.splice(i, 1); } } };
        cleanup(playerBullets); cleanup(enemies); cleanup(enemyBullets); cleanup(items);
    }
    
    // UI 및 게임 종료
    function updateUI() {
        playerHpBar.style.width = Math.max(0, playerStats.life / playerStats.maxLife * 100) + '%';
        bossHpBar.style.width = Math.max(0, bossInstance.life / bossInstance.maxLife * 100) + '%';
    }
    function endGame(isWin) {
        isGameOver = true;
        cancelAnimationFrame(gameLoopId);
        patterns.forEach(p => clearInterval(p));

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
