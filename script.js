document.addEventListener('DOMContentLoaded', () => {

    // ... (DOM 요소 가져오기는 이전과 동일) ...
    const introSequence = document.getElementById('intro-sequence');
    const scenes = document.querySelectorAll('.scene');
    const startGameButton = document.getElementById('start-game-button');
    const gameContainer = document.getElementById('game-container');
    const player = document.getElementById('player');
    const boss = document.getElementById('boss');
    const playerHpBar = document.getElementById('player-hp-bar');
    const bossHpBar = document.getElementById('boss-hp-bar');
    const resultScreen = document.getElementById('result-screen');
    const restartButton = document.getElementById('restart-button');

    // ... (게임 상태 및 설정은 이전과 동일) ...
    let playerStats, bossInstance, minionsDefeated, gameLoopId; // --- 수정: gameLoopInterval -> gameLoopId
    let playerBullets = [], enemies = [], enemyBullets = [], items = [];
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let isGameOver = false;

    const basePlayerStats = { life: 100, maxLife: 100, attackPower: 1, rifleLevel: 1, attackSpeed: 1.0, maxAttackSpeed: 3.0 };
    const baseBossStats = { life: 2000, maxLife: 2000, attackPower: 10 };
    const minionStats = { life: 1, attackPower: 2 };
    
    // ... (인트로 및 재시작 로직은 이전과 동일) ...
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
        resultScreen.style.display = 'none';
        gameContainer.style.display = 'block'; // --- 추가: 게임 컨테이너 다시 표시
        initGame();
    });

    // =============================================
    // 게임 초기화 및 시작
    // =============================================
    function initGame() {
        playerStats = { ...basePlayerStats };
        bossInstance = { element: boss, ...baseBossStats };
        minionsDefeated = 0;
        isGameOver = false;
        
        [...playerBullets, ...enemies, ...enemyBullets, ...items].forEach(obj => obj.element.remove());
        playerBullets = [], enemies = [], enemyBullets = [], items = [];

        player.style.left = '225px'; // 플레이어 위치 초기화
        boss.style.display = 'block'; // 보스 다시 표시

        updateUI();
        
        startPatterns();
        // --- 수정: requestAnimationFrame으로 게임 루프 시작
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    // =============================================
    // 핵심 게임 루프 (requestAnimationFrame 기반)
    // =============================================
    function gameLoop() {
        if (isGameOver) return;

        movePlayer();
        moveObjects(playerBullets);
        moveObjects(enemies);
        moveObjects(enemyBullets);
        moveObjects(items);

        handleCollisions();
        cleanupObjects(); // --- 추가: 화면 밖 객체 제거 함수 호출
        updateUI();

        gameLoopId = requestAnimationFrame(gameLoop); // --- 수정: 다음 프레임에 루프 재귀 호출
    }
    
    // ... (게임 패턴 로직은 이전과 동일) ...
    let patterns = [];
    function startPatterns() {
        patterns.forEach(p => clearInterval(p));
        patterns = [];

        patterns.push(setInterval(() => { if(!isGameOver) createPlayerBullet() }, 1000 / playerStats.attackSpeed));
        patterns.push(setInterval(() => { if(!isGameOver) createEnemyBullet(boss) }, 2000));
        patterns.push(setInterval(() => { if(!isGameOver) createMinion() }, 5000));
    }

    // ... (객체 생성 로직은 이전과 동일) ...
    function createPlayerBullet() {
        const createBullet = (offsetX) => {
            const bullet = document.createElement('div');
            bullet.className = 'player-bullet';
            bullet.style.left = (player.offsetLeft + player.offsetWidth / 2 - 2.5 + offsetX) + 'px';
            bullet.style.top = (player.offsetTop) + 'px';
            gameContainer.appendChild(bullet);
            playerBullets.push({ element: bullet, x: bullet.offsetLeft, y: bullet.offsetTop, speedY: -10 });
        };
        if (playerStats.rifleLevel === 1) createBullet(0);
        else if (playerStats.rifleLevel === 2) { createBullet(-10); createBullet(10); }
        else { createBullet(-15); createBullet(0); createBullet(15); }
    }
    function createMinion() { /* 이전과 동일 */ 
        const minion = document.createElement('div'); minion.className = 'minion'; const x = Math.random() * (gameContainer.offsetWidth - 30); minion.style.left = x + 'px'; minion.style.top = '-30px'; gameContainer.appendChild(minion); enemies.push({ element: minion, x, y: -30, speedY: 2, ...minionStats });
    }
    function createEnemyBullet(source) { /* 이전과 동일 */ 
        const bullet = document.createElement('div'); bullet.className = 'enemy-bullet'; const x = source.offsetLeft + source.offsetWidth / 2 - 5; const y = source.offsetTop + source.offsetHeight; bullet.style.left = x + 'px'; bullet.style.top = y + 'px'; gameContainer.appendChild(bullet); enemyBullets.push({ element: bullet, x, y, speedY: 5 });
    }
    function createItem(x, y) { /* 이전과 동일 */
        const itemTypes = ['heal', 'rifle', 'speed']; const type = itemTypes[Math.floor(Math.random() * itemTypes.length)]; const item = document.createElement('div'); item.className = 'item item-' + type; item.style.left = x + 'px'; item.style.top = y + 'px'; gameContainer.appendChild(item); items.push({ element: item, x, y, type, speedY: 1 });
    }
    

    // ... (객체 이동 로직은 이전과 동일) ...
    function movePlayer() { player.style.left = (mouseX - gameContainer.offsetLeft - player.offsetWidth / 2) + 'px'; }
    function moveObjects(objects) { objects.forEach(obj => { obj.y += obj.speedY; obj.element.style.top = obj.y + 'px'; }); }
    

    // =============================================
    // 충돌 감지 및 처리 (안전한 방식으로 수정)
    // =============================================
    function handleCollisions() {
        // --- 수정: 안전한 역순 for 루프 사용
        // 플레이어 총알 vs 적
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const bullet = playerBullets[i];
            
            if (isColliding(bullet.element, boss)) {
                bossInstance.life -= playerStats.attackPower;
                bullet.element.remove();
                playerBullets.splice(i, 1);
                if (bossInstance.life <= 0 && !isGameOver) endGame(true);
                continue; // 이미 충돌했으므로 다음 총알로 넘어감
            }

            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if(isColliding(bullet.element, enemy.element)) {
                    enemy.life -= playerStats.attackPower;
                    bullet.element.remove();
                    playerBullets.splice(i, 1);
                    if(enemy.life <= 0) {
                        minionsDefeated++;
                        if(Math.random() < 0.3) createItem(enemy.x, enemy.y);
                        enemy.element.remove();
                        enemies.splice(j, 1);
                    }
                    break; // 총알이 사라졌으므로 이 총알에 대한 루프 종료
                }
            }
        }
        
        // 적 총알 vs 플레이어
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const bullet = enemyBullets[i];
            if(isColliding(bullet.element, player)) {
                playerStats.life -= minionStats.attackPower; // 데모에서는 미니언 공격력 사용
                bullet.element.remove();
                enemyBullets.splice(i, 1);
                if(playerStats.life <= 0 && !isGameOver) endGame(false);
            }
        }

        // 아이템 vs 플레이어
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if(isColliding(item.element, player)) {
                applyItemEffect(item.type);
                item.element.remove();
                items.splice(i, 1);
            }
        }
    }
    function isColliding(el1, el2) { /* 이전과 동일 */ 
         const rect1 = el1.getBoundingClientRect(); const rect2 = el2.getBoundingClientRect(); return !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
    }
    
    // =============================================
    // 아이템 효과 적용 (요청사항 반영)
    // =============================================
    function applyItemEffect(type) {
        if(type === 'heal') {
            playerStats.life = playerStats.maxLife; // --- 수정: 모두 회복
        }
        else if (type === 'rifle' && playerStats.rifleLevel < 3) {
            playerStats.rifleLevel++;
        }
        else if (type === 'speed' && playerStats.attackSpeed < playerStats.maxAttackSpeed) {
            playerStats.attackSpeed += 0.5;
            // 공격 속도 변경 시 타이머 재설정
            clearInterval(patterns[0]);
            patterns[0] = setInterval(() => { if(!isGameOver) createPlayerBullet() }, 1000 / playerStats.attackSpeed);
        }
    }

    // --- 추가: 화면 밖 객체 제거 함수 ---
    function cleanupObjects() {
        const cleanup = (arr) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                if (arr[i].y < -50 || arr[i].y > gameContainer.offsetHeight + 50) {
                    arr[i].element.remove();
                    arr.splice(i, 1);
                }
            }
        };
        cleanup(playerBullets);
        cleanup(enemies);
        cleanup(enemyBullets);
        cleanup(items);
    }
    
    // =============================================
    // UI 및 게임 종료
    // =============================================
    function updateUI() { /* 이전과 동일 */ 
        playerHpBar.style.width = Math.max(0, playerStats.life / playerStats.maxLife * 100) + '%';
        bossHpBar.style.width = Math.max(0, bossInstance.life / bossInstance.maxLife * 100) + '%';
    }

    function endGame(isWin) {
        isGameOver = true;
        cancelAnimationFrame(gameLoopId); // --- 수정: requestAnimationFrame 취소
        patterns.forEach(p => clearInterval(p));

        document.getElementById('result-title').innerText = isWin ? "MISSION CLEAR!" : "GAME OVER";
        const finalLives = Math.max(0, playerStats.life);
        document.getElementById('result-lives').innerText = `${finalLives} (x10점)`;
        document.getElementById('result-minions').innerText = `${minionsDefeated} (x100점)`;
        const finalScore = (finalLives * 10) + (minionsDefeated * 100);
        document.getElementById('final-score').innerText = finalScore;

        // --- 추가: 보스와 플레이어 숨기기
        boss.style.display = 'none';

        setTimeout(() => { // 잠시 후 결과 화면 표시
            gameContainer.style.display = 'none';
            resultScreen.style.display = 'flex';
        }, 1500);
    }
    
    // 마우스 위치 추적
    window.addEventListener('mousemove', e => { mouseX = e.clientX; });
});s
