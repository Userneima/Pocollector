import Link from 'next/link'

export default function NotFound() {
  return (
    <main
      style={{
        padding: 24,
        maxWidth: 560,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.25rem' }}>404 — 没有对应页面</h1>
      <p style={{ color: '#444', lineHeight: 1.6, marginTop: 12 }}>
        若这是 <strong>Pocollector</strong> 后端，请确认：终端里显示的是本仓库启动的 Next（路径应包含本项目的{' '}
        <code>app</code> 目录）；并查看终端里 <code>Ready</code> 后的<strong>端口号</strong>（不一定是 3000）。
      </p>
      <ul style={{ marginTop: 16, lineHeight: 1.8 }}>
        <li>
          <Link href="/">返回首页</Link>
        </li>
        <li>
          在地址栏打开{' '}
          <a href="/api/collect">
            <code>/api/collect</code>
          </a>
          — 应出现 JSON（不是本页 404）
        </li>
      </ul>
    </main>
  )
}
