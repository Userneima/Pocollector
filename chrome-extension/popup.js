// 弹出页面脚本

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const collectBtn = document.getElementById('collectBtn');
    const currentPageElement = document.getElementById('currentPage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    // 获取当前页面信息
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            currentPageElement.textContent = tabs[0].title || '未知页面';
        }
    });

    // 加载历史记录
    loadHistory();

    // 监听来自后台脚本的消息
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.type === 'progress') {
            updateStatus(message.status, message.message, message.progress);
        }
    });

    // 点击开始采集按钮
    collectBtn.addEventListener('click', function() {
        // 获取全屏截图选项
        const fullScreenScreenshot = document.getElementById('fullScreenScreenshot').checked;
        
        // 显示加载窗口
        showLoading('正在准备采集...');
        updateStatus('loading', '正在准备采集...', 0);
        collectBtn.disabled = true;

        // 向后台脚本发送采集请求
        chrome.runtime.sendMessage({ 
            type: 'collect',
            fullScreenScreenshot: fullScreenScreenshot 
        }, function(response) {
            // 检查是否有lastError
            if (chrome.runtime.lastError) {
                console.log('消息传递提示（非功能异常）：', chrome.runtime.lastError.message);
                // 不做任何处理，因为后台脚本可能已经在处理采集任务
                // 采集结果会通过新的标签页显示
                return;
            }
            
            // 检查响应是否存在，避免访问undefined的error属性
            if (response) {
                if (response.error) {
                    hideLoading();
                    updateStatus('error', '采集失败: ' + response.error, 0);
                    collectBtn.disabled = false;
                }
            } else {
                // 响应不存在，可能是因为后台脚本没有响应或消息端口已关闭
                console.log('未收到后台脚本的响应，可能是消息端口已关闭');
                // 不做任何处理，因为后台脚本可能已经在处理采集任务
                // 采集结果会通过新的标签页显示
            }
        });
    });

    // 处理历史记录按钮点击
    document.getElementById('historyBtn').addEventListener('click', function() {
        const historySection = document.getElementById('historySection');
        if (historySection.style.display === 'none') {
            loadHistory();
            historySection.style.display = 'block';
        } else {
            historySection.style.display = 'none';
        }
    });

    // 更新状态和进度
    function updateStatus(type, message, progress) {
        // 更新状态文本
        statusElement.textContent = message;
        
        // 更新状态样式
        statusElement.className = 'status ' + type;
        
        // 更新进度条
        if (progress !== undefined) {
            progressBar.style.width = progress + '%';
        }
        
        // 更新加载窗口文本
        if (loadingOverlay.style.display === 'flex') {
            loadingText.textContent = message;
        }
        
        // 如果采集完成或失败，隐藏加载窗口并启用按钮
        if (type === 'success' || type === 'error') {
            hideLoading();
            collectBtn.disabled = false;
            
            // 如果采集成功，保存历史记录
            if (type === 'success') {
                saveHistory();
            }
        }
    }

    // 显示加载窗口
    function showLoading(text) {
        loadingText.textContent = text || '正在处理...';
        loadingOverlay.style.display = 'flex';
    }

    // 隐藏加载窗口
    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    // 加载历史记录
    function loadHistory() {
        chrome.storage.local.get('history', function(result) {
            const history = result.history || [];
            const historyList = document.getElementById('historyList');
            
            if (history.length === 0) {
                historyList.innerHTML = '<p style="margin: 0; color: #999;">暂无历史记录</p>';
                return;
            }
            
            // 清空历史记录列表
            historyList.innerHTML = '';
            
            // 显示最近的10条历史记录
            const recentHistory = history.slice(-10).reverse();
            recentHistory.forEach(function(item) {
                const historyItem = document.createElement('div');
                historyItem.style.cssText = 'padding: 8px; border-bottom: 1px solid #f0f0f0; cursor: pointer;';
                historyItem.addEventListener('click', function() {
                    // 使用URL参数传递历史记录ID
                    const url = chrome.runtime.getURL(`result.html?historyId=${item.id}`);
                    chrome.tabs.create({ url: url });
                });
                
                const title = document.createElement('div');
                title.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
                title.textContent = item.title || item.data?.title || '未知标题';
                
                const details = document.createElement('div');
                details.style.cssText = 'font-size: 11px; color: #666;';
                const platform = item.platform || item.data?.platform || '未知平台';
                const timestamp = item.timestamp ? new Date(item.timestamp).toLocaleString('zh-CN') : '未知时间';
                details.textContent = `${platform} - ${timestamp}`;
                
                historyItem.appendChild(title);
                historyItem.appendChild(details);
                historyList.appendChild(historyItem);
            });
        });
    }

    // 保存历史记录
    function saveHistory() {
        // 获取当前页面信息
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
                const tab = tabs[0];
                
                // 从URL中提取平台信息
                let platform = '未知平台';
                if (tab.url.includes('pinterest.com')) {
                    platform = 'Pinterest';
                } else if (tab.url.includes('xiaohongshu.com')) {
                    platform = '小红书';
                } else if (tab.url.includes('taobao.com') || tab.url.includes('tmall.com')) {
                    platform = '淘宝/天猫';
                }
                
                // 创建历史记录项（使用统一的数据结构）
                const historyItem = {
                    id: Date.now(),
                    timestamp: new Date().toISOString(),
                    type: 'collection', // 标记为采集记录
                    title: tab.title || '未知标题',
                    platform: platform,
                    imageUrl: tab.url,
                    data: {
                        title: tab.title || '未知标题',
                        platform: platform,
                        link: tab.url
                    }
                };
                
                // 读取现有历史记录
                chrome.storage.local.get('history', function(result) {
                    const history = result.history || [];
                    
                    // 添加新记录
                    history.unshift(historyItem);
                    
                    // 只保留最近50条记录，减少存储使用
                    if (history.length > 50) {
                        history.pop();
                    }
                    
                    // 保存历史记录
                    chrome.storage.local.set({ 'history': history }, function() {
                        if (chrome.runtime.lastError) {
                            console.error('保存历史记录失败:', chrome.runtime.lastError);
                        } else {
                            // 重新加载历史记录
                            const historySection = document.getElementById('historySection');
                            if (historySection.style.display === 'block') {
                                loadHistory();
                            }
                        }
                    });
                });
            }
        });
    }
});

