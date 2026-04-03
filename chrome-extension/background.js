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

// 插件图标点击事件 (保持原有功能)
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  
  // 当点击图标时，也显示弹出页面
  chrome.action.openPopup();
});

// 监听来自弹出页面和预览页面的消息。
// 监听器本身不能是 async：async 会返回 Promise，Chrome 无法把它当成「同步 return true」来保持 sendResponse 通道，
// 异步稍久（如飞书上传）就会出现 “The message port closed before a response was received”。

async function handleCollectMessage(message, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.id) {
      sendResponse({ error: '无法获取当前页面' });
      return;
    }

    currentCollectionTask.tabId = tab.id;
    currentCollectionTask.pageUrl = tab.url;
    currentCollectionTask.callback = sendResponse;
    currentCollectionTask.fullScreenScreenshot = message.fullScreenScreenshot !== false;

    sendProgress('loading', '正在准备采集...', 10);
    sendProgress('loading', '正在分析页面结构，提取图片...', 30);

    if (isPageEligibleForContentScript(tab.url)) {
      try {
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
          sendProgress('loading', '图片提取成功，正在调用 AI 分析...', 60);
          const out = await sendToBackend(tab.url, result.imageUrl);
          if (out && out.success === false) {
            sendProgress('error', out.error || '采集失败', 0);
            sendResponse({ success: false, error: out.error || '采集失败' });
          } else {
            sendProgress('success', '采集成功！设计灵感已分析完成。', 100);
            sendResponse({ success: true, message: '采集成功' });
          }
        } else {
          sendProgress('loading', '无法提取图片，正在截取当前页面...', 40);
          await captureScreenshot(tab.id);
          sendResponse({ success: true, message: '正在处理截图' });
        }
      } catch (error) {
        console.warn('内容脚本未响应，降级使用截图:', error.message);
        try {
          sendProgress('loading', '内容脚本未加载，正在截取当前页面...', 40);
          await captureScreenshot(tab.id);
          sendResponse({ success: true, message: '正在处理截图' });
        } catch (screenshotError) {
          console.error('截图也失败:', screenshotError);
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
              timeCost: '未识别',
            },
          });
          sendProgress('error', '采集完成，部分功能可能受限', 100);
          sendResponse({ success: true, message: '采集完成' });
        }
      }
    } else {
      sendProgress('loading', '当前页面不支持内容脚本，正在截取当前页面...', 40);
      try {
        await captureScreenshot(tab.id);
        sendResponse({ success: true, message: '正在处理截图' });
      } catch (screenshotError) {
        console.error('截图失败:', screenshotError);
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
            timeCost: '未识别',
          },
        });
        sendProgress('error', '采集完成，部分功能可能受限', 100);
        sendResponse({ success: true, message: '采集完成' });
      }
    }
  } catch (error) {
    console.error('处理采集消息失败:', error);
    try {
      sendResponse({ success: false, error: error instanceof Error ? error.message : '采集失败' });
    } catch (_) {}
  }
}

async function handleConfirmScreenshot(message, sendResponse) {
  try {
    if (currentCollectionTask.pageUrl) {
      sendProgress('loading', '正在调用 AI 分析...', 60);
      const out = await sendToBackend(currentCollectionTask.pageUrl, message.screenshotUrl);
      if (out && out.success === false) {
        sendProgress('error', out.error || '采集失败', 0);
        sendResponse({ success: false, error: out.error || '采集失败' });
      } else {
        sendProgress('success', '采集成功！设计灵感已分析完成。', 100);
        sendResponse({ success: true, message: '采集成功' });
      }
    } else {
      sendResponse({ success: false, error: '无采集任务信息' });
    }
  } catch (error) {
    console.error('确认截图失败:', error);
    try {
      sendResponse({ success: false, error: error instanceof Error ? error.message : '处理失败' });
    } catch (_) {}
  }
}

async function handleSelectedImage(message, sendResponse) {
  try {
    if (message.selectedImage) {
      currentCollectionTask.imageData = message.selectedImage;
      await showScreenshotPreview(message.selectedImage);
      sendResponse({ success: true, message: '截图已选择' });
    } else {
      sendProgress('error', '采集已取消', 0);
      sendResponse({ success: true, message: '采集已取消' });
    }
  } catch (error) {
    console.error('处理选中图片失败:', error);
    try {
      sendResponse({ success: false, error: error instanceof Error ? error.message : '处理失败' });
    } catch (_) {}
  }
}

async function handleUploadToFeishu(message, sendResponse) {
  try {
    const st = await chrome.storage.local.get(['userFeishuAppId', 'userFeishuAppSecret']);
    const appId = (st.userFeishuAppId || '').trim();
    const appSecret = (st.userFeishuAppSecret || '').trim();
    if (!appId || !appSecret) {
      sendResponse({
        success: false,
        error: '请先在扩展弹窗「API 设置」中填写飞书 App ID 与 App Secret',
      });
      return;
    }
    await runFeishuUpload(message.data, message.feishuTableUrl, appId, appSecret);
    sendResponse({ success: true, message: '上传到飞书成功' });
  } catch (err) {
    try {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } catch (_) {}
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'collect') {
    void handleCollectMessage(message, sendResponse);
    return true;
  }
  if (message.type === 'confirmScreenshot') {
    void handleConfirmScreenshot(message, sendResponse);
    return true;
  }
  if (message.type === 'cancelScreenshot') {
    sendProgress('error', '采集已取消', 0);
    sendResponse({ success: true, message: '采集已取消' });
    return false;
  }
  if (message.type === 'selectedImage') {
    void handleSelectedImage(message, sendResponse);
    return true;
  }
  if (message.type === 'uploadToFeishu') {
    void handleUploadToFeishu(message, sendResponse);
    return true;
  }
  sendResponse({ success: false, error: '未知的消息类型' });
  return false;
});

// 发送进度更新（弹窗关闭时无接收端，必须用回调吞掉 lastError，否则会出现 Uncaught (in promise)）
function sendProgress(status, message, progress) {
  chrome.runtime.sendMessage(
    { type: 'progress', status, message, progress },
    function () {
      void chrome.runtime.lastError;
    }
  );
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
      // 全屏截图直接分析，不需要用户确认
      sendProgress('loading', '正在分析...', 60);
      const out = await sendToBackend(
        currentCollectionTask.pageUrl,
        screenshotUrl
      );
      if (out && out.success === false) {
        sendProgress('error', out.error || '采集失败', 0);
      } else {
        sendProgress('success', '采集成功！', 100);
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
      iconUrl: chrome.runtime.getURL('icon128.png')
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

// ——— 通义千问（扩展内直连，无需本地 Next）———
const DASHSCOPE_DEFAULT_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

async function fetchWithTimeoutMs(url, options, timeoutMs) {
  const c = new AbortController();
  const id = setTimeout(function () {
    c.abort();
  }, timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options, { signal: c.signal }));
  } finally {
    clearTimeout(id);
  }
}

async function analyzeWithDashScope(imageRef, apiKey) {
  const apiRoot = DASHSCOPE_DEFAULT_BASE.replace(/\/+$/, '');
  const url = apiRoot + '/chat/completions';
  const prompt =
    '请分析这张图片，识别以下信息并以极简 JSON 格式返回：\n' +
    '1. title: 产品标题或页面标题\n' +
    '2. author: 店铺名称或博主名称\n' +
    '3. productType: 产品种类（如家具、服饰、电子产品等）\n' +
    '4. mainColor: 产品主色调\n' +
    '5. material: 核心材质（CMF）\n' +
    '6. timeCost: 制作耗时（如"2小时"、"1天"等，如无法识别则返回"未识别"）\n\n' +
    '重要要求：\n' +
    '- 只返回 JSON 字段，不要生成任何解释文字\n' +
    '- 保持 JSON 格式简洁，不要添加额外内容\n' +
    '- 生成的 Token 越少越好，速度越快越好\n' +
    '- 确保返回的是有效的 JSON 格式';

  const body = {
    model: 'qwen-vl-plus',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageRef } },
        ],
      },
    ],
    temperature: 0.1,
  };

  const r = await fetchWithTimeoutMs(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify(body),
    },
    90000
  );

  if (!r.ok) {
    const t = await r.text();
    throw new Error('通义请求失败 ' + r.status + ': ' + t.slice(0, 280));
  }
  const d = await r.json();
  const content = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!content) throw new Error('通义返回格式异常');
  const jm = content.match(/\{[\s\S]*\}/);
  if (!jm) throw new Error('通义未返回有效 JSON');
  return JSON.parse(jm[0]);
}

// ——— 飞书多维表格（扩展内直连）———
const FEISHU_AUTH_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/';
const FEISHU_UPLOAD_URL = 'https://open.feishu.cn/open-apis/drive/v1/medias/upload_all';
const FN_BLOGGER = '店名';
const FN_LINK = '链接';
const FN_DATE = '入档日期';
const FN_NAME = '产品名';
const FN_CAT = '种类';
const FN_IMG = '产品图';
const FN_PLAT = '平台来源';
const FN_COLOR = '主色调';
const FN_MAT = '核心材质';
const FN_TIME = '制作耗时';

let feishuCachedToken = null;
let feishuCachedExp = 0;
const FEISHU_SKEW_MS = 30 * 1000;

function parseFeishuTableLink(tableUrl) {
  const tableMatch = tableUrl.match(/tbl[a-zA-Z0-9]+/);
  if (!tableMatch) {
    throw new Error('飞书链接中需包含表 ID（tbl 开头）');
  }
  const baseMatch = tableUrl.match(/\/base\/([A-Za-z0-9]+)/);
  if (!baseMatch) {
    throw new Error('飞书链接中需包含 /base/ 后的应用 token');
  }
  return { appToken: baseMatch[1], tableId: tableMatch[0] };
}

async function feishuGetTenantToken(appId, appSecret) {
  const now = Date.now();
  if (feishuCachedToken && feishuCachedExp > now + FEISHU_SKEW_MS) {
    return feishuCachedToken;
  }
  const r = await fetchWithTimeoutMs(
    FEISHU_AUTH_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
    20000
  );
  if (!r.ok) throw new Error('飞书鉴权 HTTP ' + r.status);
  const j = await r.json();
  if (j.code !== 0 || !j.tenant_access_token) {
    throw new Error(j.msg || '飞书鉴权失败');
  }
  feishuCachedToken = j.tenant_access_token;
  feishuCachedExp = now + (j.expire ? j.expire * 1000 : 2 * 60 * 60 * 1000);
  return feishuCachedToken;
}

async function feishuUploadOneImage(imageUrl, accessToken, appToken) {
  var blob;
  var fileName;
  var contentType;
  if (imageUrl.indexOf('data:') === 0) {
    var m = imageUrl.match(/^data:(.+);base64,(.+)$/);
    if (!m) throw new Error('无效的 base64 图片');
    contentType = m[1];
    var bin = atob(m[2]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    blob = new Blob([arr], { type: contentType });
    fileName = 'up_' + Date.now() + '.' + (contentType.split('/')[1] || 'jpg');
  } else {
    var ir = await fetchWithTimeoutMs(imageUrl, { method: 'GET' }, 60000);
    if (!ir.ok) throw new Error('下载图片失败 ' + ir.status);
    contentType = ir.headers.get('content-type') || 'application/octet-stream';
    fileName = 'img_' + Date.now() + '.' + (contentType.split('/')[1] || 'jpg');
    blob = new Blob([await ir.arrayBuffer()], { type: contentType });
  }
  var fd = new FormData();
  fd.set('file_name', fileName);
  fd.set('parent_type', 'bitable_image');
  fd.set('parent_node', appToken);
  var buf = await blob.arrayBuffer();
  fd.set('size', String(buf.byteLength));
  fd.set('file', blob, fileName);
  var up = await fetchWithTimeoutMs(
    FEISHU_UPLOAD_URL,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken },
      body: fd,
    },
    120000
  );
  if (!up.ok) throw new Error('飞书上传图片失败 ' + up.status);
  var uj = await up.json();
  if (uj.code !== 0 || !uj.data || !uj.data.file_token) {
    throw new Error(uj.msg || '飞书上传失败');
  }
  return [{ name: fileName, type: 'image', file_token: uj.data.file_token }];
}

async function feishuCreateRecord(accessToken, appToken, tableId, fields) {
  var recordUrl =
    'https://open.feishu.cn/open-apis/bitable/v1/apps/' +
    appToken +
    '/tables/' +
    tableId +
    '/records';
  var r = await fetchWithTimeoutMs(
    recordUrl,
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ fields: fields }),
    },
    30000
  );
  if (!r.ok) throw new Error('飞书写入失败 ' + r.status);
  var j = await r.json();
  if (j.code !== 0) {
    throw new Error(j.msg || '飞书表格错误 ' + j.code);
  }
  return j;
}

async function runFeishuUpload(uploadData, feishuTableUrl, appId, appSecret) {
  var parsed = parseFeishuTableLink(feishuTableUrl);
  var token = await feishuGetTenantToken(appId, appSecret);
  var imgs = uploadData.images && uploadData.images.length ? uploadData.images : [uploadData.productImage];
  var attachments = [];
  for (var k = 0; k < imgs.length; k++) {
    if (!imgs[k]) continue;
    try {
      var att = await feishuUploadOneImage(imgs[k], token, parsed.appToken);
      attachments = attachments.concat(att);
    } catch (e) {
      console.warn('飞书单图上传跳过:', e);
    }
  }
  var ts = new Date(uploadData.entryDate).getTime();
  var cat = ((uploadData.productType || uploadData.category || '') + '').trim();
  var fields = {};
  if (uploadData.bloggerName) fields[FN_BLOGGER] = uploadData.bloggerName;
  if (uploadData.productImageUrl) {
    fields[FN_LINK] = { text: uploadData.productImageUrl, link: uploadData.productImageUrl };
  }
  if (uploadData.entryDate) fields[FN_DATE] = ts;
  if (uploadData.productName) fields[FN_NAME] = uploadData.productName;
  if (cat) fields[FN_CAT] = cat;
  if (attachments.length) fields[FN_IMG] = attachments;
  if (uploadData.platform) fields[FN_PLAT] = uploadData.platform;
  if (uploadData.mainColor) fields[FN_COLOR] = uploadData.mainColor;
  if (uploadData.material) fields[FN_MAT] = uploadData.material;
  if (uploadData.timeCost) fields[FN_TIME] = uploadData.timeCost;
  await feishuCreateRecord(token, parsed.appToken, parsed.tableId, fields);
}

function detectPlatform(pageUrl) {
  if (!pageUrl) return '未知';
  if (pageUrl.includes('pinterest.com')) return 'Pinterest';
  if (pageUrl.includes('xiaohongshu.com')) return '小红书';
  if (pageUrl.includes('taobao.com') || pageUrl.includes('tmall.com')) return '淘宝/天猫';
  return '未知';
}

function fallbackAnalysisPayload(pageUrl, imageData, platform) {
  return {
    productImage: imageData,
    productImageUrl: pageUrl,
    platform: platform || detectPlatform(pageUrl),
    analysisResult: {
      title: '未识别',
      author: '未识别',
      productType: '未识别',
      mainColor: '未识别',
      material: '未识别',
      timeCost: '未识别'
    }
  };
}

// 采集：扩展内直连通义千问（无需本地 Next）
async function sendToBackend(pageUrl, imageData) {
  let resultUiShown = false;
  const showResultOnce = async (payload) => {
    if (resultUiShown) return;
    resultUiShown = true;
    await showAnalysisResult(payload);
  };

  const platform = detectPlatform(pageUrl);

  try {
    const stored = await chrome.storage.local.get(['userDashScopeApiKey']);
    const apiKey = (stored.userDashScopeApiKey || '').trim();

    if (!apiKey) {
      chrome.notifications.create({
        type: 'basic',
        title: '请先配置通义 API Key',
        message: '打开扩展弹窗 → API 设置 → 填写 DashScope API Key 并保存。',
        iconUrl: chrome.runtime.getURL('icon128.png'),
      });
      await showResultOnce(fallbackAnalysisPayload(pageUrl, imageData, platform));
      return { success: false, error: '未配置通义 API Key' };
    }

    sendProgress('loading', '正在调用通义千问分析图片...', 70);

    let analysisResult;
    try {
      analysisResult = await analyzeWithDashScope(imageData, apiKey);
    } catch (e) {
      console.error('通义分析失败:', e);
      analysisResult = {
        title: '未识别',
        author: '未识别',
        productType: '未识别',
        mainColor: '未识别',
        material: '未识别',
        timeCost: '未识别',
      };
      chrome.notifications.create({
        type: 'basic',
        title: 'AI 分析失败',
        message: (e instanceof Error ? e.message : String(e)).slice(0, 220),
        iconUrl: chrome.runtime.getURL('icon128.png'),
      });
    }

    sendProgress('loading', '正在整理结果...', 90);

    const now = new Date().toISOString();
    const author = analysisResult.author || '未识别';
    const title = analysisResult.title || '未识别';
    const productType = analysisResult.productType || '未识别';

    const uploadData = {
      bloggerName: author,
      productImageUrl: pageUrl,
      entryDate: now,
      productName: title,
      category: productType,
      productImage: imageData,
      productType: productType,
      platform: platform,
      images: [imageData],
      screenshotUrl: imageData,
      analysisResult: analysisResult,
    };

    await showResultOnce(uploadData);

    chrome.notifications.create({
      type: 'basic',
      title: '采集完成',
      message: '分析结果已打开，可编辑后上传飞书。',
      iconUrl: chrome.runtime.getURL('icon128.png'),
    });

    return { success: true, data: uploadData };
  } catch (error) {
    console.error('采集流程失败:', error);
    if (!resultUiShown) {
      await showResultOnce(fallbackAnalysisPayload(pageUrl, imageData, platform));
    }
    chrome.notifications.create({
      type: 'basic',
      title: '采集异常',
      message: (error instanceof Error ? error.message : '未知错误').slice(0, 200),
      iconUrl: chrome.runtime.getURL('icon128.png'),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

// 仅通过 storage + 单一结果标签页展示，避免 runtime 广播导致多标签页重复刷新
const PENDING_RESULT_KEY = '__pocollector_pending_result';

let showAnalysisResultChain = Promise.resolve();

async function showAnalysisResult(data) {
  showAnalysisResultChain = showAnalysisResultChain.then(() => showAnalysisResultInner(data));
  return showAnalysisResultChain;
}

async function showAnalysisResultInner(data) {
  const resultUrl = chrome.runtime.getURL('result.html');
  let createdTabId = null;
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (!t.id || !t.url) continue;
      const base = t.url.split(/[?#]/)[0];
      if (base === resultUrl) {
        try {
          await chrome.tabs.remove(t.id);
        } catch (e) {
          /* ignore */
        }
      }
    }

    try {
      await chrome.storage.local.set({ [PENDING_RESULT_KEY]: data });
    } catch (e) {
      console.warn('写入待显示结果到 storage 失败（可能体积过大）:', e);
    }

    const resultTab = await chrome.tabs.create({ url: resultUrl, active: true });
    createdTabId = resultTab.id;
  } catch (error) {
    console.error('显示分析结果时出错:', error);
    if (!createdTabId) {
      try {
        await chrome.tabs.create({ url: resultUrl, active: true });
      } catch (e) {
        console.error('无法打开结果页面:', e);
      }
    }
  }
}
