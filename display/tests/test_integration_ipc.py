"""
Integration tests for IPC-based image loading and control.

Tests the complete flow of loading images, queuing, and state management
via the IPC server interface.
"""

import asyncio
from pathlib import Path

import pytest

from glowworm_display.renderer import RendererState

from .conftest import IPCTestClient


class TestIPCImageLoading:
    """Integration tests for image loading via IPC."""

    @pytest.mark.asyncio
    async def test_queue_single_image(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test queuing a single image via IPC."""
        async with ipc_client:
            # Queue an image
            response = await ipc_client.send_request(
                "queue_image",
                {"path": str(test_images["red"])},
            )

            assert response.get("result", {}).get("success") is True
            assert response.get("result", {}).get("queue_position") == 1

            # Verify queue length via status
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("queue_length") == 1

    @pytest.mark.asyncio
    async def test_queue_multiple_images(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test queuing multiple images via IPC."""
        async with ipc_client:
            # Queue multiple images
            for img_name in ["red", "green", "blue"]:
                response = await ipc_client.send_request(
                    "queue_image",
                    {"path": str(test_images[img_name])},
                )
                assert response.get("result", {}).get("success") is True

            # Verify queue length
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("queue_length") == 3

    @pytest.mark.asyncio
    async def test_load_image_immediate(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test loading an image immediately via IPC."""
        async with ipc_client:
            # Load image immediately
            response = await ipc_client.send_request(
                "load_image",
                {
                    "path": str(test_images["red"]),
                    "transition_duration": 0.05,
                },
            )

            assert response.get("result", {}).get("success") is True

            # Run renderer to process the transition
            for _ in range(20):
                mock_renderer.run_once()
                await asyncio.sleep(0.01)

            # Verify state transitioned
            status = await ipc_client.send_request("get_status")
            result = status.get("result", {})
            # State should be transitioning or displaying
            assert result.get("state") in ["transitioning", "displaying"]

    @pytest.mark.asyncio
    async def test_load_image_clears_queue(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test that load_image_immediate clears the queue."""
        async with ipc_client:
            # Queue multiple images
            for img_name in ["red", "green", "blue"]:
                await ipc_client.send_request(
                    "queue_image",
                    {"path": str(test_images[img_name])},
                )

            # Verify queue has images
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("queue_length") == 3

            # Load immediately (should clear queue)
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["portrait"])},
            )

            # Verify queue is cleared
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("queue_length") == 0

    @pytest.mark.asyncio
    async def test_image_sequence_via_ipc(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test loading a sequence of images via IPC and displaying them."""
        async with ipc_client:
            # Queue all test images with fast transitions
            for img_name in ["red", "green", "blue"]:
                await ipc_client.send_request(
                    "queue_image",
                    {
                        "path": str(test_images[img_name]),
                        "transition_duration": 0.02,
                    },
                )

            # Process all images through renderer
            images_displayed = 0
            max_iterations = 500
            iterations = 0

            while iterations < max_iterations:
                if not mock_renderer.run_once():
                    break
                iterations += 1
                await asyncio.sleep(0.001)

                # Check if images have been displayed
                status = await ipc_client.send_request("get_status")
                displayed = status.get("result", {}).get("stats", {}).get("images_displayed", 0)
                if displayed > images_displayed:
                    images_displayed = displayed

                # Stop when all images displayed and queue empty
                queue_len = status.get("result", {}).get("queue_length", 0)
                if images_displayed >= 3 and queue_len == 0:
                    break

            # Verify all images were displayed
            status = await ipc_client.send_request("get_status")
            stats = status.get("result", {}).get("stats", {})
            assert stats.get("images_displayed") >= 3
            assert stats.get("transition_count") >= 3

    @pytest.mark.asyncio
    async def test_invalid_image_path(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
    ):
        """Test handling of invalid image path."""
        async with ipc_client:
            response = await ipc_client.send_request(
                "load_image",
                {"path": "/nonexistent/image.jpg"},
            )

            assert response.get("result", {}).get("success") is False

    @pytest.mark.asyncio
    async def test_scale_mode_parameter(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test passing different scale modes via IPC."""
        async with ipc_client:
            for mode in ["fit", "fill", "stretch"]:
                response = await ipc_client.send_request(
                    "queue_image",
                    {
                        "path": str(test_images["red"]),
                        "scale_mode": mode,
                    },
                )
                assert response.get("result", {}).get("success") is True

    @pytest.mark.asyncio
    async def test_invalid_scale_mode(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test handling of invalid scale mode."""
        async with ipc_client:
            response = await ipc_client.send_request(
                "load_image",
                {
                    "path": str(test_images["red"]),
                    "scale_mode": "invalid_mode",
                },
            )

            assert response.get("result", {}).get("success") is False
            assert "invalid" in response.get("result", {}).get("error", "").lower()


class TestIPCPauseResume:
    """Integration tests for pause/resume functionality via IPC."""

    @pytest.mark.asyncio
    async def test_pause_renderer(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test pausing the renderer via IPC."""
        async with ipc_client:
            # Load an image first
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["red"]), "transition_duration": 0.02},
            )

            # Run a few frames
            for _ in range(10):
                mock_renderer.run_once()

            # Pause
            response = await ipc_client.send_request("pause")
            assert response.get("result", {}).get("success") is True
            assert response.get("result", {}).get("state") == "paused"

            # Verify status shows paused
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("is_paused") is True
            assert status.get("result", {}).get("state") == "paused"

    @pytest.mark.asyncio
    async def test_resume_renderer(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test resuming the renderer via IPC."""
        async with ipc_client:
            # Load an image and run transition
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["red"]), "transition_duration": 0.5},
            )

            # Run a few frames, then pause during transition
            for _ in range(5):
                mock_renderer.run_once()

            await ipc_client.send_request("pause")

            # Verify paused
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("is_paused") is True

            # Resume
            response = await ipc_client.send_request("resume")
            assert response.get("result", {}).get("success") is True
            assert response.get("result", {}).get("state") != "paused"

            # Verify no longer paused
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("is_paused") is False

    @pytest.mark.asyncio
    async def test_pause_during_transition(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test pausing during a transition and then resuming."""
        async with ipc_client:
            # Load first image and complete transition
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["red"]), "transition_duration": 0.05},
            )

            # Complete first transition
            for _ in range(100):
                mock_renderer.run_once()
                await asyncio.sleep(0.001)

            # Queue second image with longer transition
            await ipc_client.send_request(
                "queue_image",
                {"path": str(test_images["green"]), "transition_duration": 1.0},
            )

            # Run a few frames to start transition
            for _ in range(5):
                mock_renderer.run_once()

            # Get state before pause
            status = await ipc_client.send_request("get_status")
            pre_pause_transitions = status.get("result", {}).get("stats", {}).get("transition_count", 0)

            # Pause
            await ipc_client.send_request("pause")
            assert mock_renderer.state == RendererState.PAUSED

            # Run a few frames while paused
            for _ in range(10):
                mock_renderer.run_once()
                await asyncio.sleep(0.01)

            # Verify still paused, transitions not advancing
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("is_paused") is True

            # Resume
            await ipc_client.send_request("resume")

            # Run to complete transition
            for _ in range(200):
                mock_renderer.run_once()
                await asyncio.sleep(0.01)

            # Verify transition completed after resume
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("is_paused") is False

    @pytest.mark.asyncio
    async def test_queue_not_processed_while_paused(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test that the queue is not processed while paused."""
        async with ipc_client:
            # Load initial image and complete transition
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["red"]), "transition_duration": 0.02},
            )

            for _ in range(100):
                mock_renderer.run_once()
                await asyncio.sleep(0.001)

            # Pause
            await ipc_client.send_request("pause")

            # Queue images while paused
            for img_name in ["green", "blue"]:
                await ipc_client.send_request(
                    "queue_image",
                    {"path": str(test_images[img_name])},
                )

            # Run frames while paused
            initial_displayed = mock_renderer.stats.images_displayed
            for _ in range(50):
                mock_renderer.run_once()

            # Verify no new images displayed
            assert mock_renderer.stats.images_displayed == initial_displayed

            # Verify queue still has images
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("queue_length") == 2

            # Resume and verify queue starts processing
            await ipc_client.send_request("resume")

            for _ in range(200):
                mock_renderer.run_once()
                await asyncio.sleep(0.005)

            # Queue should be processing now
            status = await ipc_client.send_request("get_status")
            # Either queue is smaller or images have been displayed
            assert (
                status.get("result", {}).get("queue_length") < 2
                or status.get("result", {}).get("stats", {}).get("images_displayed") > initial_displayed
            )


class TestIPCClear:
    """Integration tests for clear functionality via IPC."""

    @pytest.mark.asyncio
    async def test_clear_display(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test clearing the display via IPC."""
        async with ipc_client:
            # Load an image
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["red"]), "transition_duration": 0.02},
            )

            # Complete transition
            for _ in range(100):
                mock_renderer.run_once()
                await asyncio.sleep(0.001)

            # Verify displaying
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("state") == "displaying"

            # Clear
            response = await ipc_client.send_request("clear")
            assert response.get("result", {}).get("success") is True

            # Verify cleared (idle state)
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("state") == "idle"
            assert status.get("result", {}).get("queue_length") == 0

    @pytest.mark.asyncio
    async def test_clear_during_transition(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test clearing during a transition."""
        async with ipc_client:
            # Start a long transition
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["red"]), "transition_duration": 2.0},
            )

            # Run a few frames
            for _ in range(5):
                mock_renderer.run_once()

            # Should be transitioning
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("state") == "transitioning"

            # Clear
            await ipc_client.send_request("clear")

            # Should be idle
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("state") == "idle"


class TestIPCRegistration:
    """Integration tests for registration display via IPC."""

    @pytest.mark.asyncio
    async def test_show_registration(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
    ):
        """Test showing registration code via IPC."""
        async with ipc_client:
            response = await ipc_client.send_request(
                "show_registration",
                {"code": "ABCD"},
            )

            assert response.get("result", {}).get("success") is True
            assert response.get("result", {}).get("code") == "ABCD"
            assert response.get("result", {}).get("state") == "registration"

            # Verify status
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("is_registration") is True
            assert status.get("result", {}).get("registration_code") == "ABCD"

    @pytest.mark.asyncio
    async def test_hide_registration(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
    ):
        """Test hiding registration display via IPC."""
        async with ipc_client:
            # Show registration first
            await ipc_client.send_request("show_registration", {"code": "ABCD"})

            # Hide it
            response = await ipc_client.send_request("hide_registration")
            assert response.get("result", {}).get("success") is True
            assert response.get("result", {}).get("state") == "idle"

            # Verify status
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("is_registration") is False
            assert status.get("result", {}).get("state") == "idle"

    @pytest.mark.asyncio
    async def test_registration_clears_images(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test that showing registration clears current images."""
        async with ipc_client:
            # Load and display an image
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["red"]), "transition_duration": 0.02},
            )

            for _ in range(100):
                mock_renderer.run_once()
                await asyncio.sleep(0.001)

            # Queue more images
            await ipc_client.send_request(
                "queue_image",
                {"path": str(test_images["green"])},
            )

            # Verify queue has image
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("queue_length") == 1

            # Show registration
            await ipc_client.send_request("show_registration", {"code": "TEST"})

            # Verify queue is cleared
            status = await ipc_client.send_request("get_status")
            assert status.get("result", {}).get("queue_length") == 0
            assert status.get("result", {}).get("state") == "registration"


class TestIPCStatus:
    """Integration tests for status reporting via IPC."""

    @pytest.mark.asyncio
    async def test_get_status_idle(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
    ):
        """Test getting status when idle."""
        async with ipc_client:
            status = await ipc_client.send_request("get_status")
            result = status.get("result", {})

            assert result.get("state") == "idle"
            assert result.get("is_running") is False
            assert result.get("is_paused") is False
            assert result.get("queue_length") == 0
            assert "stats" in result

    @pytest.mark.asyncio
    async def test_get_status_displaying(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test getting status when displaying an image."""
        async with ipc_client:
            # Load and display image
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["red"]), "transition_duration": 0.02},
            )

            for _ in range(100):
                mock_renderer.run_once()
                await asyncio.sleep(0.001)

            status = await ipc_client.send_request("get_status")
            result = status.get("result", {})

            assert result.get("state") == "displaying"
            assert result.get("stats", {}).get("images_displayed") >= 1

    @pytest.mark.asyncio
    async def test_status_includes_stats(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
        mock_renderer,
        test_images: dict[str, Path],
    ):
        """Test that status includes rendering statistics."""
        async with ipc_client:
            # Load an image and run some frames
            await ipc_client.send_request(
                "load_image",
                {"path": str(test_images["red"]), "transition_duration": 0.02},
            )

            for _ in range(100):
                mock_renderer.run_once()
                await asyncio.sleep(0.001)

            status = await ipc_client.send_request("get_status")
            stats = status.get("result", {}).get("stats", {})

            assert "frame_count" in stats
            assert "avg_fps" in stats
            assert "images_displayed" in stats
            assert "transition_count" in stats
            assert stats.get("frame_count") > 0


class TestIPCConnectionHandling:
    """Integration tests for IPC connection handling."""

    @pytest.mark.asyncio
    async def test_multiple_clients(
        self,
        ipc_server,
        ipc_socket_path: str,
        mock_renderer,
    ):
        """Test that multiple clients can connect simultaneously."""
        client1 = IPCTestClient(ipc_socket_path)
        client2 = IPCTestClient(ipc_socket_path)

        async with client1, client2:
            # Both clients should be able to get status
            status1 = await client1.send_request("get_status")
            status2 = await client2.send_request("get_status")

            assert status1.get("result", {}).get("state") == "idle"
            assert status2.get("result", {}).get("state") == "idle"

            # Verify server tracks both clients
            assert ipc_server.client_count == 2

    @pytest.mark.asyncio
    async def test_client_disconnect_handled(
        self,
        ipc_server,
        ipc_socket_path: str,
        mock_renderer,
    ):
        """Test that client disconnection is handled gracefully."""
        client = IPCTestClient(ipc_socket_path)

        async with client:
            # Make a request
            await client.send_request("get_status")
            assert ipc_server.client_count == 1

        # After context exit, client should be disconnected
        # Give server time to detect disconnect
        await asyncio.sleep(0.1)
        assert ipc_server.client_count == 0

    @pytest.mark.asyncio
    async def test_invalid_json_handled(
        self,
        ipc_server,
        ipc_socket_path: str,
    ):
        """Test that invalid JSON is handled gracefully."""
        reader, writer = await asyncio.open_unix_connection(ipc_socket_path)

        try:
            # Send invalid JSON
            writer.write(b"not valid json\n")
            await writer.drain()

            # Should get error response
            response = await asyncio.wait_for(reader.readline(), timeout=5.0)
            import json
            data = json.loads(response.decode("utf-8"))

            assert "error" in data
            assert data["error"]["code"] == -32700  # Parse error
        finally:
            writer.close()
            await writer.wait_closed()

    @pytest.mark.asyncio
    async def test_unknown_method_error(
        self,
        ipc_server,
        ipc_client: IPCTestClient,
    ):
        """Test that unknown methods return proper error."""
        async with ipc_client:
            response = await ipc_client.send_request("nonexistent_method")

            assert "error" in response
            assert response["error"]["code"] == -32601  # Method not found
            assert "not found" in response["error"]["message"].lower()
