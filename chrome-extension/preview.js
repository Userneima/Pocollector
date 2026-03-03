// 预览页面脚本

let currentScreenshotUrl = '';

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'showScreenshot') {
    currentScreenshotUrl = message.screenshotUrl;
    document.getElementById('screenshot').src = currentScreenshotUrl;
  } else if (message.type === 'progress') {
    // 更新加载窗口文本
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
      loadingText.textContent = message.message;
    }
    
    // 如果采集完成或失败，关闭当前标签页
    if (message.status === 'success' || message.status === 'error') {
      setTimeout(() => {
        window.close();
      }, 1000);
    }
  }
});

// 显示加载窗口
function showLoading(text) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  if (loadingOverlay && loadingText) {
    loadingText.textContent = text || '正在分析图片...';
    loadingOverlay.style.display = 'flex';
  }
}

// 确认按钮点击事件
document.getElementById('confirmBtn').addEventListener('click', function() {
  // 显示加载窗口
  showLoading('正在分析图片...');
  
  // 向后台脚本发送确认消息
  chrome.runtime.sendMessage({ 
    type: 'confirmScreenshot',
    screenshotUrl: currentScreenshotUrl 
  });
  
  // 不再立即关闭标签页，等待分析完成
});

// 取消按钮点击事件
document.getElementById('cancelBtn').addEventListener('click', function() {
  // 向后台脚本发送取消消息
  chrome.runtime.sendMessage({ type: 'cancelScreenshot' });
  
  // 关闭当前标签页
  window.close();
});