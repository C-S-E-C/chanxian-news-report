import { Firecrawl } from 'https://cdn.jsdelivr.net/npm/firecrawl@4.42.1/+esm';

class PeopleProvider {
  static apiKey = "none";

  constructor() {
    this.proxyurlprefix = "https://url-proxy.syntropica.top/?url=";
    this.blacklist = [""];
  }

  matches(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname === "people.cn" || hostname.endsWith(".people.cn") ||
        hostname === "people.com.cn" || hostname.endsWith(".people.com.cn");
    } catch {
      return false;
    }
  }

  async getHtml(url) {
    const res = await fetch(this.proxyurlprefix + url);
    if (!res.ok) throw new Error(`人民网代理请求失败：${res.status}`);
    return res.text();
  }

  async getNews() {
    const html = await this.getHtml("https://www.people.cn/");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const links = doc.getElementsByTagName("a");
    const news = [];
    for (const link of links) {
      const isBlacklisted = this.blacklist.some((item) => link.text === item);
      const filtered = link.href.startsWith("javascript") || !link.href.endsWith(".html") ||
        link.text.length === 4 || link.href.startsWith("http://www.people.com.cn/img/") ||
        link.href.endsWith("/") || link.href.endsWith("index.html") ||
        link.href.endsWith("download.html");
      if (!isBlacklisted && !filtered) {
        news.push({ href: link.href, text: link.text, from: "people.cn" });
      }
    }
    return news;
  }

  async getContent(url) {
    const html = await this.getHtml(url);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const wrapper = doc.getElementsByClassName("layout rm_txt cf")[0];
    if (!wrapper) return null;
    return {
      title: wrapper.querySelector("h1")?.innerText || "无标题",
      time: wrapper.querySelector("#newstime")?.innerText || "无时间",
      author: wrapper.querySelector("a")?.innerText || "无作者",
      content: wrapper.querySelector("#rm_txt_zw")?.innerText || "",
      preview: wrapper.querySelector("#rm_txt_zw p")?.innerText || "",
      from: "people.cn",
    };
  }
}

class FireCrawlProvider {
  static apiKey = "optional";

  constructor() {
    this.API_KEY = null;
    this.fc = new Firecrawl();
  }

  updateApiKey(key) {
    this.API_KEY = key?.trim() || null;
    this.fc = this.API_KEY ? new Firecrawl({ apiKey: this.API_KEY }) : new Firecrawl();
  }

  get client() {
    if (!this.fc) throw new Error("Firecrawl 需要 API Key");
    return this.fc;
  }

  async getNews(limit = 10) {
    const result = await this.fc.search("产险新闻", {
      limit,
      scrapeOptions: { formats: ["markdown"] },
    });
    if (result.success === false) throw new Error(result.error || "Firecrawl 搜索失败");
    const items = Array.isArray(result) ? result : result.web || result.data?.web || result.data || [];
    if (!Array.isArray(items)) throw new Error("Firecrawl 搜索结果格式不受支持");
    return items.filter((item) => item.url).map((item) => ({
      href: item.url,
      text: item.title || item.description || item.url,
      from: new URL(item.url).hostname,
    }));
  }

  async getContent(url) {
    const result = await this.fc.scrape(url, { formats: ["markdown"] });
    if (result.success === false) throw new Error(result.error || "Firecrawl 抓取失败");
    const item = result.data || result;
    const content = item.markdown || "";
    return {
      title: item.metadata?.title || "无标题",
      time: item.metadata?.publishedTime || "无时间",
      author: item.metadata?.author || "无作者",
      content,
      preview: content.slice(0, 300),
      from: new URL(url).hostname,
    };
  }
}
// Add a provider class here (or via registerProvider); the selector owns its instance.
const providerClasses = { people: PeopleProvider, firecrawl: FireCrawlProvider };
const instances = {};

function registerProvider(name, ProviderClass) {
  if (!name || Object.hasOwn(providerClasses, name)) throw new Error(`invalid or duplicate provider: ${name}`);
  if (typeof ProviderClass !== "function") throw new Error("provider must be a class");
  providerClasses[name] = ProviderClass;
}

function selectProvider(name = window.search.current.provider) {
  const ProviderClass = providerClasses[name];
  if (!ProviderClass) throw new Error(`unknown provider: ${name}`);
  return instances[name] ||= new ProviderClass();
}

function changeProvider(name) {
  selectProvider(name);
  window.search.current.provider = name;
}

async function getNews() {
  return selectProvider().getNews();
}

async function getContent(url) {
  const selected = selectProvider();
  if (selected.matches(url)) return selected.getContent(url);
}

window.search = {
  getNews,
  getContent,
  changeProvider,
  selectProvider,
  registerProvider,
  providers: providerClasses,
  current: { provider: "firecrawl" },
};
