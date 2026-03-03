// 后台脚本

// 存储当前采集任务的信息
let currentCollectionTask = {
  tabId: null,
  pageUrl: null,
  imageData: null,
  callback: null,
  fullScreenScreenshot: true
};

// 判断页面是否支持内容脚本注入
function isPageEligibleForContentScript(tabUrl) {
  // 排除 Chrome 内部页、空白页等不支持注入的页面
  const ineligiblePrefixes = ['chrome://', 'chrome-extension://', 'about:blank', 'file://'];
  
  // 检查 URL 是否存在且不是不支持的页面
  return tabUrl && !ineligiblePrefixes.some(prefix => tabUrl.startsWith(prefix));
}

// 飞书相关配置
const FEISHU_AUTH_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/';
let cachedToken = null;
let cachedTokenExpiresAt = 0;
const TOKEN_SKEW_MS = 30 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// 飞书字段映射
const FEISHU_FIELD_BLOGGER_NAME = '店名';
const FEISHU_FIELD_PRODUCT_IMAGE_URL = '链接';
const FEISHU_FIELD_ENTRY_DATE = '入档日期';
const FEISHU_FIELD_PRODUCT_NAME = '产品名';
const FEISHU_FIELD_CATEGORY = '种类';
const FEISHU_FIELD_PRODUCT_IMAGE = '产品图';
const FEISHU_FIELD_PLATFORM = '平台来源';
const FEISHU_FIELD_MAIN_COLOR = '主色调';
const FEISHU_FIELD_MATERIAL = '核心材质';
const FEISHU_FIELD_TIME_COST = '制作耗时';

// 读取飞书环境变量
function readFeishuEnv() {
  // 从环境变量或默认值获取
  const appId = 'cli_a9115ee6b538dbcc'; // 从.env.local复制
  const appSecret = 'wimEMBxUaqaqbjBergRcfhaWb2KFQPwn'; // 从.env.local复制

  if (!appId || !appSecret) {
    throw new Error('缺少飞书环境变量');
  }

  return { appId, appSecret };
}

// 获取飞书租户令牌
async function getTenantAccessToken() {
  const now = Date.now();

  if (cachedToken && cachedTokenExpiresAt > now + TOKEN_SKEW_MS) {
    console.log('使用缓存的飞书令牌');
    return cachedToken;
  }

  console.log('开始获取飞书令牌');
  const { appId, appSecret } = readFeishuEnv();
  console.log('飞书App ID:', appId);
  console.log('飞书认证URL:', FEISHU_AUTH_URL);

  try {
    const response = await fetch(FEISHU_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });

    console.log('飞书鉴权响应状态:', response.status);
    console.log('飞书鉴权响应头:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('飞书鉴权请求失败:', errorText);
      throw new Error(`飞书鉴权请求失败：${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('飞书鉴权响应数据:', data);

    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(`飞书鉴权报错：${data.code} ${data.msg}`);
    }

    const expiresInMs = data.expire ? data.expire * 1000 : TWO_HOURS_MS;
    cachedToken = data.tenant_access_token;
    cachedTokenExpiresAt = now + expiresInMs;
    console.log('飞书令牌获取成功，有效期:', expiresInMs / 1000 / 60, '分钟');

    return cachedToken;
  } catch (error) {
    console.error('获取飞书令牌失败:', error);
    throw error;
  }
}

// 构建飞书表格记录URL
function buildBitableRecordUrl(appToken, tableId) {
  return `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
}

// 构建飞书表格字段URL
function buildBitableFieldUrl(appToken, tableId) {
  return `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;
}

// 构建飞书表格字段选项URL
function buildBitableFieldOptionUrl(appToken, tableId, fieldId) {
  return `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields/${fieldId}/options`;
}

// 获取表格字段信息
async function getBitableFields(appToken, tableId, token) {
  const response = await fetch(buildBitableFieldUrl(appToken, tableId), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

  if (!response.ok) {
    throw new Error(`获取表格字段失败：${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`获取表格字段报错：${data.code} ${data.msg}`);
  }

  return data.data.items;
}

// 为单选字段添加选项
async function addBitableFieldOption(appToken, tableId, fieldId, optionName, token) {
  const response = await fetch(buildBitableFieldOptionUrl(appToken, tableId, fieldId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      options: [{
        name: optionName
      }]
    }),
  });

  if (!response.ok) {
    throw new Error(`添加字段选项失败：${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`添加字段选项报错：${data.code} ${data.msg}`);
  }

  return data.data;
}

// 处理单选字段
async function handleSelectField(appToken, tableId, fieldName, fieldValue, token) {
  if (!fieldValue) {
    return fieldValue;
  }

  // 获取所有字段
  const fields = await getBitableFields(appToken, tableId, token);
  
  // 找到目标字段
  const targetField = fields.find(field => field.name === fieldName);
  if (!targetField) {
    return fieldValue;
  }

  // 检查是否是单选字段
  if (targetField.type !== 'single_select') {
    return fieldValue;
  }

  // 检查选项是否存在
  const existingOption = targetField.property.options.find(option => option.name === fieldValue);
  if (existingOption) {
    return fieldValue;
  }

  // 添加新选项
  await addBitableFieldOption(appToken, tableId, targetField.field_id, fieldValue, token);
  return fieldValue;
}

// 上传图片到飞书
async function uploadImageToFeishu(imageUrl, token, appToken) {
  if (!imageUrl) {
    return [];
  }

  let blob;
  let fileName;
  let contentType;

  // 处理 base64 图片
  if (imageUrl.startsWith('data:')) {
    // 从 base64 中提取内容类型和数据
    const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      throw new Error('无效的 base64 图片格式');
    }
    contentType = matches[1];
    const base64Data = matches[2];
    // 解码 base64
    const binaryString = atob(base64Data);
    const binaryData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      binaryData[i] = binaryString.charCodeAt(i);
    }
    blob = new Blob([binaryData], { type: contentType });
    fileName = `upload_${Date.now()}.${contentType.split('/')[1] || 'jpg'}`;
  } else {
    // 下载远程图片
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`图片下载失败：${imageResponse.status}`);
    }

    contentType = imageResponse.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await imageResponse.arrayBuffer();
    blob = new Blob([arrayBuffer], { type: contentType });
    fileName = `image_${Date.now()}.${contentType.split('/')[1] || 'jpg'}`;
  }

  const formData = new FormData();
  formData.set('file_name', fileName);
  formData.set('parent_type', 'bitable_image');
  formData.set('parent_node', appToken);
  const arrayBuffer = await blob.arrayBuffer();
  formData.set('size', String(arrayBuffer.byteLength));
  formData.set('file', blob, fileName);

  const uploadResponse = await fetch('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (uploadResponse.status === 403) {
    throw new Error('飞书权限不足（403），请检查应用是否已添加为多维表格协作者。');
  }

  if (!uploadResponse.ok) {
    throw new Error(`飞书上传失败：${uploadResponse.status}`);
  }

  const uploadData = await uploadResponse.json();

  if (uploadData.code !== 0 || !uploadData.data?.file_token) {
    throw new Error(`飞书上传报错：${uploadData.code} ${uploadData.msg}`);
  }

  return [
    {
      name: fileName,
      type: 'image',
      file_token: uploadData.data.file_token,
    },
  ];
}

// 添加数据到飞书表格
async function addToFeishuBitable(input, token, appToken, tableId) {
  console.log('开始添加数据到飞书表格');
  console.log('App Token:', appToken);
  console.log('Table ID:', tableId);
  
  // 使用默认的appToken
  const finalAppToken = appToken || 'BGQabkuYvaxWehsUre4cXU00nNc'; // 从.env.local复制
  const finalTableId = tableId;
  console.log('最终App Token:', finalAppToken);
  console.log('最终Table ID:', finalTableId);
  
  let productImageAttachments = [];
  
  // 处理所有图片
  const allImages = input.images && input.images.length > 0 ? input.images : [input.productImage];
  console.log('处理图片数量:', allImages.length);
  
  try {
    for (const imageUrl of allImages) {
      if (imageUrl) {
        console.log('上传图片:', imageUrl.substring(0, 100) + (imageUrl.length > 100 ? '...' : ''));
        const attachments = await uploadImageToFeishu(
          imageUrl,
          token,
          finalAppToken
        );
        productImageAttachments = [...productImageAttachments, ...attachments];
        console.log('图片上传成功，附件数量:', attachments.length);
      }
    }
  } catch (error) {
    console.warn('图片上传失败，已跳过该字段：', error);
  }

  console.log('图片附件总数:', productImageAttachments.length);

  const date = new Date(input.entryDate);
  const dateTimestamp = date.getTime();
  console.log('入档日期:', input.entryDate, '时间戳:', dateTimestamp);

  const fields = {};

  const resolvedCategory = input.productType?.trim() || input.category;
  console.log('分类:', resolvedCategory);

  // 处理单选字段
  try {
    // 处理种类字段（可能是单选）
    if (resolvedCategory) {
      console.log('开始处理单选字段:', FEISHU_FIELD_CATEGORY);
      const processedCategory = await handleSelectField(finalAppToken, finalTableId, FEISHU_FIELD_CATEGORY, resolvedCategory, token);
      fields[FEISHU_FIELD_CATEGORY] = processedCategory;
      console.log('单选字段处理成功:', processedCategory);
    }
  } catch (error) {
    console.warn('处理单选字段失败，使用原始值：', error);
    if (resolvedCategory) {
      fields[FEISHU_FIELD_CATEGORY] = resolvedCategory;
    }
  }

  if (input.bloggerName) {
    fields[FEISHU_FIELD_BLOGGER_NAME] = input.bloggerName;
    console.log('添加字段:', FEISHU_FIELD_BLOGGER_NAME, '值:', input.bloggerName);
  }

  if (input.productImageUrl) {
    fields[FEISHU_FIELD_PRODUCT_IMAGE_URL] = {
      text: input.productImageUrl,
      link: input.productImageUrl,
    };
    console.log('添加字段:', FEISHU_FIELD_PRODUCT_IMAGE_URL, '值:', input.productImageUrl);
  }

  if (input.entryDate) {
    fields[FEISHU_FIELD_ENTRY_DATE] = dateTimestamp;
    console.log('添加字段:', FEISHU_FIELD_ENTRY_DATE, '值:', dateTimestamp);
  }

  if (input.productName) {
    fields[FEISHU_FIELD_PRODUCT_NAME] = input.productName;
    console.log('添加字段:', FEISHU_FIELD_PRODUCT_NAME, '值:', input.productName);
  }

  if (productImageAttachments.length > 0) {
    fields[FEISHU_FIELD_PRODUCT_IMAGE] = productImageAttachments;
    console.log('添加字段:', FEISHU_FIELD_PRODUCT_IMAGE, '附件数量:', productImageAttachments.length);
  }

  if (input.platform) {
    fields[FEISHU_FIELD_PLATFORM] = input.platform;
    console.log('添加字段:', FEISHU_FIELD_PLATFORM, '值:', input.platform);
  }

  if (input.mainColor) {
    fields[FEISHU_FIELD_MAIN_COLOR] = input.mainColor;
    console.log('添加字段:', FEISHU_FIELD_MAIN_COLOR, '值:', input.mainColor);
  }

  if (input.material) {
    fields[FEISHU_FIELD_MATERIAL] = input.material;
    console.log('添加字段:', FEISHU_FIELD_MATERIAL, '值:', input.material);
  }

  if (input.timeCost) {
    fields[FEISHU_FIELD_TIME_COST] = input.timeCost;
    console.log('添加字段:', FEISHU_FIELD_TIME_COST, '值:', input.timeCost);
  }

  console.log('构建请求数据:', JSON.stringify({ fields }));
  
  const recordUrl = buildBitableRecordUrl(finalAppToken, finalTableId);
  console.log('请求URL:', recordUrl);

  try {
    const response = await fetch(recordUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ fields }),
    });

    console.log('飞书表格响应状态:', response.status);
    console.log('飞书表格响应头:', response.headers);

    if (response.status === 403) {
      throw new Error('飞书权限不足（403），请检查应用是否已添加为多维表格协作者。');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('飞书多维表格请求失败:', errorText);
      throw new Error(`飞书多维表格请求失败：${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('飞书表格响应数据:', data);

    if (data.code !== 0) {
      if (data.code === 1254041) {
        throw new Error('未找到数据表，请检查 Table ID (应以 tbl 开头) 是否与飞书地址栏一致');
      }
      throw new Error(`飞书多维表格报错：${data.code} ${data.msg}`);
    }

    console.log('添加数据到飞书表格成功');
    return data;
  } catch (error) {
    console.error('添加数据到飞书表格失败:', error);
    throw error;
  }
}

// 插件图标点击事件 (保持原有功能)
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  
  // 当点击图标时，也显示弹出页面
  chrome.action.openPopup();
});

// 监听来自弹出页面和预览页面的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    if (message.type === 'collect') {
      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (!tab || !tab.id) {
        sendResponse({ error: '无法获取当前页面' });
        return;
      }
      
      // 存储任务信息
      currentCollectionTask.tabId = tab.id;
      currentCollectionTask.pageUrl = tab.url;
      currentCollectionTask.callback = sendResponse;
      currentCollectionTask.fullScreenScreenshot = message.fullScreenScreenshot !== false;
      
      // 发送初始进度
      sendProgress('loading', '正在准备采集...', 10);
      
      // 向内容脚本发送消息，尝试提取图片 URL
      sendProgress('loading', '正在分析页面结构，提取图片...', 30);
      
      // 先判断页面是否支持内容脚本注入
      if (isPageEligibleForContentScript(tab.url)) {
        try {
          // 检查内容脚本是否存在
          const result = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, { action: 'extractImage' }, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error('内容脚本未加载'));
              } else {
                resolve(response);
              }
            });
          });
          
          if (result && result.imageUrl) {
            // 成功提取到图片 URL，直接发送到后端
            sendProgress('loading', '图片提取成功，正在连接 AI 分析服务...', 60);
            await sendToBackend(tab.url, result.imageUrl);
            sendProgress('success', '采集成功！设计灵感已分析完成。', 100);
            // 发送成功响应
            sendResponse({ success: true, message: '采集成功' });
          } else {
            // 无法提取图片 URL，使用截图
            sendProgress('loading', '无法提取图片，正在截取当前页面...', 40);
            await captureScreenshot(tab.id);
            // 发送成功响应，因为截图后会有后续操作
            sendResponse({ success: true, message: '正在处理截图' });
          }
        } catch (error) {
          // 降级为警告，而非错误日志
          console.warn('内容脚本未响应，降级使用截图:', error.message);
          // 内容脚本未加载，使用截图
          try {
            sendProgress('loading', '内容脚本未加载，正在截取当前页面...', 40);
            await captureScreenshot(tab.id);
            // 发送成功响应，因为截图后会有后续操作
            sendResponse({ success: true, message: '正在处理截图' });
          } catch (screenshotError) {
            console.error('截图也失败:', screenshotError);
            // 即使截图失败，也显示结果页面
            await showAnalysisResult({
              productImage: '',
              productImageUrl: tab.url,
              platform: '未知',
              analysisResult: {
                title: '未识别',
                author: '未识别',
                productType: '未识别',
                mainColor: '未识别',
                material: '未识别',
                timeCost: '未识别'
              }
            });
            sendProgress('error', '采集完成，部分功能可能受限', 100);
            sendResponse({ success: true, message: '采集完成' });
          }
        }
      } else {
        // 不支持注入的页面，直接走截图逻辑，无报错
        sendProgress('loading', '当前页面不支持内容脚本，正在截取当前页面...', 40);
        try {
          await captureScreenshot(tab.id);
          // 发送成功响应，因为截图后会有后续操作
          sendResponse({ success: true, message: '正在处理截图' });
        } catch (screenshotError) {
          console.error('截图失败:', screenshotError);
          // 即使截图失败，也显示结果页面
          await showAnalysisResult({
            productImage: '',
            productImageUrl: tab.url,
            platform: '未知',
            analysisResult: {
              title: '未识别',
              author: '未识别',
              productType: '未识别',
              mainColor: '未识别',
              material: '未识别',
              timeCost: '未识别'
            }
          });
          sendProgress('error', '采集完成，部分功能可能受限', 100);
          sendResponse({ success: true, message: '采集完成' });
        }
      }
      
      // 保持连接开放
      return true;
    } else if (message.type === 'confirmScreenshot') {
      // 用户确认截图，发送到后端
      if (currentCollectionTask.pageUrl) {
        sendProgress('loading', '正在连接 AI 分析服务...', 60);
        try {
          await sendToBackend(currentCollectionTask.pageUrl, message.screenshotUrl);
          sendProgress('success', '采集成功！设计灵感已分析完成。', 100);
          sendResponse({ success: true, message: '采集成功' });
        } catch (error) {
          console.error('发送到后端失败:', error);
          sendProgress('error', '采集失败，请稍后重试', 0);
          sendResponse({ success: false, error: error instanceof Error ? error.message : '发送到后端失败' });
        }
      } else {
        sendResponse({ success: false, error: '无采集任务信息' });
      }
      // 保持连接开放，因为包含异步操作
      return true;
    } else if (message.type === 'cancelScreenshot') {
      // 用户取消截图
      sendProgress('error', '采集已取消', 0);
      sendResponse({ success: true, message: '采集已取消' });
    } else if (message.type === 'selectedImage') {
      // 收到用户选择的截图区域
      if (message.selectedImage) {
        // 存储截图URL
        currentCollectionTask.imageData = message.selectedImage;
        
        // 显示截图预览
        await showScreenshotPreview(message.selectedImage);
        sendResponse({ success: true, message: '截图已选择' });
      } else {
        // 用户取消了选择
        sendProgress('error', '采集已取消', 0);
        sendResponse({ success: true, message: '采集已取消' });
      }
      // 保持连接开放，因为包含异步操作
      return true;
    } else if (message.type === 'uploadToFeishu') {
      // 上传到飞书
      (async () => {
        try {
          // 直接调用上传函数，确保sendResponse被调用
          await uploadToFeishu(message.data, message.feishuTableUrl, sendResponse);
        } catch (error) {
          console.error('处理上传到飞书消息失败:', error);
          // 确保即使出现错误也调用sendResponse
          sendResponse({ success: false, error: error instanceof Error ? error.message : '上传失败' });
        }
      })();
      // 保持连接开放
      return true;
    } else {
      // 未知消息类型
      sendResponse({ success: false, error: '未知的消息类型' });
    }
  } catch (error) {
    console.error('处理消息失败:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : '处理消息失败' });
  }
});

// 上传到飞书
async function uploadToFeishu(data, feishuTableUrl, sendResponse) {
  try {
    // 解析飞书表格链接，提取tableId
    const tableIdMatch = feishuTableUrl.match(/tbl\w+/);
    if (!tableIdMatch) {
      sendResponse({ success: false, error: '无效的飞书表格链接' });
      return;
    }
    const tableId = tableIdMatch[0];
    
    // 构建上传数据
    const now = new Date().toISOString();
    const author = data.author || '待补充';
    const title = data.title || `产品调研_${Math.floor(Date.now() / 1000)}`;
    const productType = data.productType || '未分类';
    const category = productType;
    
    const uploadData = {
      bloggerName: author,
      productImageUrl: data.link || data.productImageUrl,
      entryDate: now,
      productName: title,
      category,
      productImage: data.productImage,
      productType,
      platform: data.platform || '未知',
      mainColor: data.mainColor || '未识别',
      material: data.material || '未识别',
      timeCost: data.timeCost || '未识别',
      images: data.images,
      screenshotUrl: data.productImage,
      analysisResult: {
        title: data.title,
        author: data.author,
        productType: data.productType,
        mainColor: data.mainColor,
        material: data.material,
        timeCost: data.timeCost
      }
    };
    
    // 获取飞书令牌
    const token = await getTenantAccessToken();
    
    // 上传到飞书
    await addToFeishuBitable(uploadData, token, undefined, tableId);
    
    // 添加上传到历史记录 - 使用同步方式，确保在发送响应前完成
    const history = await new Promise((resolve) => {
      chrome.storage.local.get('history', function(result) {
        resolve(result.history || []);
      });
    });
    
    // 添加新的历史记录
    history.unshift({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: 'uploaded', // 标记为已上传
      title: uploadData.productName,
      platform: uploadData.platform,
      imageUrl: uploadData.productImageUrl
    });
    
    // 限制历史记录数量为50条，减少存储使用
    if (history.length > 50) {
      history.pop();
    }
    
    // 保存回本地存储 - 使用同步方式
    await new Promise((resolve) => {
      chrome.storage.local.set({ 'history': history }, function() {
        if (chrome.runtime.lastError) {
          console.error('保存历史记录失败:', chrome.runtime.lastError);
        } else {
          console.log('已添加到历史记录');
        }
        resolve();
      });
    });
    
    // 确保上传完成后发送响应
    console.log('上传完成，发送成功响应');
    sendResponse({ success: true, message: '上传到飞书成功' });
  } catch (error) {
    console.error('上传到飞书失败:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : '上传失败' });
  }
}

// 发送进度更新
function sendProgress(status, message, progress) {
  // 发送消息时不使用回调，避免消息端口关闭错误
  try {
    chrome.runtime.sendMessage({ 
      type: 'progress', 
      status, 
      message, 
      progress 
    });
  } catch (error) {
    // 忽略消息发送错误，因为进度更新不是关键操作
    console.log('发送进度更新失败:', error);
  }
}

// 截图函数
async function captureScreenshot(tabId) {
  try {
    let screenshotUrl;
    
    if (currentCollectionTask.fullScreenScreenshot) {
      // 全屏截图
      screenshotUrl = await chrome.tabs.captureVisibleTab({
        format: 'png'
      });
    } else {
      // 区域选择截图
      screenshotUrl = await captureSelectedArea();
    }
    
    if (!screenshotUrl) {
      throw new Error('用户取消了截图');
    }
    
    // 存储截图URL
    currentCollectionTask.imageData = screenshotUrl;
    
    if (currentCollectionTask.fullScreenScreenshot) {
      // 全屏截图直接发送到后端，不需要用户确认
      sendProgress('loading', '正在发送到后端...', 60);
      try {
        await sendToBackend(currentCollectionTask.pageUrl, screenshotUrl);
        sendProgress('success', '采集成功！', 100);
      } catch (error) {
        console.error('发送到后端失败:', error);
        sendProgress('error', '采集失败，请稍后重试', 0);
      }
    } else {
      // 区域选择截图显示预览让用户确认
      await showScreenshotPreview(screenshotUrl);
    }
  } catch (error) {
    console.error('截图失败:', error);
    // 显示错误通知
    chrome.notifications.create({
      type: 'basic',
      title: '采集失败',
      message: '无法截取当前页面，请稍后重试。',
      iconUrl: chrome.runtime.getURL('icon2.png')
    });
    sendProgress('error', '采集失败，请稍后重试', 0);
  }
}

// 区域选择截图
async function captureSelectedArea() {
  return new Promise((resolve, reject) => {
    try {
      // 截取整个页面
      chrome.tabs.captureVisibleTab({ format: 'png' }, async (fullScreenshot) => {
        if (!fullScreenshot) {
          // 如果无法截取页面，使用默认的空白图片
          console.warn('无法截取页面，使用默认图片');
          resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
          return;
        }
        
        try {
          // 创建一个新的标签页来选择区域
          const tab = await chrome.tabs.create({
            url: chrome.runtime.getURL('select-area.html'),
            active: true
          });
          
          // 等待标签页加载完成
          chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              
              // 向选择区域页面发送截图数据
              chrome.tabs.sendMessage(tabId, {
                type: 'setScreenshot',
                screenshot: fullScreenshot
              }, function(response) {
                if (response && response.selectedImage) {
                  resolve(response.selectedImage);
                } else {
                  // 如果用户取消选择，使用全屏截图
                  console.warn('用户取消选择，使用全屏截图');
                  resolve(fullScreenshot);
                }
              });
            }
          });
        } catch (error) {
          console.error('创建选择区域标签页失败:', error);
          // 失败时使用全屏截图
          resolve(fullScreenshot);
        }
      });
    } catch (error) {
      console.error('区域选择截图失败:', error);
      // 失败时返回默认的空白图片
      resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    }
  });
}

// 显示截图预览
async function showScreenshotPreview(screenshotUrl) {
  // 创建一个新的标签页来显示截图
  const previewTab = await chrome.tabs.create({
    url: chrome.runtime.getURL('preview.html'),
    active: true
  });
  
  // 等待标签页加载完成
  await new Promise((resolve) => {
    const listener = (tabId, changeInfo) => {
      if (tabId === previewTab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  
  // 向预览页面发送截图数据
  await chrome.tabs.sendMessage(previewTab.id, {
    type: 'showScreenshot',
    screenshotUrl
  });
}

// 发送数据到后端
async function sendToBackend(pageUrl, imageData) {
  try {
    // 使用本地开发地址
    const backendUrl = 'http://localhost:3000/api/collect-v2';
    const apiKey = 'test_api_key'; // 测试用 API_KEY
    
    // 从URL中提取平台来源
    let platform = '未知';
    if (pageUrl.includes('pinterest.com')) {
      platform = 'Pinterest';
    } else if (pageUrl.includes('xiaohongshu.com')) {
      platform = '小红书';
    } else if (pageUrl.includes('taobao.com') || pageUrl.includes('tmall.com')) {
      platform = '淘宝/天猫';
    }
    
    sendProgress('loading', '正在连接 AI 分析服务...', 70);
    
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        pageUrl,
        imageData,
        platform
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    sendProgress('loading', '正在分析图片内容，提取设计元素...', 85);
    
    if (response.ok) {
      const data = await response.json();
      console.log('发送成功:', data);
      
      // 显示分析结果（无论成功还是失败，只要有分析结果就显示）
      if (data.data && data.data.analysisResult) {
        await showAnalysisResult(data.data);
      } else {
        // 如果没有分析结果，仍然显示结果页面
        await showAnalysisResult({
          productImage: imageData,
          productImageUrl: pageUrl,
          platform: platform,
          analysisResult: {
            title: '未识别',
            author: '未识别',
            productType: '未识别',
            mainColor: '未识别',
            material: '未识别',
            timeCost: '未识别'
          }
        });
      }
      
      // 显示通知
      if (data.success) {
        chrome.notifications.create({
          type: 'basic',
          title: '采集成功',
          message: '设计灵感已成功采集并分析。',
          iconUrl: chrome.runtime.getURL('icon2.png')
        });
      } else {
        chrome.notifications.create({
          type: 'basic',
          title: '分析成功',
          message: '分析成功，但飞书上传失败: ' + (data.error || '未知错误'),
          iconUrl: chrome.runtime.getURL('icon2.png')
        });
      }
      
      return data;
    } else {
      console.error('发送失败:', response.status);
      // 显示失败通知
      chrome.notifications.create({
        type: 'basic',
        title: '采集失败',
        message: '发送到后端失败，请稍后重试。',
        iconUrl: chrome.runtime.getURL('icon2.png')
      });
      
      // 即使后端失败，也显示结果页面
      await showAnalysisResult({
        productImage: imageData,
        productImageUrl: pageUrl,
        platform: platform,
        analysisResult: {
          title: '未识别',
          author: '未识别',
          productType: '未识别',
          mainColor: '未识别',
          material: '未识别',
          timeCost: '未识别'
        }
      });
      
      throw new Error('发送到后端失败');
    }
  } catch (error) {
    console.error('发送到后端失败:', error);
    
    // 即使出错，也显示结果页面
    await showAnalysisResult({
      productImage: imageData,
      productImageUrl: pageUrl,
      platform: '未知',
      analysisResult: {
        title: '未识别',
        author: '未识别',
        productType: '未识别',
        mainColor: '未识别',
        material: '未识别',
        timeCost: '未识别'
      }
    });
    
    // 显示错误通知
    chrome.notifications.create({
      type: 'basic',
      title: '采集完成',
      message: '采集已完成，部分功能可能受限。',
      iconUrl: chrome.runtime.getURL('icon2.png')
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      data: {
        productImage: imageData,
        productImageUrl: pageUrl,
        platform: '未知',
        analysisResult: {
          title: '未识别',
          author: '未识别',
          productType: '未识别',
          mainColor: '未识别',
          material: '未识别',
          timeCost: '未识别'
        }
      }
    };
  }
}

// 显示分析结果
async function showAnalysisResult(data) {
  try {
    // 创建一个新的标签页来显示分析结果
    const resultTab = await chrome.tabs.create({
      url: chrome.runtime.getURL('result.html'),
      active: true
    });
    
    // 等待标签页加载完成
    await new Promise((resolve) => {
      const listener = (tabId, changeInfo) => {
        if (tabId === resultTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    
    // 等待一小段时间确保内容脚本已准备好
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 向结果页面发送分析数据，添加重试机制
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await chrome.tabs.sendMessage(resultTab.id, {
          type: 'showAnalysisResult',
          data
        });
        console.log('消息发送成功');
        break;
      } catch (error) {
        console.error(`消息发送失败 (尝试 ${i + 1}/${maxRetries}):`, error);
        if (i === maxRetries - 1) {
          // 最后一次尝试失败，仍然打开结果页面
          console.error('消息发送最终失败，但结果页面已打开');
        } else {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (error) {
    console.error('显示分析结果时出错:', error);
    // 即使出错，也尝试打开结果页面
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('result.html'),
        active: true
      });
    } catch (e) {
      console.error('无法打开结果页面:', e);
    }
  }
}
