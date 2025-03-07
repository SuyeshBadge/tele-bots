"""
Utility functions for Telegram bot.
"""

import logging
from typing import Dict, Any, Optional, Tuple, Union, cast
import httpx
import functools

from telegram.request import HTTPXRequest, RequestData
from telegram.error import TelegramError, TimedOut, NetworkError

from app.config import settings

# Configure logger
logger = logging.getLogger(__name__)

# Store the original _build_client method
original_build_client = HTTPXRequest._build_client

# Create a patched version of _build_client
@functools.wraps(original_build_client)
def patched_build_client(self):
    """Patched version of _build_client that removes the 'proxies' parameter."""
    # Create a copy of client kwargs without 'proxies'
    client_kwargs = self._client_kwargs.copy()
    
    # Remove 'proxies' if it exists
    if 'proxies' in client_kwargs:
        logger.info("Removing 'proxies' parameter from httpx.AsyncClient initialization")
        del client_kwargs['proxies']
    
    # Create the client with the modified kwargs
    return httpx.AsyncClient(**client_kwargs)

def apply_telegram_patches():
    """Apply patches to the telegram library to fix compatibility issues."""
    # Patch the _build_client method
    HTTPXRequest._build_client = patched_build_client
    logger.info("Applied patch to HTTPXRequest._build_client to fix 'proxies' parameter issue")
    
    return True

class CustomHTTPXRequest(HTTPXRequest):
    """
    Custom HTTPXRequest class that fixes the 'proxies' parameter issue with newer httpx versions.
    """
    
    def __init__(
        self,
        connection_pool_size: int = 1,
        connect_timeout: Optional[float] = None,
        read_timeout: Optional[float] = None,
        write_timeout: Optional[float] = None,
        pool_timeout: Optional[float] = 1.0,
        verify_ssl: bool = True,
    ):
        """Initialize with parameters compatible with python-telegram-bot."""
        # Store verify_ssl for later use
        self._verify_ssl = verify_ssl
        
        # Call parent init without verify parameter
        super().__init__(
            connection_pool_size=connection_pool_size,
            connect_timeout=connect_timeout,
            read_timeout=read_timeout,
            write_timeout=write_timeout,
            pool_timeout=pool_timeout,
        )
    
    def _build_client(self) -> httpx.AsyncClient:
        """Build and return a custom httpx.AsyncClient without the 'proxies' parameter."""
        # Create a copy of client kwargs without 'proxies'
        client_kwargs = self._client_kwargs.copy()
        
        # Remove 'proxies' if it exists
        if 'proxies' in client_kwargs:
            logger.info("Removing 'proxies' parameter from httpx.AsyncClient initialization")
            del client_kwargs['proxies']
        
        # Add verify parameter from our stored verify_ssl
        client_kwargs['verify'] = self._verify_ssl
        
        # Create the client with the modified kwargs
        return httpx.AsyncClient(**client_kwargs)

def get_telegram_request() -> CustomHTTPXRequest:
    """
    Get a custom HTTPXRequest instance with proper SSL verification settings.
    """
    # Configure connection pool settings
    connection_pool_size = 8
    connect_timeout = 5.0
    read_timeout = 10.0
    write_timeout = 10.0
    
    # Create the request object with our custom class
    request = CustomHTTPXRequest(
        connection_pool_size=connection_pool_size,
        connect_timeout=connect_timeout,
        read_timeout=read_timeout,
        write_timeout=write_timeout,
        verify_ssl=not settings.DISABLE_SSL_VERIFICATION
    )
    
    return request 