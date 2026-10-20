import { PAGE_CACHE } from "@/lib/sw-policy";

/**
 * Lists the pages this phone kept for offline reading, newest first.
 * A tiny inline script, not a React effect: offline, this page's JS chunk may never have been downloaded.
 */
const SCRIPT = `(async function(){try{
var box=document.getElementById("offline-kept");var list=document.getElementById("offline-kept-list");
if(!box||!list||!("caches" in window))return;
var cache=await caches.open(${JSON.stringify(PAGE_CACHE)});var keys=(await cache.keys()).slice().reverse().slice(0,12);
for(var i=0;i<keys.length;i++){var u=new URL(keys[i].url);var href=u.pathname+u.search;var title="";
try{var html=await (await cache.match(keys[i])).text();var m=/<title>([^<]{1,120})<\\/title>/i.exec(html);title=m?m[1].replace(/\\s*[\\u00b7|\\u2013-]\\s*[^\\u00b7|\\u2013-]+$/,"").trim():"";}catch(e){}
if(href==="/")title="Home";if(!title)title=href;
var li=document.createElement("li");var a=document.createElement("a");a.href=href;a.textContent=title;
a.className="block rounded-[12px] border border-line bg-card px-3 py-2.5 text-sm font-semibold text-navy";li.appendChild(a);list.appendChild(li);}
if(keys.length)box.hidden=false;}catch(e){}})();`;

export function OfflinePages() {
  return (
    <section id="offline-kept" hidden className="mt-8 w-full text-left" data-offline-pages>
      <h2 className="font-serif text-xl text-navy">Open without signal</h2>
      <p className="mt-1 text-sm text-ink/65">Pages you already viewed on this phone.</p>
      <ul id="offline-kept-list" className="mt-3 grid gap-2" />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </section>
  );
}
