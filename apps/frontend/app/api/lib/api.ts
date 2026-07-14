const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface UploadPayload {
  files: File[];
  userId?: string;
  format?: string;
  width?: string;
  height?: string;
  generateThumbnail?: boolean;
  targetResolutions?: string[]; // e.g., ['720p', '480p']
  extractThumbnail?: boolean;
}

export const uploadMedia = async (payload: UploadPayload) => {
  const formData = new FormData();
  
  // Attach all files into the array field
  payload.files.forEach(file => {
    formData.append('files', file);
  });

  if (payload.userId) formData.append('userId', payload.userId);
  
  // Image Specifics
  if (payload.format) formData.append('format', payload.format);
  if (payload.width) formData.append('width', payload.width);
  if (payload.height) formData.append('height', payload.height);
  if (payload.generateThumbnail !== undefined) {
    formData.append('generateThumbnail', String(payload.generateThumbnail));
  }

  // Video Specifics
  if (payload.targetResolutions && payload.targetResolutions.length > 0) {
    formData.append('targetResolutions', payload.targetResolutions.join(','));
  }
  if (payload.extractThumbnail !== undefined) {
    formData.append('extractThumbnail', String(payload.extractThumbnail));
  }

  const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
    method: 'POST',
    body: formData, // Browser automatically sets multipart/form-data headers
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Upload pipeline failure.');
  }

  return response.json();
};

export const getJobStatus = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/media/status/${id}`);
  if (!response.ok) throw new Error('Failed to resolve job status.');
  return response.json();
};

export const cancelJob = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/media/jobs/${id}/cancel`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Cancellation reject execution.');
  return response.json();
};

export const getUserMediaLibrary = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/media/user/${id}`);
  if (!response.ok)
  throw new Error('Failed to resolve job status.');
  return response.json();
};