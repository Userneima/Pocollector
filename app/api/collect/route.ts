import { NextResponse } from 'next/server'
import { addToFeishuBitable, getTenantAccessToken } from '@/lib/feishu'

export const runtime = 'nodejs'

// API_KEY 配置
const API_KEY = process.env.EXTENSION_API_KEY || 'test_api_key';

// 验证 API_KEY
function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return apiKey === API_KEY;
}

// 添加 CORS 头
function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key, X-DashScope-Key'
  )
  return response
}

// 分析图片（dashscopeApiKey：插件请求头传入优先，否则用服务端环境变量）
async function analyzeImageWithQwenVL(
  imageUrl: string,
  dashscopeApiKey?: string | null
): Promise<any> {
  const key =
    (dashscopeApiKey && dashscopeApiKey.trim()) ||
    process.env.DASHSCOPE_API_KEY ||
    ''
  const dashscopeBaseUrl =
    process.env.DASHSCOPE_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1'

  if (!key) {
    throw new Error('缺少通义 API Key：请在插件设置中填写，或在服务端配置 DASHSCOPE_API_KEY')
  }

  const prompt = `请分析这张图片，识别以下信息并以极简 JSON 格式返回：
1. title: 产品标题或页面标题
2. author: 店铺名称或博主名称
3. productType: 产品种类（如家具、服饰、电子产品等）
4. mainColor: 产品主色调
5. material: 核心材质（CMF）
6. timeCost: 制作耗时（如"2小时"、"1天"等，如无法识别则返回"未识别"）

重要要求：
- 只返回 JSON 字段，不要生成任何解释文字
- 保持 JSON 格式简洁，不要添加额外内容
- 生成的 Token 越少越好，速度越快越好
- 确保返回的是有效的 JSON 格式`

  const requestBody = {
    model: 'qwen-vl-plus',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: imageUrl
          }
        ]
      }
    ],
    temperature: 0.1
  }

  const response = await fetch(`${dashscopeBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`通义千问分析失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
    throw new Error('通义千问响应格式错误')
  }

  const content = data.choices[0].message.content
  
  // 提取 JSON 部分
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('通义千问未返回有效的 JSON 格式')
  }

  try {
    const analysisResult = JSON.parse(jsonMatch[0])
    return analysisResult
  } catch (error) {
    throw new Error('解析通义千问返回的 JSON 失败')
  }
}

export async function POST(request: Request) {
  // 在 try-catch 之外定义变量
  let pageUrlValue: string | undefined;
  let imageDataValue: string | undefined;
  let platformValue: string | undefined;
  
  try {
    // 验证 API_KEY
    if (!validateApiKey(request)) {
      const response = NextResponse.json(
        { success: false, error: '无效的 API_KEY' },
        { status: 401 }
      )
      return addCorsHeaders(response)
    }

    const dashScopeKeyFromHeader = request.headers.get('X-DashScope-Key')

    // 解析请求体
    const body = await request.json()
    
    if (!body || typeof body !== 'object') {
      const response = NextResponse.json(
        { success: false, error: '请求体格式不正确' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    const { pageUrl, imageData, platform } = body as { pageUrl: string; imageData: string; platform?: string }
    
    if (!pageUrl || !imageData) {
      const response = NextResponse.json(
        { success: false, error: '缺少必要的参数' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }
    
    // 保存变量供 catch 块使用
    pageUrlValue = pageUrl;
    imageDataValue = imageData;
    platformValue = platform;

    console.log('收到插件发送的数据:', { pageUrl, imageData: 'base64 data...' })

    // 使用通义千问分析图片
    console.log('开始使用通义千问分析图片...')
    let analysisResult = {
      title: '未识别',
      author: '未识别',
      productType: '未识别',
      mainColor: '未识别',
      material: '未识别',
      timeCost: '未识别'
    };
    
    try {
      analysisResult = await analyzeImageWithQwenVL(
        imageData,
        dashScopeKeyFromHeader
      )
      console.log('分析结果:', JSON.stringify(analysisResult, null, 2))
    } catch (error) {
      console.error('AI分析失败，使用默认值:', error)
      // 即使AI分析失败，也使用默认值继续
    }
    
    // 构建上传数据
    const now = new Date().toISOString()
    const author = analysisResult.author || '未识别'
    const title = analysisResult.title || '未识别'
    const productType = analysisResult.productType || '未识别'
    const category = productType
    
    const uploadData = {
      bloggerName: author,
      productImageUrl: pageUrl,
      entryDate: now,
      productName: title,
      category,
      productImage: imageData,
      productType,
      platform: platform || '未知',
      images: [imageData],
      screenshotUrl: imageData,
      analysisResult: analysisResult
    }

    // 获取飞书令牌
    console.log('开始获取飞书令牌...')
    const token = await getTenantAccessToken()

    // 上传到飞书
    console.log('开始上传到飞书...')
    try {
      await addToFeishuBitable(uploadData, token)
      console.log('上传成功！')
      const response = NextResponse.json({
        success: true,
        message: '采集成功',
        data: uploadData,
      })
      return addCorsHeaders(response)
    } catch (error) {
      console.error('飞书上传失败:', error)
      // 即使飞书上传失败，也返回分析结果
      const response = NextResponse.json({
        success: false,
        message: '分析成功，但飞书上传失败',
        data: uploadData,
        error: error instanceof Error ? error.message : '飞书上传失败'
      })
      return addCorsHeaders(response)
    }
  } catch (error) {
    console.error('捕获到错误:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    // 即使出错，也返回一个包含默认分析结果的响应
    const defaultAnalysisResult = {
      title: '未识别',
      author: '未识别',
      productType: '未识别',
      mainColor: '未识别',
      material: '未识别',
      timeCost: '未识别'
    };

    const now = new Date().toISOString()
    const uploadData = {
      bloggerName: '未识别',
      productImageUrl: pageUrlValue,
      entryDate: now,
      productName: '未识别',
      category: '未识别',
      productImage: imageDataValue,
      productType: '未识别',
      platform: platformValue || '未知',
      images: [imageDataValue],
      screenshotUrl: imageDataValue,
      analysisResult: defaultAnalysisResult
    };

    const response = NextResponse.json(
      {
        success: false,
        error: message,
        data: uploadData
      },
      {
        status: 200,
      }
    )
    return addCorsHeaders(response)
  }
}

export async function GET() {
  const response = NextResponse.json({
    success: true,
    message: '请通过 POST /api/collect 提交数据（旧路径 /api/collect-v2 已重定向到此处）',
  })
  return addCorsHeaders(response)
}

// 处理 OPTIONS 请求（预检请求）
export async function OPTIONS() {
  const response = NextResponse.json({})
  return addCorsHeaders(response)
}
