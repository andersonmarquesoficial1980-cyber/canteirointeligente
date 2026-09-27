export function isScheduledExport(request: Request, expected: string): boolean {
  const supplied = request.headers.get('x-workflux-export-secret') || '';
  if (!expected || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
