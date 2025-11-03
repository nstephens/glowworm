"""
WebSocket endpoints for real-time updates
"""
import json
import logging
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.regeneration_progress_service import regeneration_progress_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["websocket"])

@router.websocket("/regeneration-progress/{task_id}")
async def websocket_regeneration_progress(websocket: WebSocket, task_id: str):
    """WebSocket endpoint for real-time regeneration progress updates"""
    await websocket.accept()
    
    try:
        # Register websocket for this task
        regeneration_progress_service.register_websocket(task_id, websocket)
        
        # Send initial progress if available
        progress = regeneration_progress_service.get_progress(task_id)
        last_snapshot = None
        if progress:
            last_snapshot = json.dumps({
                "type": "regeneration_progress",
                "data": progress.to_dict()
            })
            await websocket.send_text(last_snapshot)

        # Poll-and-push loop: periodically read progress from the service and
        # push updates to the client. This works even when background work runs
        # in a thread (no event loop) and cannot broadcast directly.
        while True:
            try:
                await asyncio.sleep(1)

                progress = regeneration_progress_service.get_progress(task_id)
                if not progress:
                    continue

                snapshot = json.dumps({
                    "type": "regeneration_progress",
                    "data": progress.to_dict()
                })

                # Only send when the snapshot changes
                if snapshot != last_snapshot:
                    await websocket.send_text(snapshot)
                    last_snapshot = snapshot

                # Optional: if task completed/failed, keep socket alive for a bit
                # and then exit. For now, we keep it open until client closes.

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for task {task_id}")
                break
            except Exception as e:
                logger.error(f"WebSocket error for task {task_id}: {e}")
                break
                
    except Exception as e:
        logger.error(f"WebSocket connection error for task {task_id}: {e}")
    finally:
        # Clean up websocket registration
        regeneration_progress_service.unregister_websocket(task_id)
