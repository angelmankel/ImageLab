/**
 * ComfyUI's `/system_stats` device name ("cuda:0 NVIDIA B200 : cudaMallocAsync") → the status
 * pill's short label ("B200"). Pure, tested.
 */
export function gpuLabel(name: string | undefined | null): string {
  if (!name) return '';
  let n = name.replace(/^(cuda|mps|cpu|xpu)(:\d+)?\s*/i, '').split(' : ')[0].trim();
  n = n.replace(/^NVIDIA\s+/i, '').replace(/^GeForce\s+/i, '').replace(/\s+(PCIe|SXM\d?|NVL|\d+GB)(\s|$)/gi, ' ').trim();
  return n;
}
