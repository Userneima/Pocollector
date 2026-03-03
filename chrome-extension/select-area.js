// 区域选择脚本

let screenshotData = null;
let isSelecting = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'setScreenshot') {
    screenshotData = message.screenshot;
    document.getElementById('screenshotImage').src = screenshotData;
    
    // 等待图片加载完成后添加事件监听
    document.getElementById('screenshotImage').onload = function() {
      initEventListeners();
    };
  }
});

// 初始化事件监听
function initEventListeners() {
  const screenshotImage = document.getElementById('screenshotImage');
  const selection = document.getElementById('selection');
  const confirmBtn = document.getElementById('confirmBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  
  // 鼠标按下事件
  screenshotImage.addEventListener('mousedown', function(e) {
    isSelecting = true;
    const rect = screenshotImage.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    currentX = startX;
    currentY = startY;
    selection.style.display = 'block';
    updateSelection();
  });
  
  // 鼠标移动事件
  document.addEventListener('mousemove', function(e) {
    if (!isSelecting) return;
    const rect = screenshotImage.getBoundingClientRect();
    currentX = e.clientX - rect.left;
    currentY = e.clientY - rect.top;
    updateSelection();
  });
  
  // 鼠标释放事件
  document.addEventListener('mouseup', function() {
    isSelecting = false;
  });
  
  // 确认按钮点击事件
  confirmBtn.addEventListener('click', async function() {
    const selectedImage = await captureSelectedArea();
    if (selectedImage) {
      chrome.runtime.sendMessage({ type: 'selectedImage', selectedImage: selectedImage }, function() {
        window.close();
      });
    }
  });
  
  // 取消按钮点击事件
  cancelBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ type: 'selectedImage', selectedImage: null }, function() {
      window.close();
    });
  });
}

// 更新选择区域
function updateSelection() {
  const selection = document.getElementById('selection');
  const screenshotImage = document.getElementById('screenshotImage');
  
  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  
  const rect = screenshotImage.getBoundingClientRect();
  selection.style.left = (rect.left + x) + 'px';
  selection.style.top = (rect.top + y) + 'px';
  selection.style.width = width + 'px';
  selection.style.height = height + 'px';
}

// 捕获选择的区域
function captureSelectedArea() {
  const selection = document.getElementById('selection');
  const screenshotImage = document.getElementById('screenshotImage');
  
  const rect = screenshotImage.getBoundingClientRect();
  const x = parseInt(selection.style.left) - rect.left;
  const y = parseInt(selection.style.top) - rect.top;
  const width = parseInt(selection.style.width);
  const height = parseInt(selection.style.height);
  
  if (width <= 0 || height <= 0) {
    alert('请选择一个有效的区域');
    return null;
  }
  
  // 创建画布
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 绘制选择的区域
  const img = new Image();
  img.src = screenshotData;
  
  return new Promise((resolve) => {
    img.onload = function() {
      // 计算图片的缩放比例
      const scaleX = img.width / screenshotImage.clientWidth;
      const scaleY = img.height / screenshotImage.clientHeight;
      
      // 绘制缩放后的区域
      ctx.drawImage(
        img,
        x * scaleX,
        y * scaleY,
        width * scaleX,
        height * scaleY,
        0,
        0,
        width,
        height
      );
      
      // 转换为base64
      const selectedImage = canvas.toDataURL('image/png');
      resolve(selectedImage);
    };
  });
}

// 初始化
initEventListeners();