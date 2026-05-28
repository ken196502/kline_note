import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "无效的股票代码" }, { status: 400 });
  }

  // 根据代码首位判断市场：6开头为上证，其余为深证
  const prefix = code.startsWith("6") ? "sh" : "sz";
  const tencentCode = `${prefix}${code}`;

  const url = `https://qt.gtimg.cn/q=${tencentCode}`;

  const response = await fetch(url, {
    headers: {
      Referer: "https://gu.qq.com/",
      "User-Agent": "Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }

  // 腾讯接口返回 GBK 编码，需要用 GBK 解码
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("gbk");
  const text = decoder.decode(buffer);
  const eqIndex = text.indexOf("=");
  if (eqIndex === -1) {
    return NextResponse.json({ error: "未找到数据" }, { status: 404 });
  }

  const content = text.substring(eqIndex + 1).replace(/^"|"$/g, "");
  if (!content) {
    return NextResponse.json({ error: "未找到该股票" }, { status: 404 });
  }

  const fields = content.split("~");
  if (fields.length < 4) {
    return NextResponse.json({ error: "数据格式异常" }, { status: 500 });
  }

  const name = fields[1];
  if (!name) {
    return NextResponse.json({ error: "未找到该股票" }, { status: 404 });
  }

  return NextResponse.json({ code, name });
}