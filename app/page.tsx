import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 640 }}>
      <h1 style={{ fontSize: '1.25rem' }}>Pocollector 后端</h1>
      <p style={{ color: '#444', marginTop: 12, lineHeight: 1.6 }}>
        若你能看到本页，说明 Next 已在本机正确运行。请把扩展里的「后端地址」设为当前地址的**站点根**（仅协议
        + 主机 + 端口，不要带 <code>/api</code>）。
      </p>
      <p style={{ color: '#444', marginTop: 12, lineHeight: 1.6 }}>
        采集接口（扩展用 POST）：{' '}
        <Link href="/api/collect">
          <code>/api/collect</code>
        </Link>
        （浏览器直接打开应为 JSON；旧路径 <code>/api/collect-v2</code> 会重写到此接口）
      </p>
      <p style={{ color: '#666', marginTop: 20, fontSize: 14, lineHeight: 1.6 }}>
        若控制台出现 Hydration 警告，多为<strong>其它浏览器扩展</strong>改动了页面 HTML（如{' '}
        <code>mpa-*</code> 属性）。可换无痕窗口、暂时关闭扩展，或忽略该提示（已在{' '}
        <code>layout</code> 中尽量抑制）。
      </p>
    </main>
  )
}
