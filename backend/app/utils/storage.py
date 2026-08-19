"""S3-compatible object storage adapter used by document uploads."""

from __future__ import annotations

import mimetypes
from collections.abc import Iterator
from typing import BinaryIO

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


class StorageError(RuntimeError):
    """Raised when an object-storage operation cannot be completed."""


def _client():
    if not settings.storage_enabled:
        raise StorageError("Object storage is disabled")
    return boto3.client(
        "s3",
        endpoint_url=settings.storage_endpoint_url,
        aws_access_key_id=settings.storage_access_key_id,
        aws_secret_access_key=settings.storage_secret_access_key,
        region_name=settings.storage_region,
    )


def upload_file(fileobj: BinaryIO, object_key: str, content_type: str | None) -> None:
    try:
        extra_args = {"ContentType": content_type or mimetypes.guess_type(object_key)[0] or "application/octet-stream"}
        _client().upload_fileobj(fileobj, settings.storage_bucket, object_key, ExtraArgs=extra_args)
    except (BotoCoreError, ClientError) as exc:
        raise StorageError("Could not upload the document to object storage") from exc


def delete_file(object_key: str) -> None:
    try:
        _client().delete_object(Bucket=settings.storage_bucket, Key=object_key)
    except (BotoCoreError, ClientError) as exc:
        raise StorageError("Could not remove the document from object storage") from exc


def download_file(object_key: str) -> Iterator[bytes]:
    try:
        body = _client().get_object(Bucket=settings.storage_bucket, Key=object_key)["Body"]
    except (BotoCoreError, ClientError) as exc:
        raise StorageError("Could not download the document from object storage") from exc

    def chunks() -> Iterator[bytes]:
        try:
            yield from body.iter_chunks(chunk_size=1024 * 1024)
        finally:
            body.close()

    return chunks()
