import { NextResponse } from 'next/server';
import { appendFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const { email, project, score } = await request.json();
    if (!email) return NextResponse.json({ ok: false }, { status: 400 });

    const line = `${new Date().toISOString()} | ${email} | ${project || 'unknown'} | score:${score ?? '?'}\n`;
    const dir = path.join(process.cwd(), 'data');
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, 'leads.txt'), line);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // silent fail
  }
}
