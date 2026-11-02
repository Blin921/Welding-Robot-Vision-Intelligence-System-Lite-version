import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { AcquisitionDemoApi } from '../acquisition/api';
import { parseView } from '../blob';
import { DEFAULT_PROGRAM, DEFAULT_FTP } from '../types';

describe('isolated presentation workflow', () => {
  it('uploads the paired PCD, generates its trajectory and simulates transfer without network', async () => {
    const bytes = readFileSync(new URL('../../../../deliverables/demo_workpiece.pcd', import.meta.url));
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'));
    try {
      const api = new AcquisitionDemoApi();
      await api.upload('sample', new Blob([bytes]));
      expect((await api.frames()).frames.some(f => f.id === 'sample')).toBe(true);
      expect(parseView(await api.view('sample')).header.n).toBe(50467);
      const seams = await api.seams('sample');
      expect(seams.seams).toHaveLength(2);
      const program = await api.program({...DEFAULT_PROGRAM, frame:'sample', seam_id:1});
      expect(program.waypoints_cam_mm[0]).toEqual([-180,-35,650]);
      expect(program.wpr_list).toHaveLength(program.waypoints_cam_mm.length);
      expect((await api.push({...DEFAULT_FTP, host:'controller.demo', frame:'sample', seam_id:1})).bytes).toBeGreaterThan(0);
      expect(fetcher).not.toHaveBeenCalled();
    } finally { fetcher.mockRestore(); }
  });
  it('never attaches fixture seams to an unrelated uploaded cloud', async () => {
    const api = new AcquisitionDemoApi();
    const file = new Blob(['VERSION .7\nFIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH 1\nHEIGHT 1\nPOINTS 1\nDATA ascii\n1 2 3\n']);
    await api.upload('other', file);
    expect((await api.seams('other')).seams).toEqual([]);
    await expect(api.program({...DEFAULT_PROGRAM, frame:'other', seam_id:1})).rejects.toThrow();
  });
});
