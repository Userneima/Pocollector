// 图片下载工具模块

export type DownloadResult = {
  success: boolean
  url: string
  filename: string
  localPath?: string
  error?: string
}

// 下载单张图片
export async function downloadImage(imageUrl: string, filename: string): Promise<DownloadResult> {
  try {
    console.log('开始下载图片:', imageUrl)
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`)
    }

    // 获取图片数据
    const imageBuffer = await response.arrayBuffer()
    const imageBase64 = Buffer.from(imageBuffer).toString('base64')
    
    // 获取图片类型
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const extension = contentType.includes('png') ? 'png' : 
                     contentType.includes('webp') ? 'webp' : 'jpg'
    
    // 创建本地URL（用于显示）
    const localUrl = `data:${contentType};base64,${imageBase64}`
    
    console.log('图片下载成功:', filename, `大小: ${(imageBuffer.byteLength / 1024).toFixed(1)}KB`)
    
    return {
      success: true,
      url: imageUrl,
      filename: `${filename}.${extension}`,
      localPath: localUrl
    }
  } catch (error) {
    console.error('图片下载失败:', error)
    return {
      success: false,
      url: imageUrl,
      filename: filename,
      error: error instanceof Error ? error.message : '下载失败'
    }
  }
}

// 批量下载图片
export async function downloadImages(imageUrls: string[]): Promise<DownloadResult[]> {
  console.log('开始批量下载图片，数量:', imageUrls.length)
  
  const results: DownloadResult[] = []
  
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i]
    const filename = `image_${i + 1}`
    
    try {
      const result = await downloadImage(url, filename)
      results.push(result)
      
      // 添加延迟避免请求过快
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      results.push({
        success: false,
        url: url,
        filename: filename,
        error: error instanceof Error ? error.message : '下载失败'
      })
    }
  }
  
  console.log('批量下载完成，成功:', results.filter(r => r.success).length, '/', results.length)
  return results
}

// 获取图片信息（不下载）
export async function getImageInfo(imageUrl: string): Promise<{
  url: string
  size?: number
  type?: string
  width?: number
  height?: number
  error?: string
}> {
  try {
    const response = await fetch(imageUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`获取信息失败: ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || 'unknown'
    const contentLength = response.headers.get('content-length')
    const size = contentLength ? parseInt(contentLength) : undefined

    return {
      url: imageUrl,
      size: size,
      type: contentType
    }
  } catch (error) {
    return {
      url: imageUrl,
      error: error instanceof Error ? error.message : '获取信息失败'
    }
  }
}