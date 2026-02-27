import { NextResponse } from 'next/server'
import { downloadImages } from '@/lib/image-download'
import { fetchXhsBrowserData } from '@/lib/xhs-browser'
import { validateImageUrls } from '@/lib/image-validator'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    console.log('收到图片下载请求...')
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
    
    console.log('开始获取小红书数据（下载模式）...')
    
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
    
    // 获取所有图片URL
    const imageUrls = data.images || []
    if (data.cover_url && !imageUrls.includes(data.cover_url)) {
      imageUrls.unshift(data.cover_url) // 封面图放在最前面
    }
    
    console.log('找到图片数量:', imageUrls.length)
    
    console.log('开始下载图片，数量:', imageUrls.length)
    
    let verifiedImages: { url: string; type: string; size: number; filename: string }[] = []
    let failedImages: { url: string; error: string }[] = []
    let verifiedUrls: string[] = []
    let failedUrls: { url: string; error: string }[] = []
    
    if (imageUrls.length > 0) {
      // 使用新的图片验证功能
      console.log('开始验证图片URL...')
      const validationResult = await validateImageUrls(imageUrls)
      verifiedUrls = validationResult.valid
      failedUrls = validationResult.invalid
      
      console.log('图片验证完成，有效:', verifiedUrls.length, '无效:', failedUrls.length)
      
      if (failedUrls.length > 0) {
        console.log('无效图片详情:', failedUrls)
      }
      
      // 转换验证结果格式
      verifiedImages = verifiedUrls.map((url, index) => ({
        url: url,
        type: 'image/jpeg', // 默认类型，实际使用时可以进一步验证
        size: 0, // 暂时设为0，后续可以获取
        filename: `image_${index + 1}.jpg`
      }))
      
      failedImages = failedUrls.map(({ url, error }) => ({ url, error }))
    }
    
    return NextResponse.json({
      success: true,
      message: `成功获取 ${verifiedImages.length} 张图片`,
      data: {
        title: data.title,
        author: data.author,
        productType: data.title?.split(/[【\[]([^】\]]+)[】\]]/)?.[1] || '未分类',
        coverUrl: data.cover_url,
        images: verifiedImages,
        failedCount: failedImages.length
      }
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
    message: '请通过 POST /api/download 提交数据',
  })
}