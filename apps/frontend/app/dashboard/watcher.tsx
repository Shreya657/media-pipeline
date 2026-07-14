'use client';

import React from 'react';
import { usePipelineNotifications } from '../hook/notification';

export const NotificationRegistryWatcher: React.FC = () => {
  // Instantiates the background tracking events thread seamlessly
  usePipelineNotifications();
  return null;
};