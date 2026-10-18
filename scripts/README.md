# Uncensored LLM Fine-Tuning & Customization Suite

This folder provides complete tools and scripts to create genuinely uncensored local LLMs.

---

## 1. Fast Ollama Uncensored Model Builder (Immediate)
Creates an uncensored version of your existing local models (e.g. `qwen2.5-coder:7b`, `gemma4:12b`):

```bash
python scripts/create_ollama_uncensored.py --base qwen2.5-coder:7b --name qwen-uncensored
```

Or download verified community fine-tuned uncensored models (like Dolphin Llama 3):

```bash
python scripts/create_ollama_uncensored.py --pull dolphin-llama3:8b
```

---

## 2. Refusal Direction Abliteration (`scripts/abliterate_uncensored.py`)
Abliteration (orthogonalization of refusal direction) is the state-of-the-art method developed by open-source researchers (FailSpy / Maxime Labonne). It mathematically identifies and deletes refusal vectors directly from model weights.

**Requirements**:
```bash
pip install torch transformers accelerate
```

**Run**:
```bash
python scripts/abliterate_uncensored.py --model Qwen/Qwen2.5-7B-Instruct --output ./uncensored_abliterated
```

---

## 3. LoRA Fine-Tuning Script (`scripts/finetune_uncensored.py`)
Fine-tunes base or instruction models on an uncensored Q&A dataset using Hugging Face `transformers` and `peft` (LoRA).

**Requirements**:
```bash
pip install torch transformers peft datasets accelerate bitsandbytes
```

**Run**:
```bash
python scripts/finetune_uncensored.py --model Qwen/Qwen2.5-7B-Instruct --output ./fine_tuned_uncensored
```
