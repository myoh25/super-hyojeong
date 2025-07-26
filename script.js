document.addEventListener('DOMContentLoaded', () => {
  // --- DOM 요소 조회 ---
  const $ = id => document.getElementById(id);
  const wrapper         = $('wrapper');
  const screens         = document.querySelectorAll('.screen');
  const titleScreen     = $('title-screen');
  const helpScreen      = $('help-screen');
  const introSequence   = $('intro-sequence');
  const gameContainer   = $('game-container');
  const endingScreen    = $('ending-screen');
  const realStartButton = $('real-start-button');
  const startGameButton = $('start-game-button');
  const restartButton   = $('restart-button');
  const player          = $('player');
  const boss            = $('boss');
  const playerHpBar     = $('player-hp-bar');
  const bossHpBar       = $('boss-hp-bar');
  const playerHpValue   = $('player-hp-value');
  const bossHpValue     = $('boss-hp-value');
  const currentScoreVal = $('current-score-value');
  const dashRifleLvl    = $('dash-rifle-lvl');
  const dashSpeedLvl    = $('dash-speed-lvl');
  const dashSuperWeapon = $('dash-super-weapon');
  const dashSuperTimer  = $('dash-super-timer');
  const bgmToggle       = $('bgm-toggle');
  const bgm             = $('bgm');
  // --- 가상 조이스틱 요소 (HTML에 추가 필요) ---
  const joystick        = $('joystick');
  const stick           = $('stick');

  // --- 상태 변수 ---
  let playerStats, bossState, minionsDefeated, score, gameLoopId, finalScore;
  let playerBullets = [], enemies = [], enemyBullets = [], items = [];
  let isGameOver=false, isBerserk=false, isSuperActive=false, isMusicPlaying=false;
  let superTimerId, sceneIndex=0;
  let patterns = [], bossAttackId, bossMoveId;
  // 조이스틱 상태
  let joyActive=false, joyVec={x:0,y:0};
  let joyCenter={x:0,y:0}, joyRadius=0;

  const basePlayerStats = { life:200, maxLife:200, attackPower:1, rifleLevel:1, attackSpeed:1.0, maxAttackSpeed:5.0 };
  const baseBossStats   = { life:2000, maxLife:2000, attackPower:10, moveSpeed:2, moveDirection:1 };
  const minionStats     = { life:1, attackPower:2, collisionDamage:20 };
  const PLAYER_MOVE_SPEED = 6; // 픽셀/frame

  // --- 이미지 프리로딩 ---
  const imagesToLoad = [
    'hyojeong_ingame.png',
    'boss.png',
    'minion_ingame.png',
    'hyojeong_intro_ending.png',
    'minyeol_intro_ending.png'
  ];
  function preloadImages(urls, cb) {
    let loaded = 0;
    urls.forEach(src => {
      const img = new Image();
      img.src = src;
      img.onload = img.onerror = () => {
        if (++loaded === urls.length) cb();
      };
    });
  }

  // --- 화면 전환 헬퍼 ---
  function showScreen(screen) {
    screens.forEach(s => s.classList.remove('active'));
    if (screen) screen.classList.add('active');
  }

  // --- 타이틀 화면 초기화 ---
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

  // --- REAL START 클릭 → 인트로 ---
  realStartButton.addEventListener('click', () => {
    sceneIndex = 0;
    introSequence.querySelectorAll('.scene').forEach((sc,i) =>
      sc.classList.toggle('active', i===0)
    );
    showScreen(introSequence);
  });

  // --- 인트로 장면 전환 ---
  introSequence.addEventListener('click', e => {
    if (e.target.tagName==='BUTTON') return;
    const scs = introSequence.querySelectorAll('.scene');
    if (sceneIndex < scs.length - 1) {
      scs[sceneIndex].classList.remove('active');
      scs[++sceneIndex].classList.add('active');
    }
  });

  // --- START GAME 클릭 ---
  startGameButton.addEventListener('click', () => {
    showScreen(gameContainer);
    initGame();
  });

  // --- RESTART 클릭 → 타이틀로 ---
  restartButton.addEventListener('click', () => {
    patterns.forEach(id=>clearInterval(id));
    clearInterval(bossAttackId);
    clearInterval(bossMoveId);
    clearInterval(superTimerId);
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameContainer.querySelectorAll('.player-bullet,.minion,.enemy-bullet,.item')
      .forEach(el=>el.remove());
    playerBullets=enemies=enemyBullets=items=[];
    showScreen(titleScreen);
    initTitleScreen();
  });

  // --- BGM 토글 ---
  bgmToggle.addEventListener('click', () => {
    bgm.muted = !bgm.muted;
    bgmToggle.innerText = bgm.muted ? '🎵 BGM OFF' : '🎵 BGM ON';
    bgmToggle.classList.toggle('muted', bgm.muted);
    if (!bgm.muted && bgm.paused) bgm.play();
  });

  // --- 게임 초기화 ---
  function initGame() {
    playerStats     = {...basePlayerStats};
    bossState       = {element:boss, ...baseBossStats, x:gameContainer.offsetWidth/2};
    minionsDefeated = 0; score = 0;
    isGameOver=false; isBerserk=false; isSuperActive=false;
    patterns.forEach(id=>clearInterval(id)); patterns=[];
    clearInterval(bossAttackId);
    clearInterval(bossMoveId);
    clearInterval(superTimerId);
    gameContainer.querySelectorAll('.player-bullet,.minion,.enemy-bullet,.item')
      .forEach(el=>el.remove());
    playerBullets=enemies=enemyBullets=items=[];
    player.style.left = (gameContainer.offsetWidth/2 - player.offsetWidth/2)+'px';
    player.style.top  = (gameContainer.offsetHeight - player.offsetHeight -30)+'px';
    boss.style.display          = 'block';
    dashSuperWeapon.style.display = 'none';
    // 조이스틱 중심/반경 계산
    const rect = joystick.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    joyRadius = rect.width/2;
    updateUI();
    startPatterns();
    gameLoopId = requestAnimationFrame(gameLoop);
  }

  // --- 메인 루프 ---
  function gameLoop() {
    if (isGameOver) return;
    movePlayerByJoystick();
    [playerBullets,enemies,enemyBullets,items].forEach(arr=>moveObjects(arr));
    handleCollisions();
    cleanupObjects();
    updateUI();
    gameLoopId = requestAnimationFrame(gameLoop);
  }

  // --- 패턴 시작 ---
  function startPatterns() {
    patterns.push(setInterval(()=>!isGameOver&&createPlayerBullet(), 1000/playerStats.attackSpeed));
    bossAttackId = setInterval(()=>!isGameOver&&createBossSpreadShot(), 2000);
    patterns.push(setInterval(()=>!isGameOver&&enemies.forEach(e=>createEnemyBullet(e.element,90)),3000));
    patterns.push(setInterval(()=>!isGameOver&&createMinion(),2500));
    bossMoveId = setInterval(()=>!isGameOver&&moveBoss(),50);
    patterns.push(setInterval(()=>{
      if(!isGameOver){
        const x=Math.random()*(gameContainer.offsetWidth-30);
        const y=Math.random()*(gameContainer.offsetHeight-30);
        createItem(x,y);
      }
    },3000));
  }

  // --- 생성 함수들 ---
  function createPlayerBullet() {
    if (isSuperActive) {
      const num=30, speed=15;
      for(let i=0;i<num;i++){
        const angle=(360/num)*i, rad=angle*Math.PI/180;
        const b=document.createElement('div');
        b.className='player-bullet';
        b.style.left=(player.offsetLeft+player.offsetWidth/2-4)+'px';
        b.style.top=player.offsetTop+'px';
        gameContainer.appendChild(b);
        playerBullets.push({
          element:b, x:b.offsetLeft, y:b.offsetTop,
          speedX:speed*Math.cos(rad), speedY:speed*Math.sin(rad),
          attackPower:10
        });
      }
      return;
    }
    const shoot = off=>{
      const b=document.createElement('div');
      b.className='player-bullet';
      b.style.left=(player.offsetLeft+player.offsetWidth/2-4+off)+'px';
      b.style.top=player.offsetTop+'px';
      gameContainer.appendChild(b);
      playerBullets.push({element:b,x:b.offsetLeft,y:b.offsetTop,speedX:0,speedY:-10});
    };
    switch(playerStats.rifleLevel){
      case 2: shoot(-8); shoot(8); break;
      case 3: shoot(-12); shoot(0); shoot(12); break;
      case 4: shoot(-18); shoot(-6); shoot(6); shoot(18); break;
      case 5: shoot(-24); shoot(-12); shoot(0); shoot(12); shoot(24); break;
      default: shoot(0);
    }
  }

  function createMinion() {
    const m=document.createElement('img');
    m.src='minion_ingame.png'; m.className='minion';
    const x=Math.random()*(gameContainer.offsetWidth-40);
    m.style.left=x+'px'; m.style.top='-40px';
    gameContainer.appendChild(m);
    enemies.push({
      element:m, x, y:-40,
      life:minionStats.life,
      attackPower:minionStats.attackPower,
      collisionDamage:minionStats.collisionDamage,
      speedX:0, speedY:2
    });
  }

  function createEnemyBullet(src,angle){
    const b=document.createElement('div');
    b.className='enemy-bullet';
    const r1=src.getBoundingClientRect(), r2=gameContainer.getBoundingClientRect();
    const x=r1.left-r2.left+r1.width/2, y=r1.top-r2.top+r1.height;
    b.style.left=(x-6)+'px'; b.style.top=(y-6)+'px';
    gameContainer.appendChild(b);
    const rad=angle*Math.PI/180, sp=5;
    enemyBullets.push({element:b,x,y,speedX:sp*Math.cos(rad),speedY:sp*Math.sin(rad)});
  }

  function createBossSpreadShot(){
    [75,90,105].forEach(a=>createEnemyBullet(boss,a));
  }

  function createItem(x,y){
    let type,r=Math.random();
    if(r<0.5)      type='superweapon';
    else if(r<0.75) type='heal';
    else if(r<0.9)  type='rifle';
    else            type='speed';
    const it=document.createElement('div');
    it.className=`item item-${type}`;
    it.style.left=x+'px'; it.style.top=y+'px';
    gameContainer.appendChild(it);
    items.push({element:it,x,y,type,speedX:0,speedY:1});
  }

  // --- 조이스틱 이동 ---
  function movePlayerByJoystick(){
    if(!joyActive) return;
    const rect = gameContainer.getBoundingClientRect();
    let cx = player.offsetLeft+player.offsetWidth/2 + joyVec.x*PLAYER_MOVE_SPEED;
    let cy = player.offsetTop +player.offsetHeight/2 + joyVec.y*PLAYER_MOVE_SPEED;
    cx = Math.max(player.offsetWidth/2, Math.min(cx, rect.width-player.offsetWidth/2));
    cy = Math.max(rect.height*0.25, Math.min(cy, rect.height-player.offsetHeight/2));
    player.style.left=(cx-player.offsetWidth/2)+'px';
    player.style.top =(cy-player.offsetHeight/2)+'px';
  }

  function moveBoss(){
    if(isGameOver) return;
    bossState.x+=bossState.moveSpeed*bossState.moveDirection;
    if(bossState.x>gameContainer.offsetWidth-boss.offsetWidth/2||bossState.x<boss.offsetWidth/2){
      bossState.moveDirection*=-1;
    }
    boss.style.left=(bossState.x-boss.offsetWidth/2)+'px';
  }

  function moveObjects(arr){
    arr.forEach(o=>{
      o.x+=o.speedX; o.y+=o.speedY;
      o.element.style.left=(o.x-o.element.offsetWidth/2)+'px';
      o.element.style.top =(o.y-o.element.offsetHeight/2)+'px';
    });
  }

  // --- 충돌 감지 & 처리 ---
  function isColliding(a,b) {
    const r1=a.getBoundingClientRect(), r2=b.getBoundingClientRect();
    return !(r1.right<r2.left||r1.left>r2.right||r1.bottom<r2.top||r1.top>r2.bottom);
  }
  function handleHit(el) {
    el.classList.add('hit');
    setTimeout(()=>el.classList.remove('hit'),100);
  }
  function handleCollisions() {
    // 플레이어탄 vs 보스/미니언
    for (let i=playerBullets.length-1;i>=0;i--){
      const bt=playerBullets[i], dmg=bt.attackPower||playerStats.attackPower;
      if(isColliding(bt.element,boss)){
        handleHit(boss);
        bossState.life-=dmg;
        if(!isBerserk&&bossState.life<=baseBossStats.life/2){
          isBerserk=true;
          clearInterval(bossAttackId);
          bossAttackId=setInterval(()=>!isGameOver&&createBossSpreadShot(),1000);
        }
        bt.element.remove(); playerBullets.splice(i,1);
        if(bossState.life<=0) endGame(true);
        continue;
      }
      for(let j=enemies.length-1;j>=0;j--){
        const en=enemies[j];
        if(isColliding(bt.element,en.element)){
          handleHit(en.element);
          en.life-=dmg;
          bt.element.remove(); playerBullets.splice(i,1);
          if(en.life<=0){
            minionsDefeated++;
            score+=100;
            if(Math.random()<0.5) createItem(en.x,en.y);
            en.element.remove(); enemies.splice(j,1);
          }
          break;
        }
      }
    }
    // 적탄 vs 플레이어
    for(let i=enemyBullets.length-1;i>=0;i--){
      const bt=enemyBullets[i];
      if(isColliding(bt.element,player)){
        playerStats.life-=baseBossStats.attackPower;
        wrapper.classList.add('shake');
        setTimeout(()=>wrapper.classList.remove('shake'),100);
        bt.element.remove(); enemyBullets.splice(i,1);
        if(playerStats.life<=0) endGame(false);
      }
    }
    // 미니언 vs 플레이어
    for(let i=enemies.length-1;i>=0;i--){
      const en=enemies[i];
      if(isColliding(en.element,player)){
        playerStats.life-=en.collisionDamage;
        wrapper.classList.add('shake');
        setTimeout(()=>wrapper.classList.remove('shake'),100);
        en.element.remove(); enemies.splice(i,1);
        if(playerStats.life<=0) endGame(false);
      }
    }
    // 아이템 vs 플레이어
    for(let i=items.length-1;i>=0;i--){
      const it=items[i];
      if(isColliding(it.element,player)){
        applyItemEffect(it.type);
        it.element.remove(); items.splice(i,1);
      }
    }
  }

  // --- 아이템 효과 ---
  function applyItemEffect(type) {
    if(type==='superweapon'){
      if(isSuperActive) return;
      isSuperActive=true;
      let t=10;
      dashSuperTimer.innerText=t;
      dashSuperWeapon.style.display='block';
      clearInterval(superTimerId);
      superTimerId=setInterval(()=>{
        dashSuperTimer.innerText=--t;
        if(t<=0){
          clearInterval(superTimerId);
          dashSuperWeapon.style.display='none';
          isSuperActive=false;
        }
      },1000);
    }
    else if(type==='heal'){
      playerStats.life=playerStats.maxLife;
    }
    else if(type==='rifle'&&playerStats.rifleLevel<5){
      playerStats.rifleLevel++;
      playerStats.attackPower+=3;
    }
    else if(type==='speed'&&playerStats.attackSpeed<playerStats.maxAttackSpeed){
      playerStats.attackSpeed=parseFloat((playerStats.attackSpeed+0.5).toFixed(1));
      patterns.forEach(id=>clearInterval(id));
      patterns=[];
      startPatterns();
    }
  }

  // --- 화면 밖 오브젝트 정리 ---
  function cleanupObjects(){
    [playerBullets,enemies,enemyBullets,items].forEach(arr=>{
      for(let i=arr.length-1;i>=0;i--){
        const o=arr[i];
        if(o.y<-50||o.y>gameContainer.offsetHeight+50||o.x<-50||o.x>gameContainer.offsetWidth+50){
          o.element.remove();
          arr.splice(i,1);
        }
      }
    });
  }

  // --- UI 업데이트 & 게임 종료 ---
  function updateUI(){
    const pl=Math.max(0,playerStats.life);
    const bl=Math.max(0,bossState.life);
    playerHpBar.style.width=(pl/playerStats.maxLife*100)+'%';
    bossHpBar.style.width  =(bl/baseBossStats.maxLife*100)+'%';
    playerHpValue.innerText=`${pl}/${playerStats.maxLife}`;
    bossHpValue.innerText  =`${bl}/${baseBossStats.maxLife}`;
    currentScoreVal.innerText=score;
    dashRifleLvl.innerText=playerStats.rifleLevel;
    dashSpeedLvl.innerText=playerStats.attackSpeed.toFixed(1);
  }

  function endGame(win){
    if(isGameOver) return;
    isGameOver=true;
    cancelAnimationFrame(gameLoopId);
    patterns.forEach(id=>clearInterval(id));
    clearInterval(bossAttackId);
    clearInterval(bossMoveId);
    clearInterval(superTimerId);
    const winS=$('ending-story-win'), loseS=$('ending-story-lose'), title=$('result-title');
    if(win){
      winS.style.display='block'; loseS.style.display='none'; title.innerText='MISSION CLEAR!';
    } else {
      winS.style.display='none'; loseS.style.display='block'; title.innerText='GAME OVER';
    }
    const lives=Math.max(0,playerStats.life);
    $('result-lives').innerText=`${lives} (x10점)`;
    $('result-minions').innerText=`${minionsDefeated} (x100점)`;
    finalScore=lives*10+minionsDefeated*100;
    $('final-score').innerText=finalScore;
    boss.style.display='none';
    setTimeout(()=>showScreen(endingScreen),1500);
  }

  // --- 조이스틱 이벤트 처리 ---
  joystick.addEventListener('pointerdown', e=>{
    joyActive=true;
  },{passive:false});
  joystick.addEventListener('pointermove', e=>{
    if(!joyActive) return;
    const dx=e.clientX-joyCenter.x, dy=e.clientY-joyCenter.y;
    const dist=Math.hypot(dx,dy), ratio=Math.min(dist,joyRadius)/joyRadius;
    joyVec.x=(dx/joyRadius)*ratio; joyVec.y=(dy/joyRadius)*ratio;
    const maxOff=joyRadius-stick.offsetWidth/2;
    const mx=Math.max(-maxOff,Math.min(dx,maxOff));
    const my=Math.max(-maxOff,Math.min(dy,maxOff));
    stick.style.transform=`translate(${mx}px,${my}px)`;
  },{passive:false});
  ['pointerup','pointerleave'].forEach(evt=>
    joystick.addEventListener(evt,()=>{
      joyActive=false; joyVec={x:0,y:0}; stick.style.transform='translate(0,0)';
    },{passive:false})
  );

  // --- 시작: 이미지 로드 후 타이틀 화면 ---
  preloadImages(imagesToLoad, initTitleScreen);
});
