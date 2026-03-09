import { readFile } from 'fs/promises';
import path from 'path';
import { notFound } from 'next/navigation';
import ReportClient from './ReportClient';

export default async function ReportPage({ params }) {
  const { id } = await params;

  // Sanitize ID to prevent path traversal
  if (!/^[a-f0-9]{8}$/.test(id)) return notFound();

  try {
    const filePath = path.join(process.cwd(), 'data', 'reports', `${id}.json`);
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return <ReportClient data={data} />;
  } catch {
    return notFound();
  }
}
