const params = new URLSearchParams(window.location.search);
const data = params.get("data");
if (!data) {
    window.location.pathname = "index.html"
}
console.log(data);
const share = JSON.parse(decodeURIComponent(atob(data)));
console.log(share);
render(share.data,share.date);