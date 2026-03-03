type FeishuTokenResponse = {
  code: number
  msg: string
  tenant_access_token?: string
  expire?: number
}

type FeishuBitableRecordResponse = {
  code: number
  msg: string
  data?: {
    record?: {
      record_id?: string
    }
  }
}

type FeishuAttachment = {
  name: string
  type: 'image'
  file_token: string
}

type FeishuUploadResponse = {
  code: number
  msg: string
  data?: {
    file_token?: string
  }
}

type AddToFeishuBitableInput = {
  bloggerName: string
  productImageUrl: string
  entryDate: string
  productName: string
  category: string
  productImage: string
  productType?: string
  platform?: string
  images?: string[]
}

const FEISHU_AUTH_URL =
  'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/'

let cachedToken: string | null = null
let cachedTokenExpiresAt = 0

const TOKEN_SKEW_MS = 30 * 1000
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

const FEISHU_FIELD_BLOGGER_NAME = '店名'
const FEISHU_FIELD_PRODUCT_IMAGE_URL = '链接'
const FEISHU_FIELD_ENTRY_DATE = '入档日期'
const FEISHU_FIELD_PRODUCT_NAME = '产品名'
const FEISHU_FIELD_CATEGORY = '种类'
const FEISHU_FIELD_PRODUCT_IMAGE = '产品图'
const FEISHU_FIELD_PLATFORM = '平台来源'

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function readFeishuEnv() {
  const appId = process.env.FEISHU_APP_ID
  const appSecret = process.env.FEISHU_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('缺少飞书环境变量，请检查 FEISHU_APP_ID 和 FEISHU_APP_SECRET')
  }

  return { appId, appSecret }
}

function readBitableEnv() {
  const appToken = process.env.FEISHU_APP_TOKEN
  const tableId = process.env.FEISHU_TABLE_ID

  if (!appToken || !tableId) {
    throw new Error('缺少飞书多维表格环境变量，请检查 FEISHU_APP_TOKEN 和 FEISHU_TABLE_ID')
  }

  return { appToken, tableId }
}

function buildBitableRecordUrl(appToken: string, tableId: string) {
  return `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`
}

function buildUploadUrl() {
  return 'https://open.feishu.cn/open-apis/drive/v1/medias/upload_all'
}

function inferFileExtension(contentType: string | null) {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('webp')) return 'webp'
  if (contentType?.includes('gif')) return 'gif'
  return 'jpg'
}

function getFileNameFromUrl(url: string, contentType: string | null) {
  try {
    const pathname = new URL(url).pathname
    const lastSegment = pathname.split('/').pop()
    if (lastSegment && lastSegment.includes('.')) {
      return lastSegment
    }
  } catch {
    // Ignore URL parse errors and fallback to default name.
  }

  const extension = inferFileExtension(contentType)
  return `product-image.${extension}`
}

async function uploadImageFromUrl(
  url: string,
  token: string,
  appToken: string
): Promise<FeishuAttachment[]> {
  if (!url) {
    return []
  }

  let blob: Blob
  let fileName: string
  let contentType: string

  // 处理 base64 图片
  if (url.startsWith('data:')) {
    // 从 base64 中提取内容类型和数据
    const matches = url.match(/^data:(.+);base64,(.+)$/)
    if (!matches) {
      throw new Error('无效的 base64 图片格式')
    }
    contentType = matches[1]
    const base64Data = matches[2]
    // 使用 Web 标准 API 解码 base64
    const binaryString = atob(base64Data)
    const binaryData = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      binaryData[i] = binaryString.charCodeAt(i)
    }
    blob = new Blob([binaryData], { type: contentType })
    fileName = `upload_${Date.now()}.${contentType.split('/')[1] || 'jpg'}`
  } else {
    // 原有逻辑：下载远程图片
    let imageResponse: Response
    try {
      imageResponse = await fetchWithTimeout(url, { method: 'GET' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('图片下载超时，请稍后重试')
      }
      throw error
    }

    if (!imageResponse.ok) {
      throw new Error(`图片下载失败：${imageResponse.status}`)
    }

    contentType = imageResponse.headers.get('content-type') || 'application/octet-stream'
    fileName = getFileNameFromUrl(url, contentType)
    const arrayBuffer = await imageResponse.arrayBuffer()
    blob = new Blob([arrayBuffer], {
      type: contentType,
    })
  }

  const formData = new FormData()
  formData.set('file_name', fileName)
  formData.set('parent_type', 'bitable_image')
  formData.set('parent_node', appToken)
  const arrayBuffer = await blob.arrayBuffer()
  formData.set('size', String(arrayBuffer.byteLength))
  formData.set('file', blob, fileName)

  let uploadResponse: Response
  try {
    uploadResponse = await fetchWithTimeout(buildUploadUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('飞书上传超时，请稍后重试')
    }
    throw error
  }

  if (uploadResponse.status === 403) {
    throw new Error(
      '飞书权限不足（403），请检查应用是否已添加为多维表格协作者。'
    )
  }

  if (!uploadResponse.ok) {
    throw new Error(`飞书上传失败：${uploadResponse.status}`)
  }

  const uploadData = (await uploadResponse.json()) as FeishuUploadResponse

  if (uploadData.code !== 0 || !uploadData.data?.file_token) {
    throw new Error(`飞书上传报错：${uploadData.code} ${uploadData.msg}`)
  }

  return [
    {
      name: fileName,
      type: 'image',
      file_token: uploadData.data.file_token,
    },
  ]
}

export async function getTenantAccessToken(): Promise<string> {
  const now = Date.now()

  if (cachedToken && cachedTokenExpiresAt > now + TOKEN_SKEW_MS) {
    return cachedToken
  }

  const { appId, appSecret } = readFeishuEnv()

  let response: Response
  try {
    response = await fetchWithTimeout(FEISHU_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('飞书鉴权请求超时，请稍后重试')
    }
    throw error
  }

  if (!response.ok) {
    throw new Error(`飞书鉴权请求失败：${response.status}`)
  }

  const data = (await response.json()) as FeishuTokenResponse

  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`飞书鉴权报错：${data.code} ${data.msg}`)
  }

  const expiresInMs = data.expire ? data.expire * 1000 : TWO_HOURS_MS
  cachedToken = data.tenant_access_token
  cachedTokenExpiresAt = now + expiresInMs

  return cachedToken
}

export async function addToFeishuBitable(
  input: AddToFeishuBitableInput,
  token?: string,
  appToken?: string,
  tableId?: string
) {
  const accessToken = token ?? (await getTenantAccessToken())
  
  // 优先使用传入的 appToken 和 tableId
  let finalAppToken = appToken
  let finalTableId = tableId
  
  // 只有在传入的值不存在时才尝试读取环境变量
  if (!finalAppToken || !finalTableId) {
    const envConfig = readBitableEnv()
    finalAppToken = finalAppToken ?? envConfig.appToken
    finalTableId = finalTableId ?? envConfig.tableId
  }
  
  let productImageAttachments: FeishuAttachment[] = []
  
  // 处理所有图片
  const allImages = input.images && input.images.length > 0 ? input.images : [input.productImage]
  
  try {
    for (const imageUrl of allImages) {
      if (imageUrl) {
        const attachments = await uploadImageFromUrl(
          imageUrl,
          accessToken,
          finalAppToken
        )
        productImageAttachments = [...productImageAttachments, ...attachments]
      }
    }
  } catch (error) {
    console.warn('图片上传失败，已跳过该字段：', error)
  }

  const date = new Date(input.entryDate)
  const dateTimestamp = date.getTime()

  const fields: Record<string, unknown> = {}

  const resolvedCategory = input.productType?.trim() || input.category

  if (input.bloggerName) {
    fields[FEISHU_FIELD_BLOGGER_NAME] = input.bloggerName
  }

  if (input.productImageUrl) {
    fields[FEISHU_FIELD_PRODUCT_IMAGE_URL] = {
      text: input.productImageUrl,
      link: input.productImageUrl,
    }
  }

  if (input.entryDate) {
    fields[FEISHU_FIELD_ENTRY_DATE] = dateTimestamp
  }

  if (input.productName) {
    fields[FEISHU_FIELD_PRODUCT_NAME] = input.productName
  }

  if (resolvedCategory) {
    fields[FEISHU_FIELD_CATEGORY] = resolvedCategory
  }

  if (productImageAttachments.length > 0) {
    fields[FEISHU_FIELD_PRODUCT_IMAGE] = productImageAttachments
  }

  if (input.platform) {
    fields[FEISHU_FIELD_PLATFORM] = input.platform
  }

  // 增加诊断日志：在发起飞书请求前，输出 AppToken 和 TableID
  console.log('正在向多维表格写入数据 - AppToken:', finalAppToken, 'TableID:', finalTableId)

  let response: Response
  try {
    response = await fetchWithTimeout(buildBitableRecordUrl(finalAppToken, finalTableId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ fields }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('飞书写入超时，请稍后重试')
    }
    throw error
  }

  if (response.status === 403) {
    throw new Error(
      '飞书权限不足（403），请检查应用是否已添加为多维表格协作者。'
    )
  }

  if (!response.ok) {
    throw new Error(`飞书多维表格请求失败：${response.status}`)
  }

  const data = (await response.json()) as FeishuBitableRecordResponse

  if (data.code !== 0) {
    if (data.code === 1254041) {
      throw new Error('未找到数据表，请检查 Table ID (应以 tbl 开头) 是否与飞书地址栏一致')
    }
    throw new Error(`飞书多维表格报错：${data.code} ${data.msg}`)
  }

  return data
}
