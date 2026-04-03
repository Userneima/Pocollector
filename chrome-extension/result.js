// 分析结果页面脚本

let currentData = null;
let uploadedImages = [];

// 从 storage 恢复待显示结果（background 在打开本页前写入，防止 runtime 消息竞态丢失）
function tryLoadPendingResultFromStorage() {
  chrome.storage.local.get('__pocollector_pending_result', function(result) {
    const pending = result.__pocollector_pending_result;
    if (!pending) return;
    chrome.storage.local.remove('__pocollector_pending_result');
    currentData = pending;
    displayAnalysisResult(pending);
  });
}

// 分析结果仅通过 storage 注入，避免 runtime 广播导致多页面重复刷新
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'loadHistoryItem') {
    loadHistoryItem(message.item);
  }
});

// 显示历史记录
function showHistory() {
  // 从本地存储获取历史记录
  chrome.storage.local.get('history', function(result) {
    const history = result.history || [];
    const historyContent = document.getElementById('historyContent');
    
    if (history.length === 0) {
      historyContent.innerHTML = '<p>暂无历史记录</p>';
    } else {
      // 清空历史记录内容
      historyContent.innerHTML = '';
      
      // 为每个历史记录项创建元素并添加点击事件
      history.forEach(item => {
        const date = new Date(item.timestamp).toLocaleString();
        let type = '其他';
        if (item.type === 'draft') type = '暂存';
        else if (item.type === 'uploaded') type = '已上传';
        else if (item.type === 'collection') type = '采集';
        
        const title = item.title || item.data?.title || '未命名';
        const platform = item.platform || item.data?.platform || '未知平台';
        const link = item.imageUrl || item.data?.link || '无';
        
        const historyItem = document.createElement('div');
        historyItem.style.cssText = 'border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin-bottom: 10px; cursor: pointer;';
        historyItem.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">${date} · ${type} · ${platform}</div>
          <div style="font-size: 12px; color: #999;">链接: ${link}</div>
        `;
        
        // 添加点击事件
        historyItem.addEventListener('click', function() {
          // 关闭历史记录模态框
          document.getElementById('historyModal').style.display = 'none';
          // 加载历史记录项
          loadHistoryItem(item);
        });
        
        historyContent.appendChild(historyItem);
      });
    }
    
    // 显示模态框
    document.getElementById('historyModal').style.display = 'block';
  });
}

// 初始化
function init() {
  tryLoadPendingResultFromStorage();

  // 添加文件上传事件监听
  document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
  
  // 加载飞书表格链接
  loadFeishuTableUrl();
  
  // 添加飞书表格链接输入事件监听
  document.getElementById('feishuTableUrl').addEventListener('change', saveFeishuTableUrl);
  
  // 添加上传到飞书按钮点击事件
  document.getElementById('uploadBtn').addEventListener('click', uploadToFeishu);
  
  // 添加历史记录按钮点击事件
  document.getElementById('historyBtn').addEventListener('click', showHistory);
  
  // 添加关闭历史记录按钮点击事件
  document.getElementById('closeHistoryBtn').addEventListener('click', function() {
    document.getElementById('historyModal').style.display = 'none';
  });
  
  // 检查URL参数，加载历史记录
  checkUrlParams();
}

// 检查URL参数
function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const historyId = urlParams.get('historyId');
  if (historyId) {
    console.log('从URL参数加载历史记录:', historyId);
    loadHistoryItemById(historyId);
  }
}

// 根据ID加载历史记录项
function loadHistoryItemById(historyId) {
  chrome.storage.local.get('history', function(result) {
    const history = result.history || [];
    const item = history.find(item => item.id.toString() === historyId);
    if (item) {
      console.log('找到历史记录项:', item);
      loadHistoryItem(item);
    } else {
      console.error('未找到历史记录项:', historyId);
    }
  });
}

// 处理图片上传
function handleImageUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith('image/')) continue;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const imageUrl = e.target.result;
      uploadedImages.push(imageUrl);
      displayUploadedImage(imageUrl);
    };
    reader.readAsDataURL(file);
  }
}

// 显示上传的图片
function displayUploadedImage(imageUrl) {
  const container = document.getElementById('uploadedImages');
  const imageElement = document.createElement('div');
  imageElement.className = 'uploaded-image';
  imageElement.innerHTML = `
    <img src="${imageUrl}" alt="上传的图片">
    <button class="remove-image" onclick="removeImage('${imageUrl}')">×</button>
  `;
  container.appendChild(imageElement);
}

// 删除图片
function removeImage(imageUrl) {
  uploadedImages = uploadedImages.filter(img => img !== imageUrl);
  const container = document.getElementById('uploadedImages');
  const imageElements = container.querySelectorAll('.uploaded-image');
  imageElements.forEach(element => {
    const img = element.querySelector('img');
    if (img && img.src === imageUrl) {
      element.remove();
    }
  });
}

// 显示分析结果
function displayAnalysisResult(data) {
  // 显示图片
  if (data.productImage) {
    document.getElementById('resultImage').src = data.productImage;
  }
  
  // 显示分析信息
  const analysis = data.analysisResult || {};
  document.getElementById('title').value = analysis.title || '未识别';
  document.getElementById('author').value = analysis.author || '未识别';
  document.getElementById('productType').value = analysis.productType || '未识别';
  document.getElementById('mainColor').value = analysis.mainColor || '未识别';
  document.getElementById('material').value = analysis.material || '未识别';
  document.getElementById('timeCost').value = analysis.timeCost || '未识别';
  document.getElementById('link').value = data.productImageUrl || '未识别';
  document.getElementById('platform').value = data.platform || '未知';
}

// 加载历史记录项
function loadHistoryItem(item) {
  // 构建当前数据对象
  currentData = {
    productImage: item.data?.productImage || item.imageUrl,
    productImageUrl: item.data?.productImageUrl || item.imageUrl,
    platform: item.platform || item.data?.platform || '未知',
    analysisResult: {
      title: item.title || item.data?.title || '未命名',
      author: item.data?.author || '未识别',
      productType: item.data?.productType || item.data?.category || '未识别',
      mainColor: item.data?.mainColor || '未识别',
      material: item.data?.material || '未识别',
      timeCost: item.data?.timeCost || '未识别'
    }
  };
  
  // 显示数据
  if (currentData.productImage) {
    document.getElementById('resultImage').src = currentData.productImage;
  }
  
  const analysis = currentData.analysisResult;
  document.getElementById('title').value = analysis.title || '未命名';
  document.getElementById('author').value = analysis.author || '未识别';
  document.getElementById('productType').value = analysis.productType || '未识别';
  document.getElementById('mainColor').value = analysis.mainColor || '未识别';
  document.getElementById('material').value = analysis.material || '未识别';
  document.getElementById('timeCost').value = analysis.timeCost || '未识别';
  document.getElementById('link').value = currentData.productImageUrl || '未识别';
  document.getElementById('platform').value = currentData.platform || '未知';
  
  // 加载上传的图片
  uploadedImages = item.data?.images || [];
  displayUploadedImages();
}

// 显示上传的图片
function displayUploadedImages() {
  const container = document.getElementById('uploadedImages');
  container.innerHTML = '';
  
  uploadedImages.forEach(imageUrl => {
    const imageElement = document.createElement('div');
    imageElement.className = 'uploaded-image';
    imageElement.innerHTML = `
      <img src="${imageUrl}" alt="上传的图片">
      <button class="remove-image" onclick="removeImage('${imageUrl}')">×</button>
    `;
    container.appendChild(imageElement);
  });
}

// 暂存到历史记录
function saveChanges() {
  if (!currentData) return;
  
  // 获取修改后的值
  const updatedAnalysis = {
    title: document.getElementById('title').value,
    author: document.getElementById('author').value,
    productType: document.getElementById('productType').value,
    mainColor: document.getElementById('mainColor').value,
    material: document.getElementById('material').value,
    timeCost: document.getElementById('timeCost').value,
    link: document.getElementById('link').value,
    platform: document.getElementById('platform').value
  };
  
  // 包含上传的图片
  const allImages = [currentData.productImage, ...uploadedImages].filter(Boolean);
  
  // 构建历史记录项（使用统一的数据结构）
  const historyItem = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'draft', // 标记为草稿（暂存）
    title: updatedAnalysis.title,
    platform: updatedAnalysis.platform,
    imageUrl: updatedAnalysis.link || currentData.productImageUrl,
    data: {
      ...updatedAnalysis,
      images: allImages,
      productImage: currentData.productImage,
      productImageUrl: currentData.productImageUrl
    }
  };
  
  // 从本地存储获取历史记录
  chrome.storage.local.get('history', function(result) {
    const history = result.history || [];
    // 添加新的历史记录
    history.unshift(historyItem);
    // 限制历史记录数量为100条
    if (history.length > 100) {
      history.pop();
    }
    // 保存回本地存储
    chrome.storage.local.set({ 'history': history }, function() {
      // 显示保存成功提示
      const successElement = document.createElement('div');
      successElement.style.cssText = 'background-color: #e8f5e8; color: #2e7d32; padding: 15px; border-radius: 4px; margin-top: 20px; text-align: center; font-weight: bold;';
      successElement.textContent = '✅ 已暂存到历史记录！';
      document.querySelector('.container').appendChild(successElement);
      
      // 3秒后移除提示
      setTimeout(() => {
        successElement.remove();
      }, 3000);
    });
  });
}

// 加载飞书表格链接
function loadFeishuTableUrl() {
  chrome.storage.local.get('feishuTableUrl', function(result) {
    if (result.feishuTableUrl) {
      document.getElementById('feishuTableUrl').value = result.feishuTableUrl;
    }
  });
}

// 保存飞书表格链接
function saveFeishuTableUrl() {
  const feishuTableUrl = document.getElementById('feishuTableUrl').value;
  chrome.storage.local.set({ 'feishuTableUrl': feishuTableUrl }, function() {
    console.log('飞书表格链接已保存');
  });
}

function showFeishuSuccessModal() {
  const successModal = document.createElement('div');
  successModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 2000; display: flex; justify-content: center; align-items: center;';
  successModal.innerHTML = `
    <div style="background-color: white; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.2); max-width: 400px;">
      <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
      <h2 style="margin: 0 0 15px 0; color: #2e7d32;">上传成功</h2>
      <p style="margin: 0 0 30px 0; color: #666;">设计灵感已成功上传到飞书表格！</p>
      <button id="feishuSuccessOk" style="padding: 10px 30px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer;">确定</button>
    </div>
  `;
  document.body.appendChild(successModal);
  document.getElementById('feishuSuccessOk').addEventListener('click', function() {
    successModal.remove();
    window.close();
  });
  setTimeout(function() {
    successModal.remove();
    window.close();
  }, 3000);
}

function showFeishuErrorModal(msg) {
  const errorModal = document.createElement('div');
  errorModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 2000; display: flex; justify-content: center; align-items: center;';
  errorModal.innerHTML = `
    <div style="background-color: white; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.2); max-width: 400px;">
      <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
      <h2 style="margin: 0 0 15px 0; color: #c62828;">上传失败</h2>
      <p style="margin: 0 0 30px 0; color: #666;">${msg || '未知错误'}</p>
      <button id="feishuErrorOk" style="padding: 10px 30px; background-color: #f44336; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer;">确定</button>
    </div>
  `;
  document.body.appendChild(errorModal);
  document.getElementById('feishuErrorOk').addEventListener('click', function() {
    errorModal.remove();
  });
}

// 上传到飞书（扩展后台直连飞书 OpenAPI，凭证在弹窗「API 设置」中）
function uploadToFeishu() {
  if (!currentData) return;

  const feishuTableUrl = document.getElementById('feishuTableUrl').value;
  if (!feishuTableUrl) {
    alert('请输入飞书表格链接');
    return;
  }

  const updatedAnalysis = {
    title: document.getElementById('title').value,
    author: document.getElementById('author').value,
    productType: document.getElementById('productType').value,
    mainColor: document.getElementById('mainColor').value,
    material: document.getElementById('material').value,
    timeCost: document.getElementById('timeCost').value,
    link: document.getElementById('link').value,
    platform: document.getElementById('platform').value
  };

  const allImages = [currentData.productImage, ...uploadedImages].filter(Boolean);
  const now = new Date().toISOString();
  const author = updatedAnalysis.author || '待补充';
  const title = updatedAnalysis.title || ('产品调研_' + Math.floor(Date.now() / 1000));
  const productType = updatedAnalysis.productType || '未分类';

  const uploadData = {
    bloggerName: author,
    productImageUrl: updatedAnalysis.link || currentData.productImageUrl,
    entryDate: now,
    productName: title,
    category: productType,
    productImage: currentData.productImage,
    productType: productType,
    platform: updatedAnalysis.platform || '未知',
    mainColor: updatedAnalysis.mainColor || '未识别',
    material: updatedAnalysis.material || '未识别',
    timeCost: updatedAnalysis.timeCost || '未识别',
    images: allImages
  };

  const uploadBtn = document.getElementById('uploadBtn');
  const originalText = uploadBtn.textContent;
  uploadBtn.disabled = true;
  uploadBtn.style.position = 'relative';
  uploadBtn.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></span>上传中...';
  if (!document.getElementById('pocollector-spin-style')) {
    const style = document.createElement('style');
    style.id = 'pocollector-spin-style';
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  function resetBtn() {
    uploadBtn.innerHTML = originalText;
    uploadBtn.disabled = false;
  }

  const timer = setTimeout(function() {
    resetBtn();
    showFeishuErrorModal('上传超时，请重试');
  }, 120000);

  chrome.runtime.sendMessage(
    {
      type: 'uploadToFeishu',
      data: uploadData,
      feishuTableUrl: feishuTableUrl,
    },
    function(response) {
      clearTimeout(timer);
      resetBtn();
      if (chrome.runtime.lastError) {
        showFeishuErrorModal(chrome.runtime.lastError.message);
        return;
      }
      if (response && response.success) {
        chrome.storage.local.get('history', function(res) {
          const history = res.history || [];
          history.unshift({
            id: Date.now(),
            timestamp: now,
            type: 'uploaded',
            title: uploadData.productName,
            platform: uploadData.platform,
            imageUrl: uploadData.productImageUrl,
          });
          if (history.length > 50) history.pop();
          chrome.storage.local.set({ history: history });
        });
        showFeishuSuccessModal();
      } else {
        showFeishuErrorModal((response && response.error) || '上传失败');
      }
    }
  );
}

// 保存按钮点击事件
document.getElementById('saveBtn').addEventListener('click', saveChanges);

// 关闭按钮点击事件
document.getElementById('closeBtn').addEventListener('click', function() {
  window.close();
});

// 初始化
init();