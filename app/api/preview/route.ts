import { NextResponse } from 'next/server'

import { fetchXhsBrowserData } from '@/lib/xhs-browser'

export const runtime = 'edge'

function deriveCategoryFromTitle(title: string) {
  const bracketMatch = title.match(/[【\[]([^】\]]+)[】\]]/)
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim()
  }

  const separatorMatch = title.split(/[\-|｜|\||丨]/)[0]
  const normalized = separatorMatch.trim()
  return normalized || '未分类'
}

export async function POST(request: Request) {
  try {
    console.log('收到预览 API 请求...')
    const body = await request.json()
    console.log('请求体:', body)

    if (!body || typeof body !== 'object') {
      console.error('错误: 请求体格式不正确')
      return NextResponse.json(
        { success: false, error: '请求体格式不正确' },
        { status: 400 }
      )
    }

    const { xhsUrl } = body as { xhsUrl?: string }
    console.log('小红书链接:', xhsUrl)

    if (!xhsUrl || typeof xhsUrl !== 'string') {
      console.error('错误: 缺少小红书链接 xhsUrl')
      return NextResponse.json(
        { success: false, error: '缺少小红书链接 xhsUrl' },
        { status: 400 }
      )
    }
    
    console.log('开始获取小红书数据（预览模式）...')
    
    // 直接使用浏览器模拟方案
    const xhsResult = await fetchXhsBrowserData(xhsUrl)
    
    if (!xhsResult.ok) {
      console.error('错误: 获取小红书数据失败', xhsResult.error)
      return NextResponse.json(
        { success: false, error: xhsResult.error },
        { status: 400 }
      )
    }

    const { data } = xhsResult
    console.log('小红书数据:', JSON.stringify(data, null, 2))
    
    const author = data.author || '待补充'
    const title = data.title || `小红书调研_${Math.floor(Date.now() / 1000)}`
    const productType = deriveCategoryFromTitle(title)
    const coverUrl = data.cover_url || ''
    
    console.log('提取的图片信息:', {
      coverUrl,
      imagesCount: data.images?.length || 0,
      firstImage: data.images?.[0] || '无'
    })

    return NextResponse.json({
      success: true,
      message: '预览获取成功',
      data: { 
        author, 
        title, 
        productType, 
        coverUrl,
        images: data.images || []
      },
    })
  } catch (error) {
    console.error('捕获到错误:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 400,
      }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: '请通过 POST /api/preview 提交数据',
  })
}