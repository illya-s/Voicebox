import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import type { GenerationRequest } from '@/lib/api/types';
import { useGenerationStore } from '@/stores/generationStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export function useGenerationQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addQueuedItem = useGenerationStore((state) => state.addQueuedItem);
  const updateQueuedItem = useGenerationStore((state) => state.updateQueuedItem);
  const removeQueuedItem = useGenerationStore((state) => state.removeQueuedItem);
  const setAudioWithAutoPlay = usePlayerStore((state) => state.setAudioWithAutoPlay);

  const pollQueueStatus = useCallback(
    async (queueId: string, profileId: string, text: string) => {
      const pollInterval = 2000;
      let attempts = 0;
      const maxAttempts = 300; // 10 minutes

      const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          updateQueuedItem(queueId, { status: 'error', error: 'Generation timed out' });
          toast({
            title: 'Generation timed out',
            description: 'The generation took too long to complete.',
            variant: 'destructive',
          });
          return;
        }

        try {
          const entry = await apiClient.getQueueEntry(queueId);
          
          if (entry.status === 'processing') {
            updateQueuedItem(queueId, { status: 'processing' });
          } else if (entry.status === 'done' && entry.generation_id) {
            clearInterval(interval);
            updateQueuedItem(queueId, { 
              status: 'done', 
              generation_id: entry.generation_id 
            });

            // Refresh history
            queryClient.invalidateQueries({ queryKey: ['history'] });
            
            toast({
              title: 'Generation complete!',
              description: 'Your audio is ready.',
            });

            // Play the result
            const audioUrl = apiClient.getAudioUrl(entry.generation_id);
            setAudioWithAutoPlay(audioUrl, entry.generation_id, profileId, text.substring(0, 50));
            
            // Remove from queue after a short delay so UI can show completion
            setTimeout(() => removeQueuedItem(queueId), 5000);
          } else if (entry.status === 'error') {
            clearInterval(interval);
            updateQueuedItem(queueId, { status: 'error', error: entry.error });
            toast({
              title: 'Generation failed',
              description: entry.error || 'Check the server logs for details.',
              variant: 'destructive',
            });
          }
        } catch (error) {
          console.error('Failed to poll queue status:', error);
          // Don't clear interval on network error, server might be restarting
        }
      }, pollInterval);
    },
    [updateQueuedItem, removeQueuedItem, queryClient, toast, setAudioWithAutoPlay]
  );

  const enqueue = useCallback(
    async (data: GenerationRequest) => {
      try {
        const response = await apiClient.enqueueGeneration(data);
        
        addQueuedItem({
          queue_id: response.queue_id,
          profile_id: data.profile_id,
          text_preview: data.text.substring(0, 50),
          status: 'pending',
          enqueued_at: new Date().toISOString(),
        });

        // Start polling
        pollQueueStatus(response.queue_id, data.profile_id, data.text);
        
        return response.queue_id;
      } catch (error) {
        toast({
          title: 'Failed to enqueue generation',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [addQueuedItem, pollQueueStatus, toast]
  );

  return { enqueue };
}
