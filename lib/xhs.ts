export type XhsPostData = {
  author: string
  images: string[]
  title: string
  date: string
}

export type XhsRealData = {
  author: string
  title: string
  cover_url: string
  images: string[]
  date: string
}

export type XhsRealDataResult =
  | { ok: true; data: XhsRealData }
  | { ok: false; error: string; details?: unknown }

type RapidApiResponse = {
  title?: string
  user?: {
    nickname?: string
    name?: string
  }
  note?: {
    title?: string
    user?: {
      nickname?: string
      name?: string
    }
    images?: Array<string | { url?: string; url_default?: string; info_list?: Array<{ url?: string }> }>
    image_list?: Array<{ url_default?: string; info_list?: Array<{ url?: string }> }>
  }
  data?: {
    title?: string
    user?: {
      nickname?: string
      name?: string
    }
    images?: Array<string | { url?: string; url_default?: string; info_list?: Array<{ url?: string }> }>
    image_list?: Array<{ url_default?: string; info_list?: Array<{ url?: string }> }>
    note?: {
      title?: string
      user?: {
        nickname?: string
        name?: string
      }
      images?: Array<string | { url?: string; url_default?: string; info_list?: Array<{ url?: string }> }>
      image_list?: Array<{ url_default?: string; info_list?: Array<{ url?: string }> }>
    }
    time?: number | string
    date?: string
  }
  message?: string
}

function extractHttpUrl(input: string) {
  const match = input.match(/https?:\/\/[^\s"'<>]+/i)
  return match?.[0] ?? ''
}

function extractNoteId(noteUrl: string) {
  const cleanedUrl = extractHttpUrl(noteUrl)
  if (!cleanedUrl) {
    return ''
  }

  try {
    const parsed = new URL(cleanedUrl)
    const noteIdFromQuery = parsed.searchParams.get('noteId')
    if (noteIdFromQuery) {
      return noteIdFromQuery
    }

    const pathMatch = parsed.pathname.match(/\/(?:explore|discovery\/item|item|note)\/([a-zA-Z0-9]+)/)
    if (pathMatch?.[1]) {
      return pathMatch[1]
    }

    const genericMatch = parsed.pathname.match(/\/([a-zA-Z0-9]{10,})/)
    return genericMatch?.[1] ?? ''
  } catch {
    return ''
  }
}

function pickImageUrls(payload: RapidApiResponse['data']) {
  const rawImages = payload?.images
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    return rawImages
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }

        return item.url ?? item.url_default ?? item.info_list?.[0]?.url ?? ''
      })
      .filter((url) => Boolean(url))
  }

  const imageList = payload?.image_list
  if (Array.isArray(imageList) && imageList.length > 0) {
    return imageList
      .map((item) => item.url_default ?? item.info_list?.[0]?.url ?? '')
      .filter((url) => Boolean(url))
  }

  return []
}

function pickImageUrlsFromResponse(payload: RapidApiResponse) {
  const fromData = pickImageUrls(payload.data)
  if (fromData.length > 0) {
    return fromData
  }

  const fromDataNote = pickImageUrls(payload.data?.note)
  if (fromDataNote.length > 0) {
    return fromDataNote
  }

  const fromNote = pickImageUrls(payload.note)
  if (fromNote.length > 0) {
    return fromNote
  }

  return []
}

function pickTitle(payload: RapidApiResponse) {
  return (
    payload.data?.title?.trim() ??
    payload.data?.note?.title?.trim() ??
    // 部分接口返回 note.note.title
    (payload.data as any)?.note?.note?.title?.trim() ??
    payload.note?.title?.trim() ??
    payload.title?.trim() ??
    ''
  )
}

function pickAuthor(payload: RapidApiResponse) {
  return (
    payload.data?.user?.nickname?.trim() ??
    payload.data?.user?.name?.trim() ??
    payload.data?.note?.user?.nickname?.trim() ??
    payload.data?.note?.user?.name?.trim() ??
    (payload.data as any)?.note?.note?.user?.nickname?.trim() ??
    (payload.data as any)?.note?.note?.user?.name?.trim() ??
    payload.note?.user?.nickname?.trim() ??
    payload.note?.user?.name?.trim() ??
    payload.user?.nickname?.trim() ??
    payload.user?.name?.trim() ??
    ''
  )
}

function normalizeDate(rawDate: string | number | undefined) {
  if (typeof rawDate === 'number') {
    const millis = rawDate > 1e12 ? rawDate : rawDate * 1000
    return new Date(millis).toISOString()
  }

  if (typeof rawDate === 'string' && rawDate.trim()) {
    const parsed = new Date(rawDate)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return new Date().toISOString()
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchXhsRealData(noteUrl: string): Promise<XhsRealDataResult> {
  console.log('开始获取小红书数据:', noteUrl)
  const noteId = extractNoteId(noteUrl)
  console.log('提取的 noteId:', noteId)
  if (!noteId) {
    console.error('错误: 未能从链接中提取 noteId')
    return { ok: false, error: '未能从链接中提取 noteId' }
  }

  const rapidApiKey = process.env.X_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY
  console.log('RapidAPI Key 配置:', rapidApiKey ? '已配置' : '未配置')
  if (!rapidApiKey) {
    console.error('错误: 缺少 RapidAPI Key')
    return {
      ok: false,
      error: '缺少 RapidAPI Key，请检查 X_RAPIDAPI_KEY',
    }
  }

  try {
    const endpoint = `https://xiaohongshu-all-api.p.rapidapi.com/api/xiaohongshu/get-note-detail/v1?noteId=${encodeURIComponent(noteId)}`
    console.log('RapidAPI 端点:', endpoint)

    let response: Response | null = null
    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      console.log(`尝试第 ${attempt} 次请求...`)
      response = await fetchWithTimeout(endpoint, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'xiaohongshu-all-api.p.rapidapi.com',
        },
      })

      console.log(`响应状态: ${response.status}`)
      if (response.ok) {
        console.log('请求成功！')
        break
      }

      const isRetryable = response.status === 429 || response.status >= 500
      const isLastAttempt = attempt === maxAttempts
      if (!isRetryable || isLastAttempt) {
        console.log('不再重试，请求失败')
        break
      }

      console.log(`准备重试 (${attempt}/3)...`)
      await delay(500 * attempt)
    }

    if (!response) {
      console.error('错误: 未收到响应')
      return {
        ok: false,
        error: 'RapidAPI 请求失败：未收到响应',
      }
    }

    if (!response.ok) {
      console.error(`错误: 请求失败，状态码 ${response.status}`)
      if (response.status === 503) {
        return {
          ok: false,
          error: 'RapidAPI 服务暂时不可用（503），请稍后重试',
        }
      }

      return {
        ok: false,
        error: `RapidAPI 请求失败：${response.status}`,
      }
    }

    console.log('解析响应数据...')
    const payload = (await response.json()) as RapidApiResponse
    console.log('响应数据类型:', typeof payload)
    console.log('响应数据包含 data:', 'data' in payload)
    
    const title = pickTitle(payload)
    const author = pickAuthor(payload)
    const resolvedTitle = title || `未命名笔记 (${noteId.slice(0, 6)}...)`
    const resolvedAuthor = author || '未知作者'
    const images = pickImageUrlsFromResponse(payload)
    const cover_url = images[0] ?? ''

    console.log('提取的信息:')
    console.log('- 标题:', resolvedTitle)
    console.log('- 作者:', resolvedAuthor)
    console.log('- 封面图:', cover_url)
    console.log('- 图片数量:', images.length)

    return {
      ok: true,
      data: {
        title: resolvedTitle,
        author: resolvedAuthor,
        cover_url,
        images,
        date: normalizeDate(payload.data?.date ?? payload.data?.time),
      },
    }
  } catch (error) {
    console.error('捕获到错误:', error)
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'RapidAPI 请求超时，请稍后重试' }
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : '解析失败',
    }
  }
}

export async function fetchXhsData(url: string): Promise<XhsPostData> {
  const result = await fetchXhsRealData(url)
  if (!result.ok) {
    throw new Error(result.error)
  }

  return {
    author: result.data.author,
    title: result.data.title,
    images: result.data.images,
    date: result.data.date,
  }
}
