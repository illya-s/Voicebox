import { create } from 'zustand';

export interface QueuedItem {
  queue_id: string;
  profile_id: string;
  text_preview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  enqueued_at?: string;
  error?: string;
  generation_id?: string;
}

interface GenerationState {
  isGenerating: boolean;
  activeGenerationId: string | null;
  queuedItems: QueuedItem[];
  setIsGenerating: (generating: boolean) => void;
  setActiveGenerationId: (id: string | null) => void;
  addQueuedItem: (item: QueuedItem) => void;
  updateQueuedItem: (queueId: string, updates: Partial<QueuedItem>) => void;
  removeQueuedItem: (queueId: string) => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  isGenerating: false,
  activeGenerationId: null,
  queuedItems: [],
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  setActiveGenerationId: (id) => set({ activeGenerationId: id }),
  addQueuedItem: (item) =>
    set((state) => ({ queuedItems: [...state.queuedItems, item] })),
  updateQueuedItem: (queueId, updates) =>
    set((state) => ({
      queuedItems: state.queuedItems.map((item) =>
        item.queue_id === queueId ? { ...item, ...updates } : item
      ),
    })),
  removeQueuedItem: (queueId) =>
    set((state) => ({
      queuedItems: state.queuedItems.filter((item) => item.queue_id !== queueId),
    })),
}));
