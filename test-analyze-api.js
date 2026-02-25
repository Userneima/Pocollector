const fetch = require('node-fetch');

async function testAnalyzeAPI() {
  try {
    const response = await fetch('http://localhost:3001/api/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        currentProductType: '未分类',
        title: '手工编织项链 - 原创设计'
      })
    });
    
    const data = await response.json();
    console.log('API响应:', data);
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testAnalyzeAPI();
