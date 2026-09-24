// Prints just one element. Copies it into a top-level #print-root (so no
// dialog transform, fixed backdrop or page scroll can push it off the paper),
// hides everything else for print, and switches to the light theme while the
// print dialog is open. See the print rules in index.css.

const URL_REF = /url\(#([^)]+)\)/g;

/** Give every id in the copy a unique suffix and repoint url(#id) / href="#id" at it. */
function uniquifyIds(root: HTMLElement, suffix: string) {
  const ids = new Set<string>();
  root.querySelectorAll<HTMLElement | SVGElement>("[id]").forEach((el) => {
    ids.add(el.id);
    el.id = `${el.id}${suffix}`;
  });
  if (ids.size === 0) return;
  root.querySelectorAll<HTMLElement | SVGElement>("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes("url(#")) {
        el.setAttribute(attr.name, attr.value.replace(URL_REF, (m, id) => (ids.has(id) ? `url(#${id}${suffix})` : m)));
      } else if ((attr.name === "href" || attr.name === "xlink:href") && attr.value.startsWith("#") && ids.has(attr.value.slice(1))) {
        el.setAttribute(attr.name, `${attr.value}${suffix}`);
      }
    }
    const style = el.getAttribute("style");
    if (style?.includes("url(#")) {
      el.setAttribute("style", style.replace(URL_REF, (m, id) => (ids.has(id) ? `url(#${id}${suffix})` : m)));
    }
  });
}

export function printElement(source: HTMLElement, options: { landscape?: boolean } = {}) {
  document.getElementById("print-root")?.remove();
  const host = document.createElement("div");
  host.id = "print-root";
  if (options.landscape) host.dataset.landscape = "true";
  const copy = source.cloneNode(true) as HTMLElement;
  uniquifyIds(copy, "-print");
  host.appendChild(copy);
  document.body.appendChild(host);
  document.body.classList.add("printing-element");

  const html = document.documentElement;
  const wasDark = html.classList.contains("dark");
  if (wasDark) html.classList.remove("dark");

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    host.remove();
    document.body.classList.remove("printing-element");
    if (wasDark) html.classList.add("dark");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  // Let the copy (and any images in it) lay out before opening the dialog.
  const images = Array.from(copy.querySelectorAll("img")).filter((img) => !img.complete);
  Promise.all(images.map((img) => new Promise((r) => { img.onload = img.onerror = r; })))
    .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    .then(() => {
      window.print();
      // Chrome blocks in print() and fires afterprint; Safari may not, so
      // fall back to cleaning up shortly after.
      setTimeout(cleanup, 1500);
    });
}
