// 内容脚本

try {
  // 监听来自后台脚本的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractImage') {
      try {
        const imageUrl = extractMainImage();
        sendResponse({ imageUrl });
      } catch (e) {
        // 捕获内容脚本内部异常，返回错误响应
        sendResponse({ success: false, error: e.message });
      }
    } else if (message.action === 'ping') {
      // 响应 ping 校验
      sendResponse('pong');
    } else {
      // 未知消息类型，也返回响应
      sendResponse({ success: false, error: '未知的消息类型' });
    }
  });
} catch (error) {
  console.error('内容脚本加载失败:', error);
}

// 提取主图片 URL
function extractMainImage() {
  // 根据不同网站使用不同的提取策略
  const url = window.location.href;
  
  if (url.includes('pinterest.com')) {
    return extractPinterestImage();
  } else if (url.includes('xiaohongshu.com')) {
    return extractXiaohongshuImage();
  } else if (url.includes('taobao.com') || url.includes('tmall.com')) {
    return extractTaobaoImage();
  } else {
    return extractGenericImage();
  }
}

// 提取 Pinterest 图片
function extractPinterestImage() {
  // 尝试提取 og:image
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    return ogImage.getAttribute('content');
  }
  
  // 尝试提取大图
  const mainImage = document.querySelector('.imageContainer img');
  if (mainImage) {
    return mainImage.src;
  }
  
  // 尝试提取其他可能的图片
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (img.src && img.src.includes('originals') && img.width > 200) {
      return img.src;
    }
  }
  
  return null;
}

// 提取小红书图片
function extractXiaohongshuImage() {
  // 尝试提取 og:image
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    return ogImage.getAttribute('content');
  }
  
  // 尝试提取主图
  const mainImage = document.querySelector('.swiper-slide img');
  if (mainImage) {
    return mainImage.src;
  }
  
  // 尝试提取其他可能的图片
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (img.src && img.src.includes('ci.img.xiaohongshu.com') && img.width > 200) {
      return img.src;
    }
  }
  
  return null;
}

// 提取淘宝/天猫图片
function extractTaobaoImage() {
  // 尝试提取 og:image
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    return ogImage.getAttribute('content');
  }
  
  // 尝试提取主图
  const mainImage = document.querySelector('.J_ImgBooth img');
  if (mainImage) {
    return mainImage.src;
  }
  
  // 尝试提取其他可能的图片
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (img.src && (img.src.includes('img.alicdn.com') || img.src.includes('g.alicdn.com')) && img.width > 200) {
      return img.src;
    }
  }
  
  return null;
}

// 通用图片提取
function extractGenericImage() {
  // 尝试提取 og:image
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    return ogImage.getAttribute('content');
  }
  
  // 尝试提取最大的图片
  let largestImage = null;
  let maxArea = 0;
  
  const images = document.querySelectorAll('img');
  for (const img of images) {
    const area = (img.width || 0) * (img.height || 0);
    if (area > maxArea && img.src) {
      maxArea = area;
      largestImage = img.src;
    }
  }
  
  return largestImage;
}
