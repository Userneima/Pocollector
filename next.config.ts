import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // 兼容旧版扩展与文档中的路径，统一到 App Router 处理器
      { source: '/api/collect-v2', destination: '/api/collect' },
    ]
  },
}

export default nextConfig
