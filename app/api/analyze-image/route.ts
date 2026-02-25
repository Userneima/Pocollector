import { NextResponse } from 'next/server'

export const runtime = 'edge'

// 模拟图片分析功能 - 基于图片内容识别产品类型
function analyzeImageContent(base64Image: string): Promise<{
  productType: string
  confidence: number
  description: string
}> {
  return new Promise((resolve) => {
    // 这里可以集成真实的AI图像识别API，如：
    // - Google Vision API
    // - Azure Computer Vision
    // - 百度AI开放平台
    // - 腾讯AI开放平台
    
    // 模拟分析结果
    setTimeout(() => {
      // 手工制品产品类型分类
      const keywords = [
        { patterns: ['首饰', '项链', '耳环', '戒指', '胸针', '手链', '手镯'], type: '首饰' },
        { patterns: ['挂饰', '挂件', '装饰品', '吊饰', '摆件'], type: '挂饰' },
        { patterns: ['香囊', '香包', '荷包', '香料包'], type: '香囊' },
        { patterns: ['手机包', '手机套', '手机壳', '手机袋'], type: '手机包' },
        { patterns: ['手工', '手作', 'DIY', '手工艺'], type: '手工制品' },
        { patterns: ['编织', '针织', '钩织', '毛线'], type: '编织品' },
        { patterns: ['陶瓷', '陶艺', '瓷器', '陶土'], type: '陶瓷制品' },
        { patterns: ['木雕', '木艺', '木制品', '雕刻'], type: '木制品' }
      ]
      
      // 随机选择一个产品类型（实际应用中应该基于真实分析）
      const randomType = keywords[Math.floor(Math.random() * keywords.length)]
      const confidence = Math.random() * 0.3 + 0.6 // 60-90%的置信度
      
      resolve({
        productType: randomType.type,
        confidence: Math.round(confidence * 100),
        description: `基于图像内容分析，识别为${randomType.type}类别`
      })
    }, 1000) // 模拟分析延迟
  })
}

// 基于标题分析产品类型
function analyzeTitleForProductType(title: string): { type: string; confidence: number } {
  // 手工制品产品类型分类
  const keywords = [
    { patterns: ['首饰', '项链', '耳环', '戒指', '胸针', '手链', '手镯'], type: '首饰' },
    { patterns: ['挂饰', '挂件', '装饰品', '吊饰', '摆件'], type: '挂饰' },
    { patterns: ['香囊', '香包', '荷包', '香料包'], type: '香囊' },
    { patterns: ['手机包', '手机套', '手机壳', '手机袋'], type: '手机包' },
    { patterns: ['手工', '手作', 'DIY', '手工艺'], type: '手工制品' },
    { patterns: ['编织', '针织', '钩织', '毛线'], type: '编织品' },
    { patterns: ['陶瓷', '陶艺', '瓷器', '陶土'], type: '陶瓷制品' },
    { patterns: ['木雕', '木艺', '木制品', '雕刻'], type: '木制品' }
  ]
  
  const lowerTitle = title.toLowerCase()
  let bestMatch: { type: string; confidence: number } | null = null
  let highestScore = 0
  
  for (const category of keywords) {
    let score = 0
    for (const pattern of category.patterns) {
      if (lowerTitle.includes(pattern.toLowerCase())) {
        score += 1
      }
    }
    
    if (score > highestScore) {
      highestScore = score
      bestMatch = {
        type: category.type,
        confidence: Math.min(95, score * 25) // 每个关键词贡献25%的置信度
      }
    }
  }
  
  return bestMatch || { type: '未分类', confidence: 0 }
}

// 使用DeepSeek API分析标题
async function analyzeTitleWithDeepSeek(title: string): Promise<{ type: string; confidence: number }> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.error('DeepSeek API Key 未配置')
      return { type: '未分类', confidence: 0 }
    }
    
    console.log('使用DeepSeek分析标题:', title)
    
    // 构造DeepSeek API请求
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个产品类型分析助手。请根据提供的标题，判断该产品属于以下哪种类型：\n1. 首饰\n2. 挂饰\n3. 香囊\n4. 手机包\n5. 手工制品\n6. 编织品\n7. 陶瓷制品\n8. 木制品\n9. 其他\n\n请严格按照以下格式输出：\n类型：[产品类型]\n置信度：[0-100的数字]\n\n例如：\n类型：首饰\n置信度：95'
          },
          {
            role: 'user',
            content: `标题：${title}`
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      })
    })
    
    if (!response.ok) {
      console.error('DeepSeek API请求失败:', response.status, await response.text())
      return { type: '未分类', confidence: 0 }
    }
    
    const data = await response.json()
    console.log('DeepSeek API响应:', data)
    
    // 解析响应
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      console.error('DeepSeek API响应格式错误')
      return { type: '未分类', confidence: 0 }
    }
    
    // 提取类型和置信度
    const typeMatch = content.match(/类型：([^\n]+)/)
    const confidenceMatch = content.match(/置信度：(\d+)/)
    
    if (!typeMatch || !confidenceMatch) {
      console.error('DeepSeek API响应解析失败:', content)
      return { type: '未分类', confidence: 0 }
    }
    
    const productType = typeMatch[1].trim()
    const confidence = parseInt(confidenceMatch[1], 10)
    
    console.log('DeepSeek分析结果:', { productType, confidence })
    
    return { type: productType, confidence }
  } catch (error) {
    console.error('DeepSeek API调用失败:', error)
    return { type: '未分类', confidence: 0 }
  }
}

// 综合判断产品类型
function determineProductType(imageResult: { productType: string; confidence: number }, deepSeekResult: { type: string; confidence: number }, currentProductType: string): string {
  // 如果当前已有有效类型，保持不变
  if (currentProductType && currentProductType !== '未分类') {
    return currentProductType
  }
  
  // 计算综合得分
  const imageScore = imageResult.confidence * 0.3 // 图片分析权重30%
  const deepSeekScore = deepSeekResult.confidence * 0.7 // DeepSeek分析权重70%
  
  console.log('图片分析得分:', imageScore)
  console.log('DeepSeek分析得分:', deepSeekScore)
  
  // 如果DeepSeek分析置信度高，优先使用DeepSeek分析结果
  if (deepSeekResult.confidence > 80) {
    return deepSeekResult.type
  }
  
  // 如果图片分析置信度高，优先使用图片分析结果
  if (imageResult.confidence > 80) {
    return imageResult.productType
  }
  
  // 综合两者结果
  if (imageScore > deepSeekScore && imageResult.confidence > 60) {
    return imageResult.productType
  } else if (deepSeekScore > imageScore && deepSeekResult.confidence > 60) {
    return deepSeekResult.type
  }
  
  // 如果两者都不可靠，返回未分类
  return '未分类'
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { image, currentProductType, title, useDeepSeek = true } = body
    
    if (!image) {
      return NextResponse.json(
        { success: false, error: '缺少图片数据' },
        { status: 400 }
      )
    }
    
    console.log('收到图片分析请求...')
    console.log('图片数据长度:', image.length)
    console.log('当前产品类型:', currentProductType)
    console.log('标题:', title)
    
    // 分析图片
    const imageAnalysisResult = await analyzeImageContent(image)
    
    let titleAnalysisResult
    
    // 根据useDeepSeek参数决定分析方式
    if (useDeepSeek) {
      // 使用DeepSeek分析标题
      const deepSeekResult = await analyzeTitleWithDeepSeek(title || '')
      console.log('图片分析结果:', imageAnalysisResult)
      console.log('DeepSeek分析结果:', deepSeekResult)
      titleAnalysisResult = deepSeekResult
    } else {
      // 使用普通标题分析
      const titleResult = analyzeTitleForProductType(title || '')
      console.log('图片分析结果:', imageAnalysisResult)
      console.log('普通标题分析结果:', titleResult)
      titleAnalysisResult = titleResult
    }
    
    // 综合判断产品类型
    const finalProductType = determineProductType(imageAnalysisResult, titleAnalysisResult, currentProductType)
    
    return NextResponse.json({
      success: true,
      data: {
        productType: finalProductType,
        imageConfidence: imageAnalysisResult.confidence,
        ...(useDeepSeek ? {
          deepSeekConfidence: titleAnalysisResult.confidence,
          description: `基于图像和DeepSeek标题分析，识别为${finalProductType}类别`
        } : {
          titleConfidence: titleAnalysisResult.confidence,
          description: `基于图像和普通标题分析，识别为${finalProductType}类别`
        }),
        originalType: currentProductType,
        updated: finalProductType !== currentProductType
      }
    })
    
  } catch (error) {
    console.error('图片分析错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '图片分析失败' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: '请通过 POST /api/analyze-image 提交图片数据'
  })
}