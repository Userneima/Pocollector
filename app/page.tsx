'use client'

import { useEffect, useState } from 'react'

// 简单的图片分析函数：根据图片文件名或内容猜测产品类型
async function analyzeImageType(imageFile: File): Promise<string> {
  // 这里仅做演示：根据文件名关键词简单分类
  const name = imageFile.name.toLowerCase()
  if (name.includes('dress') || name.includes('skirt')) return '连衣裙'
  if (name.includes('shirt') || name.includes('top')) return '上衣'
  if (name.includes('shoe') || name.includes('sneaker')) return '鞋子'
  if (name.includes('bag') || name.includes('handbag')) return '包包'
  if (name.includes('cosmetic') || name.includes('lipstick')) return '美妆'
  if (name.includes('food') || name.includes('snack')) return '食品'
  return '其他'
}

// 图片分析API调用函数
async function analyzeImageWithAPI(imageFile: File, currentProductType: string, title: string, useDeepSeek: boolean): Promise<string> {
  try {
    // 将图片转换为base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(imageFile)
    })
    
    const response = await fetch('/api/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        currentProductType: currentProductType,
        title: title,
        useDeepSeek: useDeepSeek
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      console.log('图片分析结果:', data.data)
      return data.data.productType
    } else {
      console.warn('图片分析失败:', data.error)
      return currentProductType
    }
  } catch (error) {
    console.error('图片分析API调用失败:', error)
    return currentProductType
  }
}

// 处理图片上传
async function handleImageUpload(files: FileList, currentProductType: string, title: string, setEditableData: Function, editableData: any, useDeepSeek: boolean) {
  if (files && files.length > 0) {
    // 分析第一张图片的产品类型
    const firstFile = files[0]
    const analyzedType = await analyzeImageWithAPI(firstFile, currentProductType, title, useDeepSeek)
    
    const newImages = Array.from(files).map(file => URL.createObjectURL(file))
    const updatedImages = [...editableData.images, ...newImages]
    const updatedSelected = [...editableData.selectedImages, ...new Array(files.length).fill(true)]
    
    setEditableData({
      ...editableData,
      images: updatedImages,
      selectedImages: updatedSelected,
      productType: analyzedType // 更新产品类型
    })
    
    console.log(`图片分析完成: ${analyzedType}`)
  }
}

type StatusState =
  | { type: 'idle'; message: '' }
  | { type: 'loading'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }

type HistoryItem = { url: string; time: number; title?: string }
const HISTORY_KEY = 'xhs-history'

type FeishuTableHistoryItem = { url: string; time: number; name?: string }
const FEISHU_TABLE_HISTORY_KEY = 'feishu-table-history'

type PreviewData = {
  title: string
  author: string
  coverUrl: string
  images: string[]
  productType: string
} | null

type EditableData = {
  title: string
  author: string
  productType: string
  images: string[]
  selectedImages: boolean[]
}

type ChangelogItem = {
  version: string
  date: string
  items: string[]
}

const CHANGELOG: ChangelogItem[] = [
  {
    version: 'v1.6.0',
    date: '2026-02-25',
    items: [
      '新增可编辑预览界面，支持手动修改内容',
      '实现图片选择功能，可勾选要上传的图片',
      '优化上传流程：获取→编辑→确认→上传',
      '保留图片本地下载功能，支持单张下载',
    ],
  },
  {
    version: 'v1.5.0',
    date: '2026-02-25',
    items: [
      '将"获取预览"改为"下载图片"功能',
      '支持直接下载小红书图片到本地',
      '提供批量下载和单张下载选项',
      '优化图片下载体验，显示下载进度',
    ],
  },
  {
    version: 'v1.3.0',
    date: '2026-02-23',
    items: [
      '新增历史输入侧边栏，可回填最近链接',
      '优化 DeepSeek 提取：更稳标题/分类写入',
      '修复飞书字段映射，产品类型写入"种类"',
    ],
  },
]

export default function Home() {
  const [xhsUrl, setXhsUrl] = useState('')
  const [status, setStatus] = useState<StatusState>({
    type: 'idle',
    message: '',
  })
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [previewData, setPreviewData] = useState<PreviewData>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [downloadedImages, setDownloadedImages] = useState<string[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editableData, setEditableData] = useState<EditableData | null>(null)
  const [useDeepSeek, setUseDeepSeek] = useState(true)
  const [feishuTableUrl, setFeishuTableUrl] = useState('')
  const [showDirectInput, setShowDirectInput] = useState(false)
  const [appToken, setAppToken] = useState('')
  const [tableId, setTableId] = useState('')
  const [feishuTableHistory, setFeishuTableHistory] = useState<FeishuTableHistoryItem[]>([])
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false)

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_KEY)
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory))
      } catch {
        localStorage.removeItem(HISTORY_KEY)
      }
    }
    
    // 从本地存储读取保存的飞书表格URL
    const savedFeishuTableUrl = localStorage.getItem('feishuTableUrl')
    if (savedFeishuTableUrl) {
      setFeishuTableUrl(savedFeishuTableUrl)
    }
    
    // 从本地存储读取飞书表格历史
    const savedFeishuTableHistory = localStorage.getItem(FEISHU_TABLE_HISTORY_KEY)
    if (savedFeishuTableHistory) {
      try {
        setFeishuTableHistory(JSON.parse(savedFeishuTableHistory))
      } catch {
        localStorage.removeItem(FEISHU_TABLE_HISTORY_KEY)
      }
    }
  }, [])

  function pushHistory(url: string, title?: string) {
    const newEntry: HistoryItem = {
      url,
      time: Date.now(),
      title,
    }

    const newHistory = [newEntry, ...history.filter((item) => item.url !== url)].slice(0, 10)
    setHistory(newHistory)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
  }
  
  function pushFeishuTableHistory(url: string) {
    // Extract table name from URL (simplified - could be improved)
    const name = url.split('/').pop()?.split('?')[0] || '飞书表格'
    
    const newEntry: FeishuTableHistoryItem = {
      url,
      time: Date.now(),
      name,
    }

    const newHistory = [newEntry, ...feishuTableHistory.filter((item) => item.url !== url)].slice(0, 5)
    setFeishuTableHistory(newHistory)
    localStorage.setItem(FEISHU_TABLE_HISTORY_KEY, JSON.stringify(newHistory))
  }

  const handleReuse = (url: string) => {
    setXhsUrl(url)
    setStatus({ type: 'idle', message: '' })
  }
  
  const handleReuseFeishuTable = (url: string) => {
    setFeishuTableUrl(url)
    setStatus({ type: 'idle', message: '' })
  }

  // 当输入框内容变化时保存到历史记录
  useEffect(() => {
    const trimmedUrl = xhsUrl.trim()
    if (trimmedUrl && (trimmedUrl.includes('xiaohongshu.com') || trimmedUrl.includes('xhslink.com'))) {
      pushHistory(trimmedUrl)
    }
  }, [xhsUrl])
  
  // 当飞书表格URL变化时，添加到历史记录
  useEffect(() => {
    localStorage.setItem('feishuTableUrl', feishuTableUrl)
    
    // 当飞书表格URL变化时，添加到历史记录
    const trimmedUrl = feishuTableUrl.trim()
    if (trimmedUrl && (trimmedUrl.includes('larkoffice.com') || trimmedUrl.includes('feishu.cn')) && 
        (trimmedUrl.includes('sheets') || trimmedUrl.includes('wiki') || trimmedUrl.includes('base'))) {
      pushFeishuTableHistory(trimmedUrl)
    }
  }, [feishuTableUrl])

  const isLoading = status.type === 'loading'

  // 获取并预览数据功能
  const handlePreview = async () => {
    if (!xhsUrl.trim()) {
      setStatus({ type: 'error', message: '请输入小红书链接。' })
      return
    }

    setIsDownloading(true)
    setStatus({ type: 'loading', message: '正在获取数据...' })

    try {
      // 调用下载 API 获取数据（不实际下载图片）
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xhsUrl: xhsUrl.trim() }),
      })

      const data = await response.json()

      if (!response.ok || !data?.success) {
        setStatus({
          type: 'error',
          message: data?.error || '获取数据失败，请稍后重试。',
        })
        return
      }

      // 处理图片数据：如果是对象数组，提取url属性
      const imageUrls = Array.isArray(data.data.images) 
        ? data.data.images.map((img: { url?: string } | string) => typeof img === 'object' && img.url ? img.url : img)
        : []
      
      // 设置预览数据并打开编辑模态框
      const previewInfo = {
        title: data.data.title,
        author: data.data.author,
        coverUrl: data.data.coverUrl,
        images: imageUrls,
        productType: data.data.productType,
      }
      
      setPreviewData(previewInfo)
      
      // 初始化可编辑数据
      const initialEditableData: EditableData = {
        title: data.data.title,
        author: data.data.author,
        productType: data.data.productType,
        images: imageUrls,
        selectedImages: new Array(imageUrls.length).fill(true)
      }
      
      setEditableData(initialEditableData)
      setShowEditModal(true)
      
      if (imageUrls.length === 0) {
        setStatus({ type: 'success', message: '数据获取成功，未找到图片，请手动上传。' })
      } else {
        setStatus({ type: 'success', message: '数据获取成功，请编辑后确认上传。' })
      }

    } catch (error) {
      setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : '获取数据失败，请检查网络连接或稍后重试。',
        })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSubmit = async () => {
    if (!xhsUrl.trim()) {
      setStatus({ type: 'error', message: '请输入小红书链接。' })
      return
    }

    setStatus({ type: 'loading', message: '提交中...' })

    try {
      const response = await fetch('/api/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          xhsUrl: xhsUrl.trim(), 
          feishuTableUrl: feishuTableUrl.trim(),
          appToken: appToken.trim(),
          tableId: tableId.trim()
        }),
      })

      const data = (await response.json()) as {
        success?: boolean
        error?: string
        message?: string
      }

      if (!response.ok || !data?.success) {
        setStatus({
          type: 'error',
          message: data?.error || '下载图片失败，请稍后重试。',
        })
        return
      }

      setStatus({ type: 'success', message: '已写入飞书多维表格。' })
      pushHistory(xhsUrl)

      // 清空预览数据
      setPreviewData(null)

      setTimeout(() => {
        setXhsUrl('')
        setFeishuTableUrl('')
        setStatus({ type: 'idle', message: '' })
      }, 1200)
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '发生未知错误。',
      })
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
        <div className="grid w-full max-w-5xl gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <section className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-zinc-900">
                小红书采集工具
              </h1>
              <p className="text-sm text-zinc-500">
                粘贴小红书链接，一键写入飞书多维表格。
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <div>
                <label
                  htmlFor="xhs-url"
                  className="mb-2 block text-sm font-medium text-zinc-700"
                >
                  小红书链接
                </label>
                <input
                  id="xhs-url"
                  type="url"
                  value={xhsUrl}
                  onChange={(e) => setXhsUrl(e.target.value)}
                  disabled={isLoading}
                  placeholder="https://www.xiaohongshu.com/explore/..."
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              
              <div>
                <label
                  htmlFor="feishu-table-url"
                  className="mb-2 block text-sm font-medium text-zinc-700"
                >
                  飞书表格链接（可选）
                </label>
                <input
                  id="feishu-table-url"
                  type="url"
                  value={feishuTableUrl}
                  onChange={(e) => setFeishuTableUrl(e.target.value)}
                  disabled={isLoading}
                  placeholder="https://my.feishu.cn/base/... 或 https://bytedance.larkoffice.com/sheets/..."
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                />
                
                {/* Wiki 链接提示 */}
                {feishuTableUrl.includes('wiki') && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">
                      暂不支持 Wiki 表格，请更换为飞书多维表格或 Sheets 链接
                    </p>
                    <p className="mt-1 text-xs text-red-500">
                      推荐格式：https://my.feishu.cn/base/... 或 https://bytedance.larkoffice.com/sheets/...
                    </p>
                  </div>
                )}
                
                {/* 直接输入 App Token 和 Table ID（可选） */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className="block text-sm font-medium text-zinc-700"
                    >
                      直接输入表格信息（可选）
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDirectInput(!showDirectInput)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {showDirectInput ? '收起' : '展开'}
                    </button>
                  </div>
                  
                  {showDirectInput && (
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="app-token"
                          className="mb-2 block text-sm font-medium text-zinc-700"
                        >
                          App Token
                        </label>
                        <input
                          id="app-token"
                          type="text"
                          value={appToken}
                          onChange={(e) => setAppToken(e.target.value)}
                          disabled={isLoading}
                          placeholder="例如：BGQabkuYvaxWehsUre4cXU00nNc"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                      
                      <div>
                        <label
                          htmlFor="table-id"
                          className="mb-2 block text-sm font-medium text-zinc-700"
                        >
                          Table ID
                        </label>
                        <input
                          id="table-id"
                          type="text"
                          value={tableId}
                          onChange={(e) => setTableId(e.target.value)}
                          disabled={isLoading}
                          placeholder="例如：tblBqu6yqyssf6b3"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                      
                      <p className="mt-1 text-xs text-zinc-500">
                        提示：如果您已经知道正确的 App Token 和 Table ID，可以直接输入，系统会优先使用这些值
                      </p>
                    </div>
                  )}
                </div>
                
                {/* 飞书表格历史记录 */}
                {feishuTableHistory.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-zinc-500">最近使用的表格：</p>
                    <div className="flex flex-wrap gap-1">
                      {feishuTableHistory.map((item) => (
                        <button
                          key={item.time}
                          onClick={() => handleReuseFeishuTable(item.url)}
                          className="inline-flex items-center px-2 py-1 text-xs bg-zinc-100 hover:bg-zinc-200 rounded-md transition"
                        >
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {item.name}
                          </a>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center">
                <input
                  id="use-deepseek"
                  type="checkbox"
                  checked={useDeepSeek}
                  onChange={(e) => setUseDeepSeek(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="use-deepseek"
                  className="ml-2 block text-sm text-zinc-700"
                >
                  使用DeepSeek分析标题（更准确的产品类型判断）
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isLoading || isDownloading}
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {isDownloading ? '获取中...' : '获取并预览'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !previewData}
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {isLoading ? '提交中...' : '发送到飞书'}
                </button>
              </div>

              {status.type !== 'idle' && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    status.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : status.type === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-blue-200 bg-blue-50 text-blue-700'
                  }`}
                  role="status"
                >
                  {status.message}
                </div>
              )}

              {/* 编辑预览按钮 */}
              {previewData && (
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 mb-3">数据预览</h3>
                  
                  {/* 基本信息预览 */}
                  <div className="space-y-2 mb-4">
                    <div>
                      <span className="text-xs text-zinc-500">标题：</span>
                      <span className="text-sm text-zinc-900">{previewData.title}</span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500">作者：</span>
                      <span className="text-sm text-zinc-900">{previewData.author}</span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500">类型：</span>
                      <span className="text-sm text-zinc-900">{previewData.productType}</span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500">图片数量：</span>
                      <span className="text-sm text-green-600 font-medium">{previewData.images.length} 张</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    编辑并确认内容
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-900">历史记录</h2>
              <p className="text-xs text-zinc-500">
                自动保存输入的链接，永久存档，点击重新填入。
              </p>
              {history.length > 0 ? (
                <ul className="space-y-2">
                  {history.map((item) => (
                    <li
                      key={item.time}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-xs"
                    >
                      {/* 第一部分：填入的历史记录（原始链接） */}
                      <p className="break-all text-zinc-800">{item.url}</p>
                      
                      {/* 第二部分：可点击的带超链接的标题（上传成功的） */}
                      {item.title && (
                        <p className="mt-1 break-all">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm font-medium"
                          >
                            {item.title}
                          </a>
                        </p>
                      )}
                      
                      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                        <span>{new Date(item.time).toLocaleString()}</span>
                        <button
                          type="button"
                          onClick={() => handleReuse(item.url)}
                          className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
                        >
                          重新填入
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400">暂无历史记录。</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-zinc-900">版本迭代</h2>
                <button
                  onClick={() => setIsVersionHistoryOpen(!isVersionHistoryOpen)}
                  className="text-sm text-zinc-500 hover:text-zinc-700 transition"
                >
                  {isVersionHistoryOpen ? '收起' : '展开'}
                </button>
              </div>
              <p className="text-xs text-zinc-500">最新改动记录。</p>
              
              {isVersionHistoryOpen && (
                <div className="space-y-3 text-sm">
                  {CHANGELOG.map((entry) => (
                    <div
                      key={entry.version}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span className="font-semibold text-zinc-800">{entry.version}</span>
                        <span>{entry.date}</span>
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-zinc-800">
                        {entry.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* 编辑预览模态框 */}
        {showEditModal && editableData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-zinc-900">编辑内容并确认上传</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 可编辑表单 */}
                <div className="space-y-6">
                  {/* 标题 */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">标题</label>
                    <textarea
                      value={editableData.title}
                      onChange={(e) => setEditableData({...editableData, title: e.target.value})}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900"
                      rows={3}
                    />
                  </div>

                  {/* 作者 */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">作者</label>
                    <input
                      type="text"
                      value={editableData.author}
                      onChange={(e) => setEditableData({...editableData, author: e.target.value})}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900"
                    />
                  </div>

                  {/* 产品类型 */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">产品类型</label>
                    <input
                      type="text"
                      value={editableData.productType}
                      onChange={(e) => setEditableData({...editableData, productType: e.target.value})}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900"
                    />
                  </div>

                  {/* 图片选择 */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-zinc-700">选择图片</label>
                      <div className="flex gap-2">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={async (e) => {
                              const files = e.target.files
                              if (files && files.length > 0) {
                                await handleImageUpload(files, editableData.productType, editableData.title, setEditableData, editableData, useDeepSeek)
                              }
                            }}
                            className="hidden"
                            id="image-upload"
                          />
                          <label
                            htmlFor="image-upload"
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                          >
                            上传图片
                          </label>
                        </div>
                    </div>
                    {/* 拖拽上传区域 */}
                    <div
                      onDrop={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          await handleImageUpload(e.dataTransfer.files, editableData.productType, editableData.title, setEditableData, editableData, useDeepSeek)
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      className="border-2 border-dashed border-zinc-300 rounded-lg p-4 mb-3 transition-colors hover:border-blue-400 hover:bg-blue-50"
                    >
                      <div className="text-center">
                        <p className="text-sm text-zinc-500">拖拽图片到此处上传</p>
                        <p className="text-xs text-zinc-400 mt-1">或点击上方的"上传图片"按钮</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {editableData.images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image}
                            alt={`图片 ${index + 1}`}
                            className={`w-full h-32 object-cover rounded border-2 cursor-pointer transition-all ${
                              editableData.selectedImages[index] 
                                ? 'border-blue-500 ring-2 ring-blue-200' 
                                : 'border-zinc-200 hover:border-blue-300'
                            }`}
                            onClick={() => {
                              const newSelected = [...editableData.selectedImages]
                              newSelected[index] = !newSelected[index]
                              setEditableData({...editableData, selectedImages: newSelected})
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            <input
                              type="checkbox"
                              checked={editableData.selectedImages[index]}
                              onChange={() => {
                                const newSelected = [...editableData.selectedImages]
                                newSelected[index] = !newSelected[index]
                                setEditableData({...editableData, selectedImages: newSelected})
                              }}
                              className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                            />
                          </div>
                          <button
                            onClick={() => {
                              // 下载单张图片
                              const link = document.createElement('a')
                              link.href = image
                              link.download = `xiaohongshu_image_${index + 1}.jpg`
                              link.click()
                            }}
                            className="absolute bottom-2 right-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded p-1 text-xs text-blue-600"
                          >
                            下载
                          </button>
                          <button
                            onClick={() => {
                              // 删除图片
                              const newImages = editableData.images.filter((_, i) => i !== index)
                              const newSelected = editableData.selectedImages.filter((_, i) => i !== index)
                              setEditableData({
                                ...editableData,
                                images: newImages,
                                selectedImages: newSelected
                              })
                            }}
                            className="absolute top-2 left-2 bg-red-500 bg-opacity-80 hover:bg-opacity-100 rounded p-1 text-xs text-white"
                          >
                            删除
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      点击选择要上传的图片，已选择 {editableData.selectedImages.filter(Boolean).length} 张
                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-zinc-200">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    取消
                  </button>
                  <button
                    onClick={async () => {
                      // 执行上传操作
                      setStatus({ type: 'loading', message: '正在上传到飞书...' })
                      setShowEditModal(false)
                      
                      try {
                        // 获取选中的图片
                        const selectedImages = editableData.images.filter((_, index) => editableData.selectedImages[index])
                        
                        // 转换 blob URL 为 base64
                        async function convertBlobUrlToBase64(blobUrl: string): Promise<string> {
                          const response = await fetch(blobUrl);
                          const blob = await response.blob();
                          return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                          });
                        }
                        
                        // 处理选中的图片
                        const processedImages = await Promise.all(selectedImages.map(async (imageUrl) => {
                          if (imageUrl.startsWith('blob:')) {
                            return await convertBlobUrlToBase64(imageUrl);
                          }
                          return imageUrl;
                        }));
                        
                        // 构建上传数据
                        const uploadData = {
                          title: editableData.title,
                          author: editableData.author,
                          productType: editableData.productType,
                          images: processedImages,
                          xhsUrl: xhsUrl
                        }
                        
                        // 调用上传API
                        const response = await fetch('/api/collect', {  
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            ...uploadData, 
                            feishuTableUrl: feishuTableUrl.trim(),
                            appToken: appToken.trim(),
                            tableId: tableId.trim()
                          }),
                        })
                        
                        const result = await response.json()
                        
                        if (result.success) {
                          setStatus({ type: 'success', message: '成功上传到飞书多维表格！' })
                          pushHistory(xhsUrl, editableData.title)
                          // 清空数据
                          setPreviewData(null)
                          setEditableData(null)
                          setXhsUrl('')
                          setFeishuTableUrl('')
                        } else {
                          setStatus({ type: 'error', message: result.error || '上传失败' })
                        }
                      } catch (error) {
                        setStatus({ type: 'error', message: '上传失败，请重试' })
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    确认上传 ({editableData.selectedImages.filter(Boolean).length} 张图片)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
