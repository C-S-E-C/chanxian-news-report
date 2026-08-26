class SearchEngine {
    constructor() {
        this.proxyurlprefix = "https://url-proxy.syntropica.top/?url=";
        this.blacklist = ["",];
    }
    getHtml(url) {
        return (fetch(this.proxyurlprefix+url).then((res) => res.text()));
    }
    // Get All News
    async getNews() {
        var list = [];
        (await this.getNewsPeople()).forEach((e) => list.push(e));
        return list;
    }
    async getNewsPeople() {
        const html = await this.getHtml("https://www.people.cn/");
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const list = doc.getElementsByTagName("a");
        const finalList = [];
        for (let i = 0; i < list.length; i++) {
            const isBlacklisted = this.blacklist.some((item) => list[i].text == item);
            const filtered = list[i].href.startsWith("javascript") || !list[i].href.endsWith(".html") || list[i].text.length==4 || list[i].href.startsWith("http://www.people.com.cn/img/") || list[i].href.endsWith("/") || list[i].href.endsWith("index.html") || list[i].href.endsWith("download.html");
            if (!isBlacklisted && !filtered) {
                finalList.push({
                    href:list[i].href,
                    text:list[i].text,
                    from:"people.cn"
                });
            }
        }
        return finalList;
    }
    // Get News Content
    getContent(url) {
        if (url.includes("people.cn")||url.includes("people.com.cn")) {
            return this.NewsContentPeople(url);
        }
    }
    async NewsContentPeople(url) {
        const html = await this.getHtml(url);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const wrapper = doc.getElementsByClassName("layout rm_txt cf")[0];
        const json = {
            title: wrapper.querySelector("h1")?.innerText || '无标题',
            time: wrapper.querySelector("#newstime")?.innerText || '无时间',
            author: wrapper.querySelector("a")?.innerText || '无作者',
            content: wrapper.querySelector("#rm_txt_zw")?.innerText || '',
            preview: wrapper.querySelector("#rm_txt_zw p")?.innerText || '',
            from: 'people.cn'
        };
        return json;
    }
}