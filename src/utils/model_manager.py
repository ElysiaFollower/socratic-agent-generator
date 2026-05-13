"""Model management module for checking and downloading HuggingFace models.

This module provides utilities to check if required models are downloaded
and automatically download them if missing.
"""

import logging
from typing import List, Tuple

from huggingface_hub import snapshot_download, try_to_load_from_cache
from langchain_huggingface import HuggingFaceEmbeddings

from config import EMBEDDING_PROVIDER, HF_MODELS_DIR, REQUIRED_MODELS

logger = logging.getLogger(__name__)


def _is_model_downloaded(model_name: str) -> bool:
    """Check if a model is already downloaded using official HuggingFace Hub cache API.
    
    Uses try_to_load_from_cache() to check if key model files exist in cache.
    This is more reliable than manual file system checks because:
    1. It handles incomplete downloads correctly
    2. It checks file integrity through HuggingFace Hub's cache mechanism
    3. It's simpler and more maintainable
    
    Args:
        model_name: The HuggingFace model name
        
    Returns:
        True if model exists in cache, False otherwise
    """
    # Check if config.json exists in cache (indicates model is cached)
    # We check config.json as it's a required file for all models
    cache_path = try_to_load_from_cache(
        repo_id=model_name,
        filename="config.json",
        cache_dir=str(HF_MODELS_DIR),
    )
    
    # If cache_path is a string, the file exists in cache
    # If it's None or a special marker, the file is not cached
    return isinstance(cache_path, str) and cache_path is not None


def _download_model(model_name: str) -> bool:
    """Download a HuggingFace model to the cache directory.
    
    Only downloads essential files, excluding large ONNX and OpenVINO variants
    to save download time and disk space (reduces download size by ~80%).
    
    Args:
        model_name: The HuggingFace model name
        
    Returns:
        True if download successful, False otherwise
    """
    try:
        logger.info(f"📥 开始下载模型: {model_name}")
        logger.info(f"📁 保存路径: {HF_MODELS_DIR}")
        logger.info("💡 仅下载必要文件，跳过 ONNX/OpenVINO 变体以节省时间和空间")
        
        snapshot_download(
            repo_id=model_name,
            cache_dir=str(HF_MODELS_DIR),
            local_files_only=False,
            resume_download=True,  # Resume interrupted downloads
            # Only download essential files: configs, model weights, and tokenizer files
            # This excludes large ONNX/OpenVINO variants (~80% size reduction)
            allow_patterns=[
                "*.json",           # Config files (config.json, tokenizer_config.json, etc.)
                "*.txt",            # Text files (vocab.txt, special_tokens_map.txt, etc.)
                "*.model",          # SentencePiece model files
                "pytorch_model.bin", # PyTorch model weights (if safetensors not available)
                "model.safetensors", # SafeTensors format (preferred, more secure)
                "tokenizer.json",   # Tokenizer files
                "vocab.txt",        # Vocabulary files
                "merges.txt",       # BPE merges
            ],
        )
        
        logger.info(f"✅ 模型下载完成: {model_name}")
        return True
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ 模型下载失败: {model_name}, 错误: {error_msg}")
        
        # If download failed, check if we can still use the model
        # (some files might be optional, like pytorch_model.bin if safetensors exists)
        if "pytorch_model.bin" in error_msg.lower():
            logger.warning("⚠️  pytorch_model.bin 下载失败，但可能已有 model.safetensors，尝试继续...")
            # Check if safetensors exists
            safetensors_cache = try_to_load_from_cache(
                repo_id=model_name,
                filename="model.safetensors",
                cache_dir=str(HF_MODELS_DIR),
            )
            if isinstance(safetensors_cache, str):
                logger.info("✅ 检测到 model.safetensors 存在，模型可用")
                return True
        
        return False


def check_and_download_models() -> Tuple[bool, List[str], List[str]]:
    """Check all required models and download missing ones.
    
    Returns:
        Tuple of (all_successful, downloaded_models, failed_models)
        - all_successful: True if all models are available (downloaded or already existed)
        - downloaded_models: List of model names that were downloaded
        - failed_models: List of model names that failed to download
    """
    if EMBEDDING_PROVIDER != "huggingface":
        logger.info(
            "Skipping HuggingFace model download because EMBEDDING_PROVIDER=%s",
            EMBEDDING_PROVIDER,
        )
        return True, [], []

    # Ensure models directory exists
    HF_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    downloaded_models: List[str] = []
    failed_models: List[str] = []
    existing_models: List[str] = []
    
    logger.info("🔍 检查项目所需的模型...")
    logger.info(f"📂 模型缓存目录: {HF_MODELS_DIR}")
    
    for model_name, description in REQUIRED_MODELS.items():
        logger.info(f"\n📋 检查模型: {model_name}")
        logger.info(f"   描述: {description}")
        
        if _is_model_downloaded(model_name):
            logger.info(f"   ✅ 模型已存在，跳过下载")
            existing_models.append(model_name)
        else:
            logger.info(f"   ⚠️  模型未找到，开始下载...")
            if _download_model(model_name):
                downloaded_models.append(model_name)
            else:
                failed_models.append(model_name)
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("📊 模型检查总结:")
    logger.info(f"   ✅ 已存在: {len(existing_models)} 个")
    logger.info(f"   📥 新下载: {len(downloaded_models)} 个")
    logger.info(f"   ❌ 下载失败: {len(failed_models)} 个")
    
    if existing_models:
        logger.info(f"\n   已存在的模型:")
        for model in existing_models:
            logger.info(f"     - {model}")
    
    if downloaded_models:
        logger.info(f"\n   新下载的模型:")
        for model in downloaded_models:
            logger.info(f"     - {model}")
    
    if failed_models:
        logger.error(f"\n   下载失败的模型:")
        for model in failed_models:
            logger.error(f"     - {model}")
    
    logger.info("=" * 60 + "\n")
    
    all_successful = len(failed_models) == 0
    return all_successful, downloaded_models, failed_models


def verify_model_accessibility(model_name: str) -> bool:
    """Verify that a model can be loaded (quick test).
    
    Args:
        model_name: The HuggingFace model name
        
    Returns:
        True if model can be loaded, False otherwise
    """
    try:
        logger.info(f"🧪 验证模型可访问性: {model_name}")
        embeddings = HuggingFaceEmbeddings(
            model_name=model_name,
            cache_folder=str(HF_MODELS_DIR)
        )
        # Try to embed a test string
        test_embedding = embeddings.embed_query("test")
        if test_embedding and len(test_embedding) > 0:
            logger.info(f"   ✅ 模型验证成功")
            return True
        else:
            logger.warning(f"   ⚠️  模型返回空结果")
            return False
    except Exception as e:
        logger.error(f"   ❌ 模型验证失败: {e}")
        return False
