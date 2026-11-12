import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import app as meeting_app


class ModeTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(meeting_app.app)

    def test_api_mode_requires_key(self):
        audio = self.client.post(
            "/api/transcribe",
            data={"mode": "api"},
            files={"audio": ("clip.wav", b"test", "audio/wav")},
        )
        report = self.client.post(
            "/api/analyze",
            json={"mode": "api", "transcript": "Разговор длиной больше двадцати символов."},
        )
        self.assertEqual(audio.status_code, 400)
        self.assertEqual(report.status_code, 400)

    def test_api_mode_uses_key_without_returning_it(self):
        with patch.object(meeting_app, "run_api_transcription", return_value="Текст разговора") as transcribe:
            audio = self.client.post(
                "/api/transcribe",
                data={"mode": "api", "api_key": "test-key"},
                files={"audio": ("clip.wav", b"test", "audio/wav")},
            )
        with patch.object(meeting_app, "run_api_analysis", return_value="## Итог\nФактов мало.") as analyze:
            report = self.client.post(
                "/api/analyze",
                json={
                    "mode": "api",
                    "api_key": "test-key",
                    "transcript": "Менеджер и клиент поговорили о продукте.",
                },
            )
        self.assertEqual(audio.status_code, 200)
        self.assertEqual(audio.json()["transcript"], "Текст разговора")
        self.assertEqual(transcribe.call_args.args[1], "test-key")
        self.assertEqual(report.status_code, 200)
        self.assertIn("Итог", report.json()["html"])
        self.assertEqual(analyze.call_args.args[1], "test-key")
        self.assertNotIn("test-key", audio.text + report.text)

    def test_hosted_mode_disables_local_processing(self):
        with patch.object(meeting_app, "HOSTED", True):
            health = self.client.get("/api/health")
            audio = self.client.post(
                "/api/transcribe",
                data={"mode": "local"},
                files={"audio": ("clip.wav", b"test", "audio/wav")},
            )
        self.assertFalse(health.json()["local_available"])
        self.assertEqual(audio.status_code, 400)


if __name__ == "__main__":
    unittest.main()
