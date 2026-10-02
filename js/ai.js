import * as _webllm from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm";

// ============================================================
// Provider: WebLLM
// ============================================================
class WebLLMProvider {
  static apiKey = "none";

  constructor() {
    this.default = null;
    this.current = null;
    this.engine = null;
    this.models = [];
    this.modelsDownloaded = [];
    this.gpu = null;
    this.maxSingleBufferMB = null;
    this.budgetMB = null;
    this.error = null;
    this.engineReady = this.initialize();
  }

  async initialize() {
    if (!navigator.gpu) {
      this.error = "WebGPU unavailable";
      console.warn("webllm fallback:", this.error);
      return;
    }

    let adapter;
    try {
      adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });
    } catch (e) {
      this.error = `requestAdapter failed: ${e}`;
      console.warn("webllm fallback:", this.error);
      return;
    }

    if (!adapter) {
      this.error = "No GPU adapter";
      console.warn("webllm fallback:", this.error);
      return;
    }

    this.gpu = adapter;
    this.maxSingleBufferMB = adapter.limits.maxBufferSize / 1024 / 1024;
    this.budgetMB = (navigator.deviceMemory || 4) * 1024 * 0.6;

    console.log(
      "maxSingleBufferMB:",
      this.maxSingleBufferMB,
      "budgetMB:",
      this.budgetMB,
    );
    var tmp;
    for (const model of _webllm.prebuiltAppConfig.model_list) {
      if (model.vram_required_MB <= this.budgetMB) {
        console.log("webllm:", model);
        tmp = {
          provider: "webllm",
          id: model.model_id,
          vram_required_MB: model.vram_required_MB,
          downloaded: false,
        };
        if(await caches.match(model.model_lib)) {
          tmp.downloaded = true;
        }
        this.models.push(tmp);
      }
    }
    this.models.sort((a, b) => b.vram_required_MB - a.vram_required_MB);
    this.default = (this.models[3] || this.models[0])?.id || null;
    this.engine = new _webllm.MLCEngine({
      initProgressCallback: (progress) => {
        window.channels.statUpdater.postMessage({ name: 'WebLLM', value: progress.text, exp: -1, color: 'var(--accent)' });
        console.log("webllm", progress);
      },
    });

    if (!this.default) {
      console.warn("没有模型满足内存预算");
      this.error = "no model within budget";
    }
  }

  async changeModel(model) {
    await this.engineReady;
    if (!this.models.some((item) => item.id === model)) {
      throw new Error(`unknown model: ${model}`);
    }
    if (!this.engine) throw new Error(this.error || "WebLLM engine unavailable");
    if (model === this.current) return;
    window.channels.statUpdater.postMessage({ name: 'WebLLM', value: '正在加载模型…', exp: 15, color: 'var(--accent)' });
    try {
      await this.engine.reload(model);
      this.current = model;
      this.error = null;
      window.channels.statUpdater.postMessage({ name: 'WebLLM', value: '模型加载完成', exp: 5, color: 'var(--teal)' });
    } catch (error) {
      window.channels.statUpdater.postMessage({ name: 'WebLLM', value: '模型加载失败', exp: 5, color: 'var(--red)' });
      throw error;
    }
  }

  async createCompletion(model, messages) {
    await this.engineReady;
    if (!model) throw new Error("no model available");
    await this.changeModel(model);
    return this.engine.chat.completions.create({ messages, max_tokens: 1024 });
  }
}

// ============================================================
// Provider registry
// ============================================================
const providerClasses = { webllm: WebLLMProvider };
const instances = {};

function registerProvider(name, ProviderClass) {
  if (!name || Object.hasOwn(providerClasses, name)) {
    throw new Error(`invalid or duplicate provider: ${name}`);
  }
  if (typeof ProviderClass !== "function") {
    throw new Error("provider must be a class");
  }
  providerClasses[name] = ProviderClass;
  delete instances[name];
}

function selectProvider(name = window.ai?.current?.provider) {
  if (!name) throw new Error("no provider specified");
  const ProviderClass = providerClasses[name];
  if (!ProviderClass) throw new Error(`unknown provider: ${name}`);
  return (instances[name] ||= new ProviderClass());
}

// ============================================================
// AI 门面：继承 EventTarget
// ============================================================
class AI extends EventTarget {
  constructor() {
    super();

    this.providers = providerClasses;

    // 当前 provider / model
    this.current = { provider: "webllm", model: null };
    // 内部状态
    this._ready = false;
    this._error = null;
    this._defaultProvider = null;
  }

  // ---------- 事件派发辅助 ----------
  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // ---------- 初始化 ----------
  async _init() {
    try {
      this._defaultProvider = selectProvider("webllm");

      // 等默认 provider 就绪
      await this._defaultProvider.engineReady;

      // 填默认模型
      if (
        this.current.provider === "webllm" &&
        !this.current.model
      ) {
        this.current.model = this._defaultProvider.default;
      }

      // 判断是否真的可用
      if (this._defaultProvider.error) {
        this._error = this._defaultProvider.error;
        this._emit("error", {
          error: this._error,
          provider: this.current.provider,
        });
        return;
      }

      this._ready = true;
      this._emit("loaded", {
        provider: this.current.provider,
        model: this.current.model,
        models: this._defaultProvider.models,
      });
    } catch (e) {
      this._error = e;
      this._emit("error", {
        error: e,
        provider: this.current.provider,
      });
    }
  }

  // ---------- 公共 API ----------
  get ready() {
    return this._ready;
  }

  get error() {
    return this._error ?? selectProvider().error;
  }

  get engineReady() {
    return selectProvider().engineReady;
  }

  get webllm() {
    return selectProvider("webllm");
  }

  get gpu() {
    return this._defaultProvider?.gpu ?? null;
  }

  get maxSingleBufferMB() {
    return this._defaultProvider?.maxSingleBufferMB ?? null;
  }

  get budgetMB() {
    return this._defaultProvider?.budgetMB ?? null;
  }

  get models() {
    const r = [];
    for (const name in instances) {
      const provider = instances[name];
      if (provider?.models) {
        for (const model of provider.models) {
          r.push(`${model.downloaded ? '💻' : '☁'} | ${name} | ${model.id}`);
        }
      }
    }
    return r;
  }

  get modelsCurrentProvider() {
    return selectProvider().models;
  }

  selectProvider(name) {
    return selectProvider(name);
  }

  registerProvider(name, ProviderClass) {
    registerProvider(name, ProviderClass);
  }

  async changeModel(provider, model) {
    const selected = selectProvider(provider);
    await selected.changeModel(model);
    this.current = { provider, model };
    this._emit("modelchange", { provider, model });
  }

  async createCompletion(optionsOrProvider, model, messages) {
    let request;
    if (
      typeof optionsOrProvider === "object" &&
      optionsOrProvider !== null
    ) {
      request = optionsOrProvider;
    } else {
      request = { provider: optionsOrProvider, model, messages };
    }

    const provider = request.provider || this.current.provider;
    const selected = selectProvider(provider);

    const targetModel =
      request.model ||
      (provider === this.current.provider
        ? this.current.model
        : null) ||
      selected.default;

    if (!targetModel) throw new Error("no model available");

    const result = await selected.createCompletion(
      targetModel,
      request.messages,
    );

    this.current = { provider, model: targetModel };
    return result;
  }

  // completions 兼容旧接口
  get completions() {
    return {
      create: (optionsOrProvider, model, messages) =>
        this.createCompletion(optionsOrProvider, model, messages),
    };
  }
}

// ============================================================
// 创建全局实例
// ============================================================
const ai = new AI();
window.ai = ai;

// 启动初始化（异步，完成/失败会派发事件）
ai._init();