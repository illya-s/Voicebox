"""
Task tracking for active downloads and generations.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class DownloadTask:
    """Represents an active download task."""
    model_name: str
    status: str = "downloading"  # downloading, extracting, complete, error
    started_at: datetime = field(default_factory=datetime.utcnow)
    error: Optional[str] = None


@dataclass
class GenerationTask:
    """Represents an active generation task."""
    task_id: str
    profile_id: str
    text_preview: str  # First 50 chars of text
    started_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class QueueEntry:
    """Represents a queued generation job."""
    queue_id: str
    profile_id: str
    text_preview: str
    status: str = "pending"  # pending, processing, done, error
    generation_id: Optional[str] = None
    error: Optional[str] = None
    enqueued_at: datetime = field(default_factory=datetime.utcnow)


class TaskManager:
    """Manages active downloads and generations."""
    
    def __init__(self):
        self._active_downloads: Dict[str, DownloadTask] = {}
        self._active_generations: Dict[str, GenerationTask] = {}
        self._queue_entries: Dict[str, QueueEntry] = {}
        # asyncio.Queue is created lazily inside the event loop
        self._generation_queue: Optional[asyncio.Queue] = None

    def get_queue(self) -> asyncio.Queue:
        """Get (or lazily create) the asyncio generation queue."""
        if self._generation_queue is None:
            self._generation_queue = asyncio.Queue()
        return self._generation_queue
    
    def start_download(self, model_name: str) -> None:
        """Mark a download as started."""
        self._active_downloads[model_name] = DownloadTask(
            model_name=model_name,
            status="downloading",
        )
    
    def complete_download(self, model_name: str) -> None:
        """Mark a download as complete."""
        if model_name in self._active_downloads:
            del self._active_downloads[model_name]
    
    def error_download(self, model_name: str, error: str) -> None:
        """Mark a download as failed."""
        if model_name in self._active_downloads:
            self._active_downloads[model_name].status = "error"
            self._active_downloads[model_name].error = error
    
    def start_generation(self, task_id: str, profile_id: str, text: str) -> None:
        """Mark a generation as started."""
        text_preview = text[:50] + "..." if len(text) > 50 else text
        self._active_generations[task_id] = GenerationTask(
            task_id=task_id,
            profile_id=profile_id,
            text_preview=text_preview,
        )
    
    def complete_generation(self, task_id: str) -> None:
        """Mark a generation as complete."""
        if task_id in self._active_generations:
            del self._active_generations[task_id]
    
    def get_active_downloads(self) -> List[DownloadTask]:
        """Get all active downloads."""
        return list(self._active_downloads.values())
    
    def get_active_generations(self) -> List[GenerationTask]:
        """Get all active generations."""
        return list(self._active_generations.values())
    
    def is_download_active(self, model_name: str) -> bool:
        """Check if a download is active."""
        return model_name in self._active_downloads
    
    def is_generation_active(self, task_id: str) -> bool:
        """Check if a generation is active."""
        return task_id in self._active_generations

    # --- Queue entry management ---

    def add_queue_entry(self, queue_id: str, profile_id: str, text: str) -> QueueEntry:
        """Register a new queued generation."""
        preview = text[:50] + "..." if len(text) > 50 else text
        entry = QueueEntry(
            queue_id=queue_id,
            profile_id=profile_id,
            text_preview=preview,
        )
        self._queue_entries[queue_id] = entry
        return entry

    def set_queue_processing(self, queue_id: str) -> None:
        """Mark a queue entry as currently being processed."""
        if queue_id in self._queue_entries:
            self._queue_entries[queue_id].status = "processing"

    def set_queue_done(self, queue_id: str, generation_id: str) -> None:
        """Mark a queue entry as successfully completed."""
        if queue_id in self._queue_entries:
            self._queue_entries[queue_id].status = "done"
            self._queue_entries[queue_id].generation_id = generation_id

    def set_queue_error(self, queue_id: str, error: str) -> None:
        """Mark a queue entry as failed."""
        if queue_id in self._queue_entries:
            self._queue_entries[queue_id].status = "error"
            self._queue_entries[queue_id].error = error

    def get_queue_entry(self, queue_id: str) -> Optional[QueueEntry]:
        """Return a queue entry by ID, or None."""
        return self._queue_entries.get(queue_id)

    def get_pending_queue_entries(self) -> List[QueueEntry]:
        """Return all entries that are pending or processing."""
        return [
            e for e in self._queue_entries.values()
            if e.status in ("pending", "processing")
        ]


# Global task manager instance
_task_manager: Optional[TaskManager] = None


def get_task_manager() -> TaskManager:
    """Get or create the global task manager."""
    global _task_manager
    if _task_manager is None:
        _task_manager = TaskManager()
    return _task_manager
