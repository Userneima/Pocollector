// 小红书网页爬取方案（备用方案）

export type XhsScraperData = {
  author: string
  title: string
  cover_url: string
  images: string[]
  date: string
}

export type XhsScraperResult =
  | { ok: true; data: XhsScraperData }
  | { ok: false; error: string; details?: unknown }

// 提取小红书笔记ID
function extractNoteId(noteUrl: string): string {
  try {
    const url = new URL(noteUrl)
    // 从查询参数获取
    const noteIdFromQuery = url.searchParams.get('noteId')
    if (noteIdFromQuery) {
      return noteIdFromQuery
    }

    // 从路径获取
    const pathMatch = url.pathname.match(/\/(?:explore|discovery\/item|item|note)\/([a-zA-Z0-9]+)/)
    if (pathMatch?.[1]) {
      return pathMatch[1]
    }

    // 通用提取
    const genericMatch = url.pathname.match(/\/([a-zA-Z0-9]{10,})/)
    return genericMatch?.[1] ?? ''
  } catch {
    return ''
  }
}

// 从 HTML 中提取图片 URL
function extractImagesFromHtml(html: string): string[] {
  const images: string[] = []
  
  console.log('开始从 HTML 提取图片...')
  
  // 方法1: 从 window.__INITIAL_STATE__ 中提取
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/)
  if (stateMatch?.[1]) {
    try {
      const state = JSON.parse(stateMatch[1])
      console.log('成功解析 window.__INITIAL_STATE__')
      const imageUrls = extractImagesFromState(state)
      if (imageUrls.length > 0) {
        console.log(`从 state 提取到 ${imageUrls.length} 张图片`)
        return imageUrls
      }
    } catch (e) {
      console.warn('解析 state 失败:', e)
    }
  }

  // 方法2: 从 meta 标签中提取
  console.log('尝试从 meta 标签提取图片...')
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i)
  if (ogImageMatch?.[1]) {
    console.log('从 og:image 提取到图片:', ogImageMatch[1])
    images.push(ogImageMatch[1])
  }

  // 方法3: 从 Twitter Card 标签中提取
  const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']*)["'][^>]*>/i)
  if (twitterImageMatch?.[1]) {
    console.log('从 twitter:image 提取到图片:', twitterImageMatch[1])
    images.push(twitterImageMatch[1])
  }

  // 方法4: 从图片标签中提取
  console.log('尝试从 img 标签提取图片...')
  const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi)
  for (const match of imgMatches) {
    if (match[1]) {
      const src = match[1]
      // 过滤掉base64占位图和无效图片
      if (
        src.startsWith('data:image') ||
        src.includes('avatar') ||
        src.includes('placeholder') ||
        src.includes('default') ||
        src.length < 20
      ) {
        console.log('跳过无效图片:', src)
        continue
      }
      
      // 接受更多图片来源，但排除明显的占位图
      if (
        src.includes('xiaohongshu') ||
        src.includes('xhs') ||
        src.includes('akamaized.net') ||
        src.includes('ci.img.xiaohongshu.com') ||
        src.includes('sns-webpic.xhscdn.com') ||
        src.includes('cdn') ||
        src.includes('img') ||
        (src.startsWith('http') && !src.includes('placeholder'))
      ) {
        console.log('从 img 标签提取到图片:', src)
        images.push(src)
      }
    }
  }

  // 方法5: 从 JSON 数据中提取所有可能的图片 URL
  console.log('尝试从 JSON 数据中提取图片...')
  const jsonImages = extractImagesFromJson(html)
  if (jsonImages.length > 0) {
    console.log(`从 JSON 数据提取到 ${jsonImages.length} 张图片`)
    images.push(...jsonImages)
  }

  // 方法6: 从 script 标签中提取图片
  console.log('尝试从 script 标签提取图片...')
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of scriptMatches) {
    if (match[1]) {
      const scriptContent = match[1]
      const scriptImages = extractImagesFromScript(scriptContent)
      if (scriptImages.length > 0) {
        console.log(`从 script 标签提取到 ${scriptImages.length} 张图片`)
        images.push(...scriptImages)
      }
    }
  }

  const uniqueImages = [...new Set(images)]
  console.log(`总共提取到 ${uniqueImages.length} 张唯一图片`)
  return uniqueImages
}

// 从 state 中提取图片
function extractImagesFromState(state: any): string[] {
  const images: string[] = []
  
  try {
    // 尝试不同的路径结构，包括更多可能的路径
    const possiblePaths = [
      'note.note.imageList',
      'note.imageList',
      'note.note.images',
      'note.images',
      'imageList',
      'images',
      'noteInfo.imageList',
      'noteInfo.images',
      'data.note.imageList',
      'data.note.images',
      'content.imageList',
      'content.images',
      'noteDetail.imageList',
      'noteDetail.images',
      'shareInfo.imageList',
      'shareData.imageList',
      'detail.imageList',
      'detail.images',
      'post.imageList',
      'post.images'
    ]

    for (const path of possiblePaths) {
      const imageList = path.split('.').reduce((obj, key) => obj?.[key], state)
      if (Array.isArray(imageList) && imageList.length > 0) {
        for (const img of imageList) {
          if (typeof img === 'string') {
            images.push(img)
          } else if (img?.url) {
            images.push(img.url)
          } else if (img?.url_default) {
            images.push(img.url_default)
          } else if (img?.url_default_1) {
            images.push(img.url_default_1)
          } else if (img?.url_large) {
            images.push(img.url_large)
          } else if (img?.src) {
            images.push(img.src)
          }
        }
        if (images.length > 0) break
      }
    }

    // 尝试从 state 字符串中提取所有图片 URL，过滤无效图片
    if (images.length === 0) {
      const stateStr = JSON.stringify(state)
      const urlPatterns = [
        /https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp|gif)/gi,
        /https?:\/\/[^"'\s]*akamaized\.net[^"'\s]+/gi,
        /https?:\/\/[^"'\s]*xiaohongshu\.com[^"'\s]+/gi,
        /https?:\/\/[^"'\s]*xhslink\.com[^"'\s]+/gi,
        /https?:\/\/[^"'\s]*ci\.img\.xiaohongshu\.com[^"'\s]+/gi,
        /https?:\/\/[^"'\s]*sns-webpic\.xhscdn\.com[^"'\s]+/gi
      ]

      for (const pattern of urlPatterns) {
        const matches = stateStr.match(pattern)
        if (matches) {
          // 过滤掉base64和无效图片
          const validImages = matches.filter(url => 
            !url.startsWith('data:image') && 
            !url.includes('avatar') && 
            !url.includes('placeholder') &&
            url.length > 20
          )
          images.push(...validImages)
        }
      }
    }
  } catch (e) {
    console.warn('从 state 提取图片失败:', e)
  }

  return images
}

// 从 JSON 数据中提取图片
function extractImagesFromJson(html: string): string[] {
  const images: string[] = []
  
  try {
    // 查找所有 JSON 对象
    const jsonMatches = html.match(/\{[^{}]*\}/g)
    if (jsonMatches) {
      for (const jsonStr of jsonMatches) {
        try {
          const obj = JSON.parse(jsonStr)
          const objStr = JSON.stringify(obj)
          
          // 提取 URL，使用更全面的模式
          const urlPatterns = [
            /https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp|gif)/gi,
            /https?:\/\/[^"'\s]*akamaized\.net[^"'\s]+/gi,
            /https?:\/\/[^"'\s]*xiaohongshu\.com[^"'\s]+/gi,
            /https?:\/\/[^"'\s]*xhslink\.com[^"'\s]+/gi,
            /https?:\/\/[^"'\s]*ci\.img\.xiaohongshu\.com[^"'\s]+/gi,
            /https?:\/\/[^"'\s]*sns-webpic\.xhscdn\.com[^"'\s]+/gi
          ]
          
          for (const pattern of urlPatterns) {
            const matches = objStr.match(pattern)
            if (matches) {
              // 过滤掉base64和无效图片
              const validImages = matches.filter(url => 
                !url.startsWith('data:image') && 
                !url.includes('avatar') && 
                !url.includes('placeholder') &&
                url.length > 20
              )
              images.push(...validImages)
            }
          }
        } catch (e) {
          // 忽略解析失败的 JSON
        }
      }
    }
  } catch (e) {
    console.warn('从 JSON 提取图片失败:', e)
  }

  return [...new Set(images)]
}

// 从 script 标签中提取图片
function extractImagesFromScript(scriptContent: string): string[] {
  const images: string[] = []
  
  try {
    // 提取所有可能的图片 URL，使用更全面的模式
    const urlPatterns = [
      /https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp|gif)/gi,
      /https?:\/\/[^"'\s]*akamaized\.net[^"'\s]+/gi,
      /https?:\/\/[^"'\s]*xiaohongshu\.com[^"'\s]+/gi,
      /https?:\/\/[^"'\s]*xhslink\.com[^"'\s]+/gi,
      /https?:\/\/[^"'\s]*ci\.img\.xiaohongshu\.com[^"'\s]+/gi,
      /https?:\/\/[^"'\s]*sns-webpic\.xhscdn\.com[^"'\s]+/gi
    ]

    for (const pattern of urlPatterns) {
      const matches = scriptContent.match(pattern)
      if (matches) {
        // 过滤掉base64和无效图片
        const validImages = matches.filter(url => 
          !url.startsWith('data:image') && 
          !url.includes('avatar') && 
          !url.includes('placeholder') &&
          url.length > 20
        )
        images.push(...validImages)
      }
    }
  } catch (e) {
    console.warn('从 script 提取图片失败:', e)
  }

  return [...new Set(images)]
}

// 提取标题
function extractTitle(html: string): string {
  console.log('开始提取标题...')
  
  // 方法1: 从 title 标签
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
  if (titleMatch?.[1]) {
    const title = titleMatch[1].trim()
    console.log('从 title 标签提取到标题:', title)
    return title
  }

  // 方法2: 从 meta 标签
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i)
  if (ogTitleMatch?.[1]) {
    const title = ogTitleMatch[1].trim()
    console.log('从 og:title 提取到标题:', title)
    return title
  }

  // 方法3: 从 Twitter Card 标签
  const twitterTitleMatch = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["'][^>]*>/i)
  if (twitterTitleMatch?.[1]) {
    const title = twitterTitleMatch[1].trim()
    console.log('从 twitter:title 提取到标题:', title)
    return title
  }

  // 方法4: 从 state 中提取
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/)
  if (stateMatch?.[1]) {
    try {
      const state = JSON.parse(stateMatch[1])
      const title = extractTitleFromState(state)
      if (title) {
        console.log('从 state 提取到标题:', title)
        return title
      }
    } catch (e) {
      console.warn('从 state 提取标题失败:', e)
    }
  }

  console.log('未能提取到标题')
  return ''
}

// 从 state 中提取标题
function extractTitleFromState(state: any): string {
  const possiblePaths = [
    'note.note.title',
    'note.title',
    'noteInfo.title',
    'title',
    'shareInfo.title',
    'shareData.title',
    'data.note.title',
    'content.title',
    'noteDetail.title'
  ]

  for (const path of possiblePaths) {
    const title = path.split('.').reduce((obj, key) => obj?.[key], state)
    if (title && typeof title === 'string') {
      return title.trim()
    }
  }

  // 尝试从字符串中提取标题
  const stateStr = JSON.stringify(state)
  const titleMatches = stateStr.match(/"title":"([^"]*)"/g)
  if (titleMatches && titleMatches.length > 0) {
    const title = titleMatches[0].match(/"title":"([^"]*)"/)
    if (title?.[1]) {
      return title[1].trim()
    }
  }

  return ''
}

// 提取作者
function extractAuthor(html: string): string {
  console.log('开始提取作者...')
  
  // 方法1: 从 state 中提取
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/)
  if (stateMatch?.[1]) {
    try {
      const state = JSON.parse(stateMatch[1])
      const author = extractAuthorFromState(state)
      if (author) {
        console.log('从 state 提取到作者:', author)
        return author
      }
    } catch (e) {
      console.warn('从 state 提取作者失败:', e)
    }
  }

  // 方法2: 从 meta 标签中提取
  const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*)["'][^>]*>/i)
  if (authorMatch?.[1]) {
    const author = authorMatch[1].trim()
    console.log('从 author meta 标签提取到作者:', author)
    return author
  }

  // 方法3: 从字符串中提取昵称
  const nicknameMatches = html.match(/"nickname":"([^"]*)"/g)
  if (nicknameMatches && nicknameMatches.length > 0) {
    const author = nicknameMatches[0].match(/"nickname":"([^"]*)"/)
    if (author?.[1]) {
      console.log('从 nickname 提取到作者:', author[1])
      return author[1].trim()
    }
  }

  console.log('未能提取到作者')
  return ''
}

// 从 state 中提取作者
function extractAuthorFromState(state: any): string {
  const possiblePaths = [
    'note.note.user.nickname',
    'note.user.nickname',
    'noteInfo.user.nickname',
    'user.nickname',
    'note.note.user.name',
    'note.user.name',
    'noteInfo.user.name',
    'user.name',
    'data.note.user.nickname',
    'content.user.nickname',
    'noteDetail.user.nickname'
  ]

  for (const path of possiblePaths) {
    const author = path.split('.').reduce((obj, key) => obj?.[key], state)
    if (author && typeof author === 'string') {
      return author.trim()
    }
  }

  // 尝试从字符串中提取作者
  const stateStr = JSON.stringify(state)
  const nicknameMatches = stateStr.match(/"nickname":"([^"]*)"/g)
  if (nicknameMatches && nicknameMatches.length > 0) {
    const author = nicknameMatches[0].match(/"nickname":"([^"]*)"/)
    if (author?.[1]) {
      return author[1].trim()
    }
  }

  return ''
}

// 获取网页内容
async function fetchHtml(url: string): Promise<string> {
  console.log('开始获取网页内容:', url)
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    }
  })

  console.log('响应状态:', response.status)
  console.log('响应头:', Object.fromEntries(response.headers.entries()))

  if (!response.ok) {
    throw new Error(`获取网页失败: ${response.status}`)
  }

  const html = await response.text()
  console.log('网页内容获取成功，大小:', html.length, '字符')
  
  // 保存部分 HTML 用于调试
  if (html.length < 1000) {
    console.log('完整 HTML 内容:', html.substring(0, 500))
  } else {
    console.log('前 1000 字符预览:', html.substring(0, 1000))
  }

  return html
}

// 主要函数：爬取小红书数据
export async function fetchXhsScraperData(noteUrl: string): Promise<XhsScraperResult> {
  console.log('使用网页爬取方案获取小红书数据:', noteUrl)
  
  try {
    const noteId = extractNoteId(noteUrl)
    if (!noteId) {
      return { ok: false, error: '未能从链接中提取 noteId' }
    }

    console.log('提取的 noteId:', noteId)
    console.log('获取网页内容...')
    
    const html = await fetchHtml(noteUrl)

    console.log('提取图片信息...')
    const images = extractImagesFromHtml(html)
    console.log('提取到图片数量:', images.length)

    console.log('提取标题...')
    const title = extractTitle(html)
    console.log('提取到标题:', title)

    console.log('提取作者...')
    const author = extractAuthor(html)
    console.log('提取到作者:', author)

    if (images.length === 0 && !title && !author) {
      return {
        ok: false,
        error: '未能从网页中提取到有效数据，可能需要登录或页面结构已变更'
      }
    }

    const cover_url = images[0] ?? ''
    const now = new Date().toISOString()

    return {
      ok: true,
      data: {
        title: title || `小红书笔记_${noteId.slice(0, 8)}`,
        author: author || '未知作者',
        cover_url,
        images,
        date: now
      }
    }

  } catch (error) {
    console.error('网页爬取失败:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : '爬取失败',
      details: error
    }
  }
}