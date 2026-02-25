"use strict";
// 小红书网页爬取方案（备用方案）
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchXhsScraperData = fetchXhsScraperData;
// 提取小红书笔记ID
function extractNoteId(noteUrl) {
    try {
        const url = new URL(noteUrl);
        // 从查询参数获取
        const noteIdFromQuery = url.searchParams.get('noteId');
        if (noteIdFromQuery) {
            return noteIdFromQuery;
        }
        // 从路径获取
        const pathMatch = url.pathname.match(/\/(?:explore|discovery\/item|item|note)\/([a-zA-Z0-9]+)/);
        if (pathMatch?.[1]) {
            return pathMatch[1];
        }
        // 通用提取
        const genericMatch = url.pathname.match(/\/([a-zA-Z0-9]{10,})/);
        return genericMatch?.[1] ?? '';
    }
    catch {
        return '';
    }
}
// 从 HTML 中提取图片 URL
function extractImagesFromHtml(html) {
    const images = [];
    // 方法1: 从 window.__INITIAL_STATE__ 中提取
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/);
    if (stateMatch?.[1]) {
        try {
            const state = JSON.parse(stateMatch[1]);
            // 尝试从 state 中提取图片信息
            const imageUrls = extractImagesFromState(state);
            if (imageUrls.length > 0) {
                return imageUrls;
            }
        }
        catch (e) {
            console.warn('解析 state 失败:', e);
        }
    }
    // 方法2: 从 meta 标签中提取
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    if (ogImageMatch?.[1]) {
        images.push(ogImageMatch[1]);
    }
    // 方法3: 从图片标签中提取
    const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi);
    for (const match of imgMatches) {
        if (match[1] && match[1].includes('xiaohongshu')) {
            images.push(match[1]);
        }
    }
    return [...new Set(images)]; // 去重
}
// 从 state 中提取图片
function extractImagesFromState(state) {
    const images = [];
    try {
        // 尝试不同的路径结构
        const possiblePaths = [
            'note.note.imageList',
            'note.imageList',
            'note.note.images',
            'note.images',
            'imageList',
            'images'
        ];
        for (const path of possiblePaths) {
            const imageList = path.split('.').reduce((obj, key) => obj?.[key], state);
            if (Array.isArray(imageList) && imageList.length > 0) {
                for (const img of imageList) {
                    if (typeof img === 'string') {
                        images.push(img);
                    }
                    else if (img?.url) {
                        images.push(img.url);
                    }
                    else if (img?.url_default) {
                        images.push(img.url_default);
                    }
                }
                if (images.length > 0)
                    break;
            }
        }
    }
    catch (e) {
        console.warn('从 state 提取图片失败:', e);
    }
    return images;
}
// 提取标题
function extractTitle(html) {
    // 方法1: 从 title 标签
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch?.[1]) {
        return titleMatch[1].trim();
    }
    // 方法2: 从 meta 标签
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    if (ogTitleMatch?.[1]) {
        return ogTitleMatch[1].trim();
    }
    // 方法3: 从 state 中提取
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/);
    if (stateMatch?.[1]) {
        try {
            const state = JSON.parse(stateMatch[1]);
            const title = extractTitleFromState(state);
            if (title)
                return title;
        }
        catch (e) {
            console.warn('从 state 提取标题失败:', e);
        }
    }
    return '';
}
// 从 state 中提取标题
function extractTitleFromState(state) {
    const possiblePaths = [
        'note.note.title',
        'note.title',
        'title'
    ];
    for (const path of possiblePaths) {
        const title = path.split('.').reduce((obj, key) => obj?.[key], state);
        if (title && typeof title === 'string') {
            return title.trim();
        }
    }
    return '';
}
// 提取作者
function extractAuthor(html) {
    // 方法1: 从 state 中提取
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/);
    if (stateMatch?.[1]) {
        try {
            const state = JSON.parse(stateMatch[1]);
            const author = extractAuthorFromState(state);
            if (author)
                return author;
        }
        catch (e) {
            console.warn('从 state 提取作者失败:', e);
        }
    }
    return '';
}
// 从 state 中提取作者
function extractAuthorFromState(state) {
    const possiblePaths = [
        'note.note.user.nickname',
        'note.user.nickname',
        'user.nickname',
        'note.note.user.name',
        'note.user.name',
        'user.name'
    ];
    for (const path of possiblePaths) {
        const author = path.split('.').reduce((obj, key) => obj?.[key], state);
        if (author && typeof author === 'string') {
            return author.trim();
        }
    }
    return '';
}
// 获取网页内容
async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        }
    });
    if (!response.ok) {
        throw new Error(`获取网页失败: ${response.status}`);
    }
    return response.text();
}
// 主要函数：爬取小红书数据
async function fetchXhsScraperData(noteUrl) {
    console.log('使用网页爬取方案获取小红书数据:', noteUrl);
    try {
        const noteId = extractNoteId(noteUrl);
        if (!noteId) {
            return { ok: false, error: '未能从链接中提取 noteId' };
        }
        console.log('提取的 noteId:', noteId);
        console.log('获取网页内容...');
        const html = await fetchHtml(noteUrl);
        console.log('网页内容获取成功，大小:', html.length, '字符');
        console.log('提取图片信息...');
        const images = extractImagesFromHtml(html);
        console.log('提取到图片数量:', images.length);
        console.log('提取标题...');
        const title = extractTitle(html);
        console.log('提取到标题:', title);
        console.log('提取作者...');
        const author = extractAuthor(html);
        console.log('提取到作者:', author);
        if (images.length === 0 && !title && !author) {
            return {
                ok: false,
                error: '未能从网页中提取到有效数据，可能需要登录或页面结构已变更'
            };
        }
        const cover_url = images[0] ?? '';
        const now = new Date().toISOString();
        return {
            ok: true,
            data: {
                title: title || `小红书笔记_${noteId.slice(0, 8)}`,
                author: author || '未知作者',
                cover_url,
                images,
                date: now
            }
        };
    }
    catch (error) {
        console.error('网页爬取失败:', error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : '爬取失败',
            details: error
        };
    }
}
