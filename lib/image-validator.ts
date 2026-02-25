// 图片验证工具

export async function validateImageUrl(url: string): Promise<{
  valid: boolean
  type?: string
  size?: number
  error?: string
}> {
  try {
    // 过滤掉明显的无效图片
    if (url.startsWith('data:image') || 
        url.includes('avatar') || 
        url.includes('placeholder') || 
        url.includes('default') ||
        url.length < 20) {
      return { valid: false, error: 'Invalid image type' }
    }

    // 发送HEAD请求验证图片
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` }
    }

    const contentType = response.headers.get('content-type') || ''
    const contentLength = response.headers.get('content-length') || '0'
    const size = parseInt(contentLength)

    // 验证是图片类型
    if (!contentType.includes('image')) {
      return { valid: false, error: 'Not an image' }
    }

    // 验证图片大小（大于1KB）
    if (size < 1000) {
      return { valid: false, error: 'Image too small' }
    }

    return {
      valid: true,
      type: contentType,
      size: size
    }
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    }
  }
}

// 批量验证图片URL
export async function validateImageUrls(urls: string[]): Promise<{
  valid: string[]
  invalid: Array<{ url: string; error: string }>
}> {
  const valid: string[] = []
  const invalid: Array<{ url: string; error: string }> = []

  // 并发验证，但限制并发数量
  const batchSize = 5
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async (url) => ({
        url,
        result: await validateImageUrl(url)
      }))
    )

    results.forEach(({ url, result }) => {
      if (result.valid) {
        valid.push(url)
      } else {
        invalid.push({ url, error: result.error || 'Unknown error' })
      }
    })

    // 添加延迟避免请求过快
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return { valid, invalid }
}