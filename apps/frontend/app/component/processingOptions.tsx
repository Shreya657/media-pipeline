import React from 'react';

interface ProcessingOptionsProps {
  fileType: 'IMAGE' | 'VIDEO' | null;
  options: {
    format: string;
    width: string;
    height: string;
    generateThumbnail: boolean;
    targetResolutions: string[];
    extractThumbnail: boolean;
  };
  setOptions: React.Dispatch<React.SetStateAction<any>>;
}

export const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({
  fileType,
  options,
  setOptions,
}) => {
  if (!fileType) return null;

  const handleResolutionChange = (res: string) => {
    const current = options.targetResolutions;
    const updated = current.includes(res)
      ? current.filter((r) => r !== res)
      : [...current, res];
    setOptions({ ...options, targetResolutions: updated });
  };

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-6 shadow-xl">
      <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4">
        🎛️ Pipeline Processing Configurations
      </h3>

      {fileType === 'IMAGE' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Target Encoding Format</label>
            <select
              value={options.format}
              onChange={(e) => setOptions({ ...options, format: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="webp">Optimal WebP (Highly Recommended)</option>
              <option value="png">Lossless PNG</option>
              <option value="jpeg">Standard JPEG</option>
              <option value="avif">Next-Gen AVIF</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Max Width (px)</label>
              <input
                type="number"
                placeholder="Auto aspect ratio"
                value={options.width}
                onChange={(e) => setOptions({ ...options, width: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Max Height (px)</label>
              <input
                type="number"
                placeholder="Auto aspect ratio"
                value={options.height}
                onChange={(e) => setOptions({ ...options, height: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={options.generateThumbnail}
              onChange={(e) => setOptions({ ...options, generateThumbnail: e.target.checked })}
              className="rounded bg-zinc-950 border-zinc-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
            />
            <span className="text-sm text-zinc-300">Generate square dashboard thumbnail (300x300)</span>
          </label>
        </div>
      )}

      {fileType === 'VIDEO' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Target Downscaling Resolutions</label>
            <div className="flex gap-4">
              {['720p', '480p'].map((res) => (
                <label key={res} className="flex items-center gap-2 cursor-pointer bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 hover:border-zinc-700 transition">
                  <input
                    type="checkbox"
                    checked={options.targetResolutions.includes(res)}
                    onChange={() => handleResolutionChange(res)}
                    className="rounded bg-zinc-950 border-zinc-800 text-indigo-600 focus:ring-0 w-4 h-4"
                  />
                  <span>{res === '720p' ? '720p HD' : '480p SD'}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={options.extractThumbnail}
              onChange={(e) => setOptions({ ...options, extractThumbnail: e.target.checked })}
              className="rounded bg-zinc-950 border-zinc-800 text-indigo-600 focus:ring-0 w-4 h-4"
            />
            <span className="text-sm text-zinc-300">Extract video cover snapshot thumbnail</span>
          </label>
        </div>
      )}
    </div>
  );
};