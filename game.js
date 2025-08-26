// 游戏配置
const GAME_CONFIG = {
    // 物体种类和对应的尺寸、分数
    items: [
        { id: 1, size: 30, score: 1, image: 'img/01.png' },
        { id: 2, size: 40, score: 3, image: 'img/02.png' },
        { id: 3, size: 50, score: 6, image: 'img/03.png' },
        { id: 4, size: 65, score: 10, image: 'img/04.png' },
        { id: 5, size: 80, score: 15, image: 'img/05.png' },
        { id: 6, size: 95, score: 21, image: 'img/06.png' },
        { id: 7, size: 110, score: 28, image: 'img/07.png' },
        { id: 8, size: 130, score: 36, image: 'img/08.png' },
        { id: 9, size: 150, score: 45, image: 'img/09.png' },
        { id: 10, size: 170, score: 55, image: 'img/10.png' }
    ],
    // 初始随机生成的物体类型（较小的）[1, 2, 3]
    initialItemTypes: [1, 2, 3],
    // 物理引擎设置
    physics: {
        gravity: 0.8,
        friction: 0.1,
        restitution: 0.5
    }
};

// 游戏状态
let state = {
    score: 0,
    currentItem: null,
    nextItem: null,
    isGameOver: false,
    canDrop: true,  // 是否可以投放物体
    dropCooldown: 500, // 投放冷却时间（毫秒）
    items: []
};

// Matter.js 模块
const { Engine, Render, World, Bodies, Body, Events, Runner, Composite } = Matter;

// 创建引擎
const engine = Engine.create();
engine.gravity.y = GAME_CONFIG.physics.gravity;

// 创建渲染器
const gameBoard = document.getElementById('game-board');
const render = Render.create({
    element: gameBoard,
    engine: engine,
    options: {
        width: gameBoard.offsetWidth,
        height: gameBoard.offsetHeight,
        wireframes: false,
        background: '#ecf0f1',
        // 设置图像渲染质量
        pixelRatio: window.devicePixelRatio,
        // 确保物理引擎中的渲染图像清晰
        showSleeping: false,
        showDebug: false,
        showBroadphase: false
    }
});

// 创建边界
const wallThickness = 20;
const wallOptions = {
    isStatic: true,
    render: {
        visible: false
    }
};

// 左墙
const leftWall = Bodies.rectangle(
    -wallThickness / 2, 
    gameBoard.offsetHeight / 2, 
    wallThickness, 
    gameBoard.offsetHeight,
    wallOptions
);

// 右墙
const rightWall = Bodies.rectangle(
    gameBoard.offsetWidth + wallThickness / 2, 
    gameBoard.offsetHeight / 2, 
    wallThickness, 
    gameBoard.offsetHeight,
    wallOptions
);

// 底墙
const bottomWall = Bodies.rectangle(
    gameBoard.offsetWidth / 2, 
    gameBoard.offsetHeight + wallThickness / 2, 
    gameBoard.offsetWidth, 
    wallThickness,
    wallOptions
);

// 顶部游戏结束线
const topLine = Bodies.rectangle(
    gameBoard.offsetWidth / 2, 
    100, //正常值为100，其他值用于测试
    gameBoard.offsetWidth, 
    2,
    { 
        isStatic: true, 
        isSensor: true,
        render: { 
            visible: true,
            fillStyle: 'rgba(255, 0, 0, 0.2)', // 半透明红色，更容易看到
            lineWidth: 0,
            transparent: true
        },
        label: 'topLine'
    }
);

// 添加边界到世界
World.add(engine.world, [leftWall, rightWall, bottomWall, topLine]);

// 启动引擎和渲染器
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// 添加新物体到游戏
function addNewItem(x, y, type) {
    const itemConfig = GAME_CONFIG.items[type - 1];
    const size = itemConfig.size;
    
    // 使用预加载的图像对象
    const scaleFactor = size / 250; 
      // 创建物理碰撞体
    const radius = size / 2;
    const item = Bodies.circle(x, y, radius, {
        restitution: GAME_CONFIG.physics.restitution,
        friction: GAME_CONFIG.physics.friction,
        circleRadius: radius, // 存储圆形物体的半径，用于碰撞检测
        render: {
            sprite: {
                texture: itemConfig.image,
                xScale: scaleFactor,
                yScale: scaleFactor
            },
            // 让渲染边界可见，用于调试（可选）
            // lineWidth: 1,
            // strokeStyle: '#999'
        },
        label: `item-${type}`,
        itemType: type,
        // 确保物理属性适合游戏
        density: 0.001 * type, // 随着类型增加密度增加
        frictionAir: 0.02 // 添加少量空气阻力
    });
    
    // 初始化倒计时相关状态
    item.topLineContactTime = null;
    item.checkInterval = null;
    item.isWarning = false;
    item.blinkInterval = null;
    item.warningElement = null;
    
    World.add(engine.world, item);
    state.items.push(item);
    
    return item;
}

// 生成随机物体类型 4 5 4 6
function getRandomItemType(maxType = 4) {
    // 根据得分增加生成更大物体的概率
    if (state.score > 100) {
        // 高分时可能生成略大的物体，但概率较低
        maxType = Math.min(5, GAME_CONFIG.items.length);
        // 80%的概率生成小物体，20%概率生成较大物体
        if (Math.random() < 0.8) {
            return Math.floor(Math.random() * 4) + 1; // 返回1-4的物体
        }
    } 
    
    // 更高分数时偶尔有机会生成更大的初始物体
    if (state.score > 200 && Math.random() < 0.05) {
        return Math.min(6, GAME_CONFIG.items.length);
    }
    
    // 限制生成的物体大小，不超过maxType
    return Math.floor(Math.random() * maxType) + 1;
}

// 更新当前和下一个物体预览
function updateItemPreviews() {
    // 更新当前物体预览
    const currentItemType = state.currentItem || getRandomItemType();
    state.currentItem = currentItemType;
    
    const currentItemHolder = document.getElementById('current-item-holder');
    currentItemHolder.innerHTML = '';
    
    const currentItem = document.createElement('div');
    currentItem.id = 'current-item';
    currentItemHolder.appendChild(currentItem);
    
    const currentItemImage = document.createElement('img');
    currentItemImage.src = GAME_CONFIG.items[currentItemType - 1].image;
    currentItem.appendChild(currentItemImage);
    
    // 更新下一个物体预览
    const nextItemType = state.nextItem || getRandomItemType();
    state.nextItem = nextItemType;
    
    const nextItemElement = document.getElementById('next-item');
    nextItemElement.innerHTML = '';
    
    const nextItemImage = document.createElement('img');
    nextItemImage.src = GAME_CONFIG.items[nextItemType - 1].image;
    nextItemElement.appendChild(nextItemImage);
}

// 更新分数
function updateScore(points) {
    state.score += points;
    document.getElementById('score').textContent = state.score;
}

// 游戏结束
function gameOver() {
    state.isGameOver = true;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('final-score').textContent = state.score;
    
    // 停止物理引擎
    Runner.stop(runner);
}

// 重新开始游戏
function restartGame() {
    // 清除所有物体的警告效果和倒计时
    state.items.forEach(item => {
        removeWarningEffect(item);
        // 清除倒计时相关状态
        item.topLineContactTime = null;
        if (item.checkInterval) {
            clearInterval(item.checkInterval);
            item.checkInterval = null;
        }
    });
    
    // 清除所有物体
    World.clear(engine.world, false);
    World.add(engine.world, [leftWall, rightWall, bottomWall, topLine]);
    
    // 生成初始物体类型
    const initialCurrentItem = getRandomItemType(3); // 限制初始项为前三种较小的物体
    const initialNextItem = getRandomItemType(3);
      // 重置状态
    state = {
        score: 0,
        currentItem: initialCurrentItem,
        nextItem: initialNextItem,
        isGameOver: false,
        canDrop: true,
        dropCooldown: 500, // 投放冷却时间（毫秒）
        items: []
    };
    
    // 更新UI
    document.getElementById('score').textContent = '0';
    document.getElementById('game-over').classList.add('hidden');
    
    // 更新当前和下一个物体预览
    updateItemPreviews();
    
    // 重新启动引擎
    Runner.start(runner, engine);
}

// 合并相同的物体
function mergeItems(itemA, itemB) {
    if (state.isGameOver) return;
    
    const typeA = itemA.itemType;
    const typeB = itemB.itemType;
    
    // 如果类型不同或已经是最大类型，则不合并
    if (typeA !== typeB || typeA >= GAME_CONFIG.items.length) return;
    
    // 计算新物体的位置（两个物体的中间）
    const positionX = (itemA.position.x + itemB.position.x) / 2;
    const positionY = (itemA.position.y + itemB.position.y) / 2;
    
    // 清除任何正在进行的倒计时警告和定时器
    removeWarningEffect(itemA);
    removeWarningEffect(itemB);
    
    // 清除倒计时相关状态
    if (itemA.checkInterval) {
        clearInterval(itemA.checkInterval);
        itemA.checkInterval = null;
    }
    if (itemB.checkInterval) {
        clearInterval(itemB.checkInterval);
        itemB.checkInterval = null;
    }

    // 从世界和状态中移除旧物体
    World.remove(engine.world, itemA);
    World.remove(engine.world, itemB);
    state.items = state.items.filter(item => item !== itemA && item !== itemB);

    // 添加新物体（升级一级）
    const newType = typeA + 1;
    const newItem = addNewItem(positionX, positionY, newType);
    
    // 确保新物体不继承任何倒计时状态
    newItem.topLineContactTime = null;
    newItem.warningElement = null;
    newItem.checkInterval = null;
    
    // 更新分数
    updateScore(GAME_CONFIG.items[newType - 1].score);
    
    // 播放合并动画
    if (newType === 10) {
        // 最高级物品合成特效
        playUltimateMergeEffect(positionX, positionY);
    } else {
        // 普通合并特效
        playMergeEffect(positionX, positionY, newType);
    }
}

// 创建警告效果
function createWarningEffect(item) {
    // 为物体添加闪烁效果
    item.isWarning = true;
    item.warningStartTime = Date.now();
    
    // 开始闪烁效果
    startBlinkingEffect(item);
}

// 开始闪烁效果
function startBlinkingEffect(item) {
    const blinkInterval = setInterval(() => {
        if (!item.isWarning || state.isGameOver || !item.position) {
            clearInterval(blinkInterval);
            return;
        }
        
        // 切换透明度闪烁状态
        if (item.render) {
            if (item.isBlinking) {
                // 恢复正常透明度
                item.render.opacity = 1;
                item.render.fillStyle = undefined;
                item.isBlinking = false;
            } else {
                // 设置半透明状态
                item.render.opacity = 0.3;
                item.render.fillStyle = 'rgba(255, 255, 255, 0.3)';
                item.isBlinking = true;
            }
        }
    }, 200); // 固定200ms闪烁间隔
    
    item.blinkInterval = blinkInterval;
}

// 移除警告效果
function removeWarningEffect(item) {
    if (item.isWarning) {
        item.isWarning = false;
        
        // 清除闪烁间隔
        if (item.blinkInterval) {
            clearInterval(item.blinkInterval);
            item.blinkInterval = null;
        }
        
        // 清除检查间隔
        if (item.checkInterval) {
            clearInterval(item.checkInterval);
            item.checkInterval = null;
        }
        
        // 恢复原始状态
        if (item.render) {
            item.render.opacity = 1;
            item.render.fillStyle = undefined;
        }
        
        // 清理状态
        item.isBlinking = false;
        item.warningStartTime = null;
        item.topLineContactTime = null;
    }
}

// 更新警告效果位置
function updateWarningPosition(item) {
    // 固定150ms闪烁间隔，不需要渐进式变化
    // 闪烁效果直接作用于物体本身，不需要位置更新
}

// 处理顶线接触警告
function handleTopLineWarning(item) {
    // 检查物体是否确实在顶部线以上（即物体的顶部已经穿过了结束线）
    const itemTop = item.position.y - item.circleRadius;
    const topLinePosition = topLine.position.y;
    
    // 调试信息
    // console.log(`物体${item.itemType}接触顶线，itemTop: ${itemTop}, topLinePosition: ${topLinePosition}, 当前topLineContactTime: ${item.topLineContactTime}`);
    
    // 如果物体顶部已经到达或超过结束线位置，立即开始计时
    if (!item.topLineContactTime && itemTop <= topLinePosition) {
        item.topLineContactTime = Date.now();
        // console.log(`物体${item.itemType}开始计时，时间戳: ${item.topLineContactTime}`);
        createWarningEffect(item);
    }
    
    // 设置3秒的持续接触时间
    const requiredContactTime = 3000;
    
    // 每100ms检查一次是否仍在接触
    const checkInterval = setInterval(() => {
        // 如果游戏已结束或物体被销毁，停止检查并移除警告效果
        if (state.isGameOver || !item.position) {
            clearInterval(checkInterval);
            item.checkInterval = null;
            removeWarningEffect(item);
            return;
        }
        
        // 检查物体是否仍在接触顶部区域（考虑一定的误差范围）
        const itemTop = item.position.y - item.circleRadius;
        const stillInContact = itemTop <= topLine.position.y + 5; // 允许5像素的误差范围
        
        if (!stillInContact) {
            // 如果不再接触，重置接触时间并移除警告效果
            // console.log(`物体${item.itemType}离开顶线，重置topLineContactTime`);
            item.topLineContactTime = null;
            removeWarningEffect(item);
            clearInterval(checkInterval);
            item.checkInterval = null;
        } else {
            // 更新警告效果的位置
            updateWarningPosition(item);
            
            // 只有在物体持续接触且有有效的开始时间时才检查时间
            if (item.topLineContactTime) {
                const contactDuration = Date.now() - item.topLineContactTime;
                // console.log(`物体${item.itemType}持续接触，时间: ${contactDuration}ms`);
                if (contactDuration >= requiredContactTime && !state.isGameOver) {
                    // 最后再次确认物体仍在接触
                    const itemTop = item.position.y - item.circleRadius;
                    const finalCheck = itemTop <= topLine.position.y + 10; // 最终检查时允许更大的误差
                    if (finalCheck) {
                        removeWarningEffect(item);
                        clearInterval(checkInterval);
                        item.checkInterval = null;
                        gameOver();
                    } else {
                        // 如果最后检查发现已经离开，重置计时
                        item.topLineContactTime = null;
                        removeWarningEffect(item);
                    }
                    clearInterval(checkInterval);
                    item.checkInterval = null;
                }
            }
        }
    }, 100);
    
    // 将定时器存储在物体对象上，以便在重新开始游戏时清理
    item.checkInterval = checkInterval;
}

// 处理碰撞事件
Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;
    
    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;
        
        // 检查是否碰到底部墙壁
        if ((bodyA === bottomWall && bodyB.label.startsWith('item-')) ||
            (bodyB === bottomWall && bodyA.label.startsWith('item-'))) {
            const item = bodyA === bottomWall ? bodyB : bodyA;
            item.hasHitBottom = true;
        }
        
        // 检测相同类型的物体碰撞
        if (bodyA.label.startsWith('item-') && bodyB.label.startsWith('item-') && 
            bodyA.itemType === bodyB.itemType) {
            mergeItems(bodyA, bodyB);
            break;
        }
        
        // 检测是否有物体到达顶部（游戏结束条件）
        if ((bodyA.label === 'topLine' && bodyB.label.startsWith('item-')) ||
            (bodyB.label === 'topLine' && bodyA.label.startsWith('item-'))) {
            const item = bodyA.label.startsWith('item-') ? bodyA : bodyB;
            handleTopLineWarning(item);
        }
    }
});

// 下落位置指示线
const dropIndicator = document.getElementById('drop-indicator');

// 处理鼠标移动，更新指示线位置
gameBoard.addEventListener('mousemove', (event) => {
    if (state.isGameOver) return;
    
    const rect = gameBoard.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    // 显示并更新指示线位置
    dropIndicator.style.left = x + 'px';
    dropIndicator.classList.remove('hidden');
    
    // 添加轻微的动画效果
    dropIndicator.style.transform = 'scaleY(1.05)';
    setTimeout(() => {
        if (!dropIndicator.classList.contains('hidden')) {
            dropIndicator.style.transform = 'scaleY(1)';
        }
    }, 100);
});

// 鼠标离开游戏区域时隐藏指示线
gameBoard.addEventListener('mouseleave', () => {
    dropIndicator.classList.add('hidden');
});

// 处理游戏板点击事件（掉落物体）
gameBoard.addEventListener('click', (event) => {
    if (state.isGameOver || !state.canDrop) return;
    
    const rect = gameBoard.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    // 在顶部中心掉落当前物体
    const itemType = state.currentItem || getRandomItemType();
    addNewItem(x, 0, itemType);
    
    // 当前物体变为下一个物体
    state.currentItem = state.nextItem;
    
    // 生成新的下一个物体
    state.nextItem = getRandomItemType();
    
    // 更新预览
    updateItemPreviews();
    
    // 设置投放冷却
    state.canDrop = false;
    updateDropCooldown();
    
    // 不再显示冷却动画，但保留投放间隔限制
});

// 处理重新开始按钮点击
document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('play-again-btn').addEventListener('click', restartGame);

// 窗口大小调整处理
window.addEventListener('resize', () => {
    // 调整渲染器大小
    render.options.width = gameBoard.offsetWidth;
    render.options.height = gameBoard.offsetHeight;
    Render.setPixelRatio(render, window.devicePixelRatio);
    
    // 重新定位边界
    Body.setPosition(leftWall, {
        x: -wallThickness / 2,
        y: gameBoard.offsetHeight / 2
    });
    
    Body.setPosition(rightWall, {
        x: gameBoard.offsetWidth + wallThickness / 2,
        y: gameBoard.offsetHeight / 2
    });
    
    Body.setPosition(bottomWall, {
        x: gameBoard.offsetWidth / 2,
        y: gameBoard.offsetHeight + wallThickness / 2
    });    
    Body.setPosition(topLine, {
        x: gameBoard.offsetWidth / 2,
        y: 100
    });
});

// 初始化游戏
function initGame() {
    // 直接调用重启游戏即可，它会处理所有初始化
    restartGame();
    
    // 添加提示动画，显示玩家可以点击屏幕
    setTimeout(() => {
        const gameBoard = document.getElementById('game-board');
        const hintElement = document.createElement('div');
        hintElement.className = 'click-hint';
        hintElement.innerHTML = '点击屏幕投放物体';
        gameBoard.appendChild(hintElement);
        
        // 3秒后移除提示
        setTimeout(() => {
            if (gameBoard.contains(hintElement)) {
                gameBoard.removeChild(hintElement);
            }
        }, 3000);
    }, 500);
}

// 预加载所有图像
function preloadImages() {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingProgress = loadingScreen.querySelector('.loading-progress');
    let loadedCount = 0;
    const totalImages = GAME_CONFIG.items.length;

    const images = GAME_CONFIG.items.map(item => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                loadedCount++;
                const progress = Math.round((loadedCount / totalImages) * 100);
                loadingProgress.textContent = `${progress}%`;
                resolve(img);
            };
            img.onerror = reject;
            img.src = item.image;
        });
    });
    
    return Promise.all(images);
}

// 页面加载完成后初始化游戏
window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    
    preloadImages().then(() => {
        // 添加淡出动画
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            initGame();
        }, 500);
    }).catch(error => {
        console.error('Error preloading images:', error);
        // 即使加载失败也要隐藏加载画面并启动游戏
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            initGame();
        }, 500);
    });
});

// 普通合并特效
function playMergeEffect(x, y, level) {
    // 闪光效果
    const flash = document.createElement('div');
    flash.className = 'merge-flash';
    flash.style.left = x + 'px';
    flash.style.top = y + 'px';
    
    // 根据级别调整闪光颜色
    const colorIntensity = Math.min(1, 0.5 + level * 0.05);
    flash.style.boxShadow = `0 0 20px rgba(255, ${255 - level * 20}, ${255 - level * 25}, ${colorIntensity})`;
    
    gameBoard.appendChild(flash);
    
    // 合并音效（如果需要）
    // playSound('merge');
    
    // 移除闪光效果
    setTimeout(() => {
        if (gameBoard.contains(flash)) {
            gameBoard.removeChild(flash);
        }
    }, 300);
}

// 最高级物品合成特效
function playUltimateMergeEffect(x, y) {
    // 震动效果
    if (window.navigator.vibrate) {
        window.navigator.vibrate(100);
    }
    
    // 1. 创建爆炸闪光效果
    const flash = document.createElement('div');
    flash.className = 'merge-flash';
    flash.style.left = x + 'px';
    flash.style.top = y + 'px';
    flash.style.boxShadow = '0 0 30px rgba(255, 215, 0, 1)';
    flash.style.background = 'radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(255, 215, 0, 0) 70%)';
    flash.style.animation = 'merge-flash 0.5s ease-out';
    gameBoard.appendChild(flash);
    
    // 2. 创建全屏闪光
    const ultimateFlash = document.createElement('div');
    ultimateFlash.className = 'ultimate-flash';
    gameBoard.appendChild(ultimateFlash);
    
    // 3. 创建粒子爆炸效果
    const particleContainer = document.createElement('div');
    particleContainer.className = 'ultimate-merge-effect';
    particleContainer.style.left = x + 'px';
    particleContainer.style.top = y + 'px';
    gameBoard.appendChild(particleContainer);
    
    // 创建多个粒子
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // 随机位置在中心点
        particle.style.left = '0px';
        particle.style.top = '0px';
        
        // 随机颜色（金色系列）
        const r = 255;
        const g = 215 + Math.random() * 40 - 20;
        const b = Math.random() * 50;
        particle.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
        
        // 随机大小
        const size = 3 + Math.random() * 8;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        // 随机方向
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 100;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        // 设置动画
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        
        // 随机延迟
        const delay = Math.random() * 0.3;
        particle.style.animation = `particle-move 1s ease-out ${delay}s forwards`;
        
        particleContainer.appendChild(particle);
    }
    
    // 增加音效（如果需要）
    // playUltimateSound();
    
    // 移除特效元素
    setTimeout(() => {
        if (gameBoard.contains(flash)) {
            gameBoard.removeChild(flash);
        }
        if (gameBoard.contains(ultimateFlash)) {
            gameBoard.removeChild(ultimateFlash);
        }
        if (gameBoard.contains(particleContainer)) {
            gameBoard.removeChild(particleContainer);
        }
    }, 1500);
    
    // 添加得分增长动画
    const scoreBoost = document.createElement('div');
    scoreBoost.textContent = '+100 特别奖励!';
    scoreBoost.style.position = 'absolute';
    scoreBoost.style.left = x + 'px';
    scoreBoost.style.top = (y - 40) + 'px';
    scoreBoost.style.color = 'gold';
    scoreBoost.style.fontWeight = 'bold';
    scoreBoost.style.fontSize = '18px';
    scoreBoost.style.textShadow = '0 0 5px rgba(255, 215, 0, 0.8)';
    scoreBoost.style.transform = 'translate(-50%, -50%)';
    scoreBoost.style.zIndex = '20';
    scoreBoost.style.animation = 'float-up 2s forwards';
    gameBoard.appendChild(scoreBoost);
    
    // 添加特殊奖励分数
    updateScore(100);
    
    // 添加浮动动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes float-up {
            0% { opacity: 0; transform: translate(-50%, 0); }
            20% { opacity: 1; transform: translate(-50%, -20px); }
            80% { opacity: 1; transform: translate(-50%, -50px); }
            100% { opacity: 0; transform: translate(-50%, -70px); }
        }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
        if (gameBoard.contains(scoreBoost)) {
            gameBoard.removeChild(scoreBoost);
        }
        document.head.removeChild(style);
    }, 2000);
}

// 更新投放冷却时间
function updateDropCooldown() {
    setTimeout(() => {
        state.canDrop = true;
    }, state.dropCooldown);
}
