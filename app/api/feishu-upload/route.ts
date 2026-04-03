import { NextResponse } from 'next/server'
import type { AddToFeishuBitableInput } from '@/lib/feishu'
import { addToFeishuBitable, getTenantAccessToken } from '@/lib/feishu'

const API_KEY = process.env.EXTENSION_API_KEY || 'test_api_key'

function validateApiKey(request: Request): boolean {
  return request.headers.get('X-API-Key') === API_KEY
}

function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key'
  )
  return response
}

function parseFeishuTableLink(tableUrl: string): { appToken: string; tableId: string } {
  const tableMatch = tableUrl.match(/tbl[a-zA-Z0-9]+/)
  if (!tableMatch) {
    throw new Error('无效的飞书表格链接：未找到 table id（应包含 tbl 前缀）')
  }
  const baseMatch = tableUrl.match(/\/base\/([A-Za-z0-9]+)/)
  if (!baseMatch) {
    throw new Error('无效的飞书表格链接：未找到 base 应用 token（链接中应包含 /base/xxx）')
  }
  return { appToken: baseMatch[1], tableId: tableMatch[0] }
}

export async function OPTIONS() {
  return addCorsHeaders(NextResponse.json({}))
}

export async function POST(request: Request) {
  try {
    if (!validateApiKey(request)) {
      return addCorsHeaders(
        NextResponse.json({ success: false, error: '无效的 API_KEY' }, { status: 401 })
      )
    }

    const body = (await request.json()) as {
      feishuTableUrl?: string
      uploadData?: AddToFeishuBitableInput
    }

    if (!body.feishuTableUrl || !body.uploadData) {
      return addCorsHeaders(
        NextResponse.json(
          { success: false, error: '缺少 feishuTableUrl 或 uploadData' },
          { status: 400 }
        )
      )
    }

    const { appToken, tableId } = parseFeishuTableLink(body.feishuTableUrl)
    const token = await getTenantAccessToken()
    await addToFeishuBitable(body.uploadData, token, appToken, tableId)

    return addCorsHeaders(
      NextResponse.json({ success: true, message: '上传到飞书成功' })
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : '上传失败'
    return addCorsHeaders(
      NextResponse.json({ success: false, error: msg }, { status: 500 })
    )
  }
}
