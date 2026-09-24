import { onRequest } from '@cloudflare/pages-functions';
import { getAuthContextWithRateLimit } from '../../lib/auth/middleware';
import { parseFile } from '../../lib/parser';
import { analyzeFile } from '../../lib/engine';
import { incrementScanCounter } from '../../lib/auth';

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;
  
  try {
    const { context: authContext, rateLimited } = await getAuthContextWithRateLimit(request, env);
    
    if (!authContext.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }
    
    const canScanResult = await canScan(env.spreadsheet_health_checker, authContext.user.id, authContext.subscription || null);
    if (!canScanResult) {
      return new Response(JSON.stringify({ error: 'Scan limit exceeded. Upgrade for unlimited scans.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const contentType = request.headers.get('Content-Type');
    let file: File | null = null;
    
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      file = formData.get('file') as File | null;
    } else if (contentType?.includes('application/octet-stream') || contentType?.includes('text/csv') || contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      const arrayBuffer = await request.arrayBuffer();
      const filename = request.headers.get('X-Filename') || 'upload.csv';
      file = new File([arrayBuffer], filename, { type: contentType || 'application/octet-stream' });
    }
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided. Use multipart/form-data with "file" field or send raw binary with X-Filename header.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const maxSize = authContext.limits.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: `File exceeds ${authContext.limits.maxFileSizeMB}MB limit` }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const parsed = await parseFile(file);
    const report = await analyzeFile(parsed);
    
    await incrementScanCounter(env.spreadsheet_health_checker, authContext.user.id);
    
    return new Response(JSON.stringify({
      success: true,
      fileName: report.fileName,
      score: report.score,
      summary: report.summary,
      findings: report.findings.map(f => ({
        id: f.id,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        sheet: f.sheet,
        location: f.location,
        affectedCells: f.affectedCells,
        suggestion: f.suggestion,
      })),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API scan error:', error);
    return new Response(JSON.stringify({ error: 'Scan failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};