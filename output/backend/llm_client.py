"""Async LLM client with streaming support.

Wraps the Anthropic SDK for async streaming (stream=True) and provides
a fallback to the original sync LLMClient from the game engine.

API key: read from ANTHROPIC_API_KEY environment variable.
Model: read from ANTHROPIC_MODEL or defaults to 'deepseek-v4-pro'.
"""

import os
from typing import AsyncGenerator, Optional


class AsyncLLMClient:
    """Async LLM client for Anthropic-compatible APIs with streaming support.

    Provides:
      - generate_text(): single-shot completion (non-streaming)
      - generate_text_stream(): async generator yielding text chunks
      - health_check(): verify API connectivity
    """

    def __init__(self):
        self._api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        self._model = os.environ.get("ANTHROPIC_MODEL", "deepseek-v4-pro")
        self._base_url = os.environ.get(
            "ANTHROPIC_BASE_URL", "https://api.anthropic.com"
        )
        self._client = None  # Lazy init

    @property
    def api_key(self) -> str:
        return self._api_key

    @property
    def model(self) -> str:
        return self._model

    def _get_client(self):
        """Lazy-initialize the Anthropic async client."""
        if self._client is None:
            from anthropic import AsyncAnthropic
            self._client = AsyncAnthropic(
                api_key=self._api_key,
                base_url=self._base_url,
            )
        return self._client

    async def generate_text(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 512,
    ) -> str:
        """Generate a complete text response (non-streaming).

        Args:
            prompt: The user prompt / conversation content
            system: Optional system-level instruction
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum output tokens

        Returns:
            Complete generated text string
        """
        if not self._api_key:
            return self._fallback_generate(prompt, system, temperature, max_tokens)

        client = self._get_client()
        messages = [{"role": "user", "content": prompt}]

        response = await client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or "",
            messages=messages,
        )
        return response.content[0].text if response.content else ""

    async def generate_text_stream(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """Stream LLM response tokens one at a time.

        Used by WebSocket endpoint to push tokens for the typewriter effect.

        Args:
            prompt: The user prompt / conversation content
            system: Optional system-level instruction
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum output tokens

        Yields:
            Text chunks as they arrive from the API
        """
        if not self._api_key:
            # Fallback: yield the full response as a single chunk
            text = self._fallback_generate(prompt, system, temperature, max_tokens)
            yield text
            return

        client = self._get_client()
        messages = [{"role": "user", "content": prompt}]

        async with client.messages.stream(
            model=self._model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or "",
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def health_check(self) -> bool:
        """Verify API connectivity by listing models."""
        if not self._api_key:
            return False
        try:
            client = self._get_client()
            # A simple API call to verify the key works
            await client.messages.create(
                model=self._model,
                max_tokens=1,
                messages=[{"role": "user", "content": "ping"}],
            )
            return True
        except Exception:
            return False

    def _fallback_generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 512,
    ) -> str:
        """Fallback when no API key is available.

        Returns a placeholder narrative so the game loop doesn't break.
        In production, the ANTHROPIC_API_KEY should always be set.
        """
        return (
            "[系統訊息] LLM API 金鑰未設定。請設置 ANTHROPIC_API_KEY 環境變數。\n"
            "遊戲引擎已啟動，但無法生成 AI 回應。\n"
            "請聯繫系統管理員設定 API 金鑰後重新啟動伺服器。"
        )
