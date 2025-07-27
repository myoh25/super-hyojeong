document.addEventListener('DOMContentLoaded', () => {

    // --- DOM 요소 ---
    const getEl = (id) => document.getElementById(id);
    const wrapper = getEl('wrapper');
    const screens = document.querySelectorAll('.screen');
    const loadingScreen = getEl('loading-screen');
    const titleScreen = getEl('title-screen');
    const helpScreen = getEl('help-screen');
    const introSequence = getEl('intro-sequence');
    const gameContainer = getEl('game-container');
    const endingScreen = getEl('ending-screen');
    const realStartButton = getEl('real-start-button');
    const startGameButton = getEl('start-game-button');
    const restartButton = getEl('restart-button');
    const player = getEl('player');
    const boss = getEl('boss');
    const playerHpBar = getEl('player-hp-bar');
    const bossHpBar = getEl('boss-hp-bar');
    const playerHpValue = getEl('player-hp-value');
    const bossHpValue = getEl('boss-hp-value');
    const currentScoreValue = getEl('current-score-value');
    const dashRifleLvl = getEl('dash-rifle-lvl');
    const dashSpeedLvl = getEl('dash-speed-lvl');
    const dashSuperWeapon = getEl('dash-super-weapon');
    const dashSuperTimer = getEl('dash-super-timer');
    const dashSuperHyojeong = getEl('dash-super-hyojeong');
    const dashShjTimer = getEl('dash-shj-timer');
    const bgmToggle = getEl('bgm-toggle');
    const bgm = getEl('bgm');
    const joystick = getEl('joystick');
    const stick = getEl('stick');

    // --- 게임 상태 및 설정 ---
    let playerStats, bossState, minionsDefeated, score, gameLoopId, finalScore;
    let playerBullets = [], enemies = [], enemyBullets = [], items = [];
    let isGameOver = false, isBerserk = false, isSuperActive = false, isMusicPlaying = false, isInvincible = false;
    let superTimerId, shjTimerId, sceneIndex = 0;
    let patterns = [], bossAttackId, bossMoveId;
    let joyActive = false, joyVec = { x: 0, y: 0 };
    let joyCenter = { x: 0, y: 0 }, joyRadius = 0;
    let gameRect = gameContainer.getBoundingClientRect();

    const PLAYER_MOVE_SPEED = 6;
    const basePlayerStats = { life: 200, maxLife: 200, attackPower: 1, rifleLevel: 1, attackSpeed: 1.0, maxAttackSpeed: 5.0 };
    const baseBossStats   = { life: 2000, maxLife: 2000, attackPower: 10, moveSpeed: 2, moveDirection: 1 };
    const minionStats     = { life: 1, attackPower: 2, collisionDamage: 20 };

    const imagesToLoad = ['hyojeong_ingame.png', 'boss.png', 'minion_ingame.png', 'hyojeong_intro_ending.png', 'minyeol_intro_ending.png'];
    function preloadImages(urls, cb) {
        let loaded = 0;
        urls.forEach(src => {
            const img = new Image();
            img.src = src;
            img.onload = img.onerror = () => { if (++loaded === urls.length) cb(); };
        });
    }

    // --- 화면 전환 ---
    function showScreen(screen) {
        screens.forEach(s => s.classList.remove('active'));
        if (screen) screen.classList.add('active');
    }

    function initTitleScreen() {
        let active = true;
        showScreen(titleScreen);
        function onInteract() {
            if (!active) return;
            active = false;
            if (!isMusicPlaying) bgm.play().then(() => isMusicPlaying = true).catch(() => {});
            showScreen(helpScreen);
            window.removeEventListener('keydown', onInteract);
            window.removeEventListener('click', onInteract);
        }
        window.addEventListener('keydown', onInteract);
        window.addEventListener('click', onInteract);
    }

    realStartButton.addEventListener('click', () => {
        sceneIndex = 0;
        introSequence.querySelectorAll('.scene').forEach((sc, i) => sc.classList.toggle('active', i === 0));
        showScreen(introSequence);
    });

    introSequence.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') return;
        const scs = introSequence.querySelectorAll('.scene');
        if (sceneIndex < scs.length - 1) {
            const currentActiveScene = introSequence.querySelector('.scene.active');
            if(currentActiveScene) currentActiveScene.classList.remove('active');
            scs[++sceneIndex].classList.add('active');
        }
    });

    startGameButton.addEventListener('click', () => {
        showScreen(gameContainer);
        initGame();
    });

    restartButton.addEventListener('click', () => {
        showScreen(titleScreen);
        initTitleScreen();
    });

    bgmToggle.addEventListener('click', () => {
        bgm.muted = !bgm.muted;
        bgmToggle.innerText = bgm.muted ? '🎵 BGM OFF' : '🎵 BGM ON';
        bgmToggle.classList.toggle('muted', bgm.muted);
        if (!bgm.muted && bgm.paused) bgm.play();
    });

    // --- 게임 초기화 ---
    function initGame() {
        playerStats     = { ...basePlayerStats };
        bossState       = { element: boss, ...baseBossStats, x: gameContainer.offsetWidth / 2 };
        minionsDefeated = 0; score = 0;
        isGameOver = false; isBerserk = false; isSuperActive = false; isInvincible = false;
        
        patterns.forEach(id => clearInterval(id));
        patterns = [];
        clearInterval(bossAttackId);
        clearInterval(bossMoveId);
        clearInterval(superTimerId);
        clearInterval(shjTimerId);

        gameContainer.querySelectorAll('.player-bullet, .minion, .enemy-bullet, .item').forEach(el => el.remove());
        playerBullets = [], enemies = [], enemyBullets = [], items = [];

        player.style.left = (gameContainer.offsetWidth / 2 - player.offsetWidth / 2) + 'px';
        player.style.top  = (gameContainer.offsetHeight - player.offsetHeight - 30) + 'px';
        boss.style.display = 'block';
        boss.classList.remove('hit');
        player.classList.remove('invincible');
        dashSuperWeapon.style.display = 'none';
        dashSuperHyojeong.style.display = 'none';
        getEl('score-details').style.display = 'none';
        getEl('win-sequence').style.display = 'none';

        const rect = joystick.getBoundingClientRect();
        joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        joyRadius = rect.width / 2;

        updateUI();
        startPatterns();
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    // --- 메인 루프 ---
    function gameLoop() {
        if (isGameOver) return;
        movePlayerByJoystick();
        moveObjects(playerBullets);
        moveObjects(enemies);
        moveObjects(enemyBullets);
        moveObjects(items);
        moveBoss();
        handleCollisions();
        cleanupObjects();
        updateUI();
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    // --- 패턴 시작 ---
    function startPatterns() {
        patterns.push(setInterval(() => !isGameOver && createPlayerBullet(), 800 / playerStats.attackSpeed));
        bossAttackId = setInterval(() => !isGameOver && createBossSpreadShot(), 1400);
        patterns.push(setInterval(() => !isGameOver && enemies.forEach(e => createEnemyBullet(e.element, 90)), 2500));
        patterns.push(setInterval(() => !isGameOver && createMinion(), 500));
        patterns.push(setInterval(() => !isGameOver && createItem(Math.random()*(gameRect.width-30), Math.random()*(gameRect.height-30)), 3000));
        bossMoveId = setInterval(() => !isGameOver && moveBoss(), 50);
    }

    // --- 생성 함수들 ---
    function createPlayerBullet() {
        if (isSuperActive) {
            const num = isInvincible ? 30 : 10, speed = 15;
            for (let i = 0; i < num; i++) {
                const angle = (360 / num) * i, rad = angle * Math.PI / 180;
                const b = document.createElement('div'); b.className = 'player-bullet';
                b.style.left = (player.offsetLeft+player.offsetWidth/2-4) + 'px'; b.style.top = player.offsetTop + 'px';
                gameContainer.appendChild(b);
                playerBullets.push({ element: b, x: b.offsetLeft, y: b.offsetTop, speedX: speed * Math.cos(rad), speedY: speed * Math.sin(rad), attackPower: 10 });
            }
            return;
        }
        const shoot = off => {
            const b = document.createElement('div'); b.className = 'player-bullet';
            b.style.left = (player.offsetLeft + player.offsetWidth / 2 - 4 + off) + 'px';
            b.style.top = player.offsetTop + 'px';
            gameContainer.appendChild(b);
            playerBullets.push({ element: b, x: b.offsetLeft, y: b.offsetTop, speedX: 0, speedY: -10 });
        };
        switch (playerStats.rifleLevel) {
            case 1: shoot(0); break;
            case 2: shoot(-8); shoot(8); break;
            case 3: shoot(-12); shoot(0); shoot(12); break;
            case 4: shoot(-18); shoot(-6); shoot(6); shoot(18); break;
            case 5: shoot(-24); shoot(-12); shoot(0); shoot(12); shoot(24); break;
        }
    }
    function createMinion() {
        const m = document.createElement('img');
        m.src = 'minion_ingame.png';
        m.className = 'minion';
        const x = Math.random() * (gameContainer.offsetWidth - 40);
        m.style.left = x + 'px';
        m.style.top  = '-40px';
        gameContainer.appendChild(m);
        enemies.push({
            element: m, x, y: -40,
            life: minionStats.life, attackPower: minionStats.attackPower,
            collisionDamage: minionStats.collisionDamage,
            speedX: 0, speedY: 2
        });
    }
    function createEnemyBullet(src, angle) {
        const bullet = document.createElement('div');
        bullet.className = 'enemy-bullet';
        const r1 = src.getBoundingClientRect();
        const r2 = gameContainer.getBoundingClientRect();
        const x = r1.left - r2.left + r1.width / 2;
        const y = r1.top  - r2.top  + r1.height;
        bullet.style.left = (x - 6) + 'px';
        bullet.style.top  = (y - 6) + 'px';
        gameContainer.appendChild(bullet);
        const rad = angle * Math.PI / 180, speed = 5;
        enemyBullets.push({ element: bullet, x, y, speedX: speed * Math.cos(rad), speedY: speed * Math.sin(rad) });
    }
    function createBossSpreadShot() { [75, 90, 105].forEach(a => createEnemyBullet(boss, a)); }
    function createItem(x, y) {
        let type, r = Math.random();
        if (r < 0.03) type = 'superhyojeong';
        else if (r < 0.15) type = 'superweapon';
        else if (r < 0.40) type = 'heal';
        else if (r < 0.70) type = 'rifle';
        else type = 'speed';
        const it = document.createElement('div'); it.className = `item item-${type}`;
        it.style.left = x+'px'; it.style.top=y+'px';
        gameContainer.appendChild(it);
        items.push({ element: it, x, y, type, speedX: 0, speedY: 1 });
    }

    // --- 이동 함수들 ---
    function movePlayerByJoystick() {
        if (!joyActive) return;
        let cx = player.offsetLeft+player.offsetWidth/2+joyVec.x*PLAYER_MOVE_SPEED;
        let cy = player.offsetTop+player.offsetHeight/2+joyVec.y*PLAYER_MOVE_SPEED;
        cx = Math.max(player.offsetWidth/2, Math.min(cx, gameRect.width-player.offsetWidth/2));
        cy = Math.max(gameRect.height*0.25, Math.min(cy, gameRect.height-player.offsetHeight/2));
        player.style.left=(cx-player.offsetWidth/2)+'px';
        player.style.top=(cy-player.offsetHeight/2)+'px';
    }
    function moveBoss() {
        if (isGameOver) return;
        bossState.x += bossState.moveSpeed * bossState.moveDirection;
        if (bossState.x > gameContainer.offsetWidth - boss.offsetWidth/2 || bossState.x < boss.offsetWidth/2) {
          bossState.moveDirection *= -1;
        }
        boss.style.left = (bossState.x - boss.offsetWidth/2) + 'px';
    }
    function moveObjects(arr) {
        arr.forEach(o => {
            o.x += o.speedX;
            o.y += o.speedY;
            o.element.style.left = (o.x - o.element.offsetWidth / 2) + 'px';
            o.element.style.top  = (o.y - o.element.offsetHeight / 2) + 'px';
        });
    }

    // --- 충돌 감지 & 처리 ---
    function isColliding(a, b) {
        const r1=a.getBoundingClientRect(),r2=b.getBoundingClientRect();
        return !(r1.right<r2.left||r1.left>r2.right||r1.bottom<r2.top||r1.top>r2.bottom);
    }
    function handleHit(el) { el.classList.add('hit'); setTimeout(()=>el.classList.remove('hit'), 100); }
    function handleCollisions() {
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const bt = playerBullets[i];
            if (!bt) continue;
            const dmg = bt.attackPower || playerStats.attackPower;
            if (isColliding(bt.element, boss)) {
                handleHit(boss);
                bossState.life -= dmg;
                if (!isBerserk && bossState.life <= baseBossStats.life/2) {
                    isBerserk = true;
                    clearInterval(bossAttackId);
                    bossAttackId = setInterval(() => !isGameOver && createBossSpreadShot(), 1000);
                }
                bt.element.remove();
                playerBullets.splice(i, 1);
                if (bossState.life <= 0) endGame(true);
                continue;
            }
            for (let j = enemies.length - 1; j >= 0; j--) {
                const en = enemies[j];
                if (isColliding(bt.element, en.element)) {
                    handleHit(en.element);
                    en.life -= dmg;
                    bt.element.remove();
                    playerBullets.splice(i, 1);
                    if (en.life <= 0) {
                        minionsDefeated++;
                        score += 100;
                        if (Math.random() < 0.5) createItem(en.x, en.y);
                        en.element.remove();
                        enemies.splice(j, 1);
                    }
                    break;
                }
            }
        }
        if (isInvincible) return;
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const bt = enemyBullets[i];
            if (isColliding(bt.element, player)) {
                playerStats.life -= baseBossStats.attackPower;
                wrapper.classList.add('shake');
                setTimeout(() => wrapper.classList.remove('shake'), 100);
                bt.element.remove();
                enemyBullets.splice(i, 1);
                if (playerStats.life <= 0) endGame(false);
            }
        }
        for (let i = enemies.length - 1; i >= 0; i--) {
            const en = enemies[i];
            if (isColliding(en.element, player)) {
                playerStats.life -= en.collisionDamage;
                wrapper.classList.add('shake');
                setTimeout(() => wrapper.classList.remove('shake'), 100);
                en.element.remove();
                enemies.splice(i, 1);
                if (playerStats.life <= 0) endGame(false);
            }
        }
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (isColliding(it.element, player)) {
                applyItemEffect(it.type);
                it.element.remove();
                items.splice(i, 1);
            }
        }
    }

    // --- 아이템 효과 ---
    function applyItemEffect(type) {
        if (type === 'superhyojeong') {
            isInvincible = true;
            player.classList.add('invincible');
            let t = 10;
            dashShjTimer.innerText=t;
            dashSuperHyojeong.style.display='block';
            clearInterval(shjTimerId);
            shjTimerId = setInterval(() => {
                dashShjTimer.innerText = --t;
                if (t <= 0) { clearInterval(shjTimerId); dashSuperHyojeong.style.display='none'; isInvincible=false; player.classList.remove('invincible'); }
            }, 1000);
            applyItemEffect('superweapon');
        }
        else if (type === 'superweapon') {
            if (isSuperActive && !isInvincible) return;
            isSuperActive = true;
            let t = 10;
            dashSuperTimer.innerText = t;
            dashSuperWeapon.style.display = 'block';
            clearInterval(superTimerId);
            superTimerId = setInterval(() => {
                dashSuperTimer.innerText = --t;
                if (t <= 0) {
                    clearInterval(superTimerId);
                    dashSuperWeapon.style.display = 'none';
                    isSuperActive = false;
                }
            }, 1000);
        } else if (type === 'heal') {
            playerStats.life = playerStats.maxLife;
        } else if (type === 'rifle' && playerStats.rifleLevel < 5) {
            playerStats.rifleLevel++;
            playerStats.attackPower += 3;
        } else if (type === 'speed' && playerStats.attackSpeed < playerStats.maxAttackSpeed) {
            playerStats.attackSpeed = parseFloat((playerStats.attackSpeed + 0.5).toFixed(1));
            patterns.forEach(id => clearInterval(id));
            patterns = [];
            startPatterns();
        }
    }

    // --- 화면 밖 오브젝트 정리 ---
    function cleanupObjects() {
        [playerBullets, enemies, enemyBullets, items].forEach(arr => {
            for (let i = arr.length - 1; i >= 0; i--) {
                const o = arr[i];
                if (o.y < -50 || o.y > gameContainer.offsetHeight + 50 || o.x < -50 || o.x > gameContainer.offsetWidth + 50) {
                    o.element.remove();
                    arr.splice(i, 1);
                }
            }
        });
    }

    // --- UI 업데이트 & 게임 종료 ---
    function updateUI() {
        const pl = Math.max(0, playerStats.life);
        const bl = Math.max(0, bossState.life);
        playerHpBar.style.width = (pl / playerStats.maxLife * 100) + '%';
        bossHpBar.style.width   = (bl / baseBossStats.maxLife * 100) + '%';
        playerHpValue.innerText = `${pl}/${playerStats.maxLife}`;
        bossHpValue.innerText   = `${bl}/${baseBossStats.maxLife}`;
        currentScoreValue.innerText = score;
        dashRifleLvl.innerText    = playerStats.rifleLevel;
        dashSpeedLvl.innerText    = playerStats.attackSpeed.toFixed(1);
    }
    function endGame(win) {
        if (isGameOver) return;
        isGameOver = true;
        cancelAnimationFrame(gameLoopId);
        patterns.forEach(id=>clearInterval(id));
        clearInterval(bossAttackId);
        clearInterval(bossMoveId);
        clearInterval(superTimerId);
        clearInterval(shjTimerId);

        const winSeq = getEl('win-sequence'), loseS = getEl('ending-story-lose'), scoreD = getEl('score-details');
        
        if (win) {
            loseS.style.display = 'none'; winSeq.style.display = 'block';
            let winSceneIndex = 0;
            const winScenes = winSeq.querySelectorAll('.scene');
            winScenes.forEach((s,i)=>s.classList.toggle('active', i===0));
            const winClickHandler = () => {
                if (winSceneIndex < winScenes.length - 1) {
                    winScenes[winSceneIndex].classList.remove('active');
                    winScenes[++winSceneIndex].classList.add('active');
                } else {
                    winSeq.removeEventListener('click', winClickHandler);
                    scoreD.style.display = 'block';
                }
            };
            winSeq.addEventListener('click', winClickHandler);
        } else {
            winSeq.style.display = 'none'; loseS.style.display = 'block'; scoreD.style.display = 'block';
        }
        
        const lives = Math.max(0, playerStats.life);
        getEl('result-lives').innerText   = `${lives} (x10점)`;
        getEl('result-minions').innerText = `${minionsDefeated} (x100점)`;
        finalScore = lives * 10 + score;
        getEl('final-score').innerText = finalScore;

        boss.style.display = 'none';
        showScreen(endingScreen);
    }

    // --- 조이스틱 이벤트 ---
    joystick.addEventListener('pointerdown', e => {
      joyActive = true;
      e.preventDefault();
    }, { passive: false });

    joystick.addEventListener('pointermove', e => {
      if (!joyActive) return;
      const dx = e.clientX - joyCenter.x, dy = e.clientY - joyCenter.y;
      const dist = Math.hypot(dx, dy);
      const ratio = Math.min(dist, joyRadius) / joyRadius;
      joyVec.x = (dx / dist) * ratio;
      joyVec.y = (dy / dist) * ratio;
      const maxOff = joyRadius - stick.offsetWidth / 2;
      const mx = joyVec.x * maxOff, my = joyVec.y * maxOff;
      stick.style.transform = `translate(${mx}px, ${my}px)`;
      e.preventDefault();
    }, { passive: false });
    
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
        joystick.addEventListener(evt, () => {
            joyActive = false;
            joyVec = { x: 0, y: 0 };
            stick.style.transform = 'translate(-50%, -50%)';
        }, { passive: false });
    });

    // --- 창 리사이즈 및 초기 실행 ---
    window.addEventListener('resize', () => gameRect = gameContainer.getBoundingClientRect());
    preloadImages(imagesToLoad, initTitleScreen);
});
